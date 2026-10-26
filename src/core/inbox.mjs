// inbox-to-reminders: each line of a quick-capture note becomes a reminder.
//
//   Call the bank tomorrow 9am #errands !!
//   Send slides friday
//   Renew passport 2026-11-15 #admin
//
// Syntax, all optional and anywhere on the line:
//   #list           target Reminders list ("#deep-work" matches a list named "Deep Work")
//   !, !!, !!!      low, medium, high priority
//   today, tonight, tomorrow, next week, in 3 days, in 2 weeks, 2026-11-15
//   monday ... sunday (next one, never today), or mon ... sun after on/by/due/next
//   9am, 9:30pm, 14:00, at 9, noon
// A time without a date means today, or tomorrow if that time has passed.
// A date without a time uses the default time (09:00).
// Lines checked as done ("- [x] ...") and empty lines are ignored. The first line is the note title.

import { addDays, atTime, startOfDay, startOfIsoWeek } from './dates.mjs';
import { collapseSpaces, escapeHtml, htmlToLines, normalizeKey } from './text.mjs';

const WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const SHORT_WEEKDAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
export const PRIORITY = { none: 0, high: 1, medium: 5, low: 9 };
const PRIORITY_BY_MARKS = { 1: PRIORITY.low, 2: PRIORITY.medium, 3: PRIORITY.high };

function nextWeekday(now, weekday) {
  const today = startOfDay(now);
  const ahead = (weekday - today.getDay() + 7) % 7 || 7;
  return addDays(today, ahead);
}

function take(state, pattern, onMatch) {
  const match = pattern.exec(state.text);
  if (!match) return false;
  const result = onMatch(match);
  if (result === false) return false;
  state.text = `${state.text.slice(0, match.index)} ${state.text.slice(match.index + match[0].length)}`;
  return true;
}

function to24h(hour, minute, meridiem) {
  let h = Number(hour);
  const m = Number(minute || 0);
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    const pm = meridiem.toLowerCase() === 'pm';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || m > 59) return null;
  return { hours: h, minutes: m };
}

export function parseTimeOfDay(text) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(text).trim());
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

const LEADING = '(?:^|\\s)(?:(?:on|by|due)\\s+)?';

// Returns null for empty lines, { skip: 'done' } for checked lines, or the parsed item.
export function parseCaptureLine(line, options) {
  const now = options.now;
  const defaultTime = options.defaultTime || { hours: 9, minutes: 0 };
  if (/^\s*(?:[-*\u2022]\s*)?\[[xX]\]/.test(line)) return { skip: 'done', raw: line };
  const cleaned = String(line)
    .replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, '')
    .replace(/^\[\s?\]\s*/, '')
    .trim();
  if (!cleaned) return null;

  const state = { text: ` ${cleaned} ` };
  let list = null;
  let priority = PRIORITY.none;
  let date = null;
  let time = null;
  let tonight = false;

  take(state, /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/u, (m) => {
    list = m[1].replace(/[-_]+/g, ' ');
  });
  take(state, /(?:^|\s)(!{1,3})(?=\s|$)/, (m) => {
    priority = PRIORITY_BY_MARKS[m[1].length];
  });

  const datePatterns = [
    [new RegExp(`${LEADING}(\\d{4}-\\d{2}-\\d{2})(?=\\s|$)`, 'i'), (m) => {
      const parts = m[1].split('-').map(Number);
      const day = new Date(parts[0], parts[1] - 1, parts[2]);
      if (day.getMonth() !== parts[1] - 1) return false;
      date = day;
    }],
    [new RegExp(`${LEADING}(today|tonight|tomorrow|tmrw)(?=\\s|$|[,.])`, 'i'), (m) => {
      const word = m[1].toLowerCase();
      date = startOfDay(word === 'today' || word === 'tonight' ? now : addDays(now, 1));
      tonight = word === 'tonight';
    }],
    [new RegExp(`${LEADING}next\\s+week(?=\\s|$|[,.])`, 'i'), () => {
      date = addDays(startOfIsoWeek(now), 7);
    }],
    [/(?:^|\s)in\s+(\d{1,3})\s+(days?|weeks?)(?=\s|$|[,.])/i, (m) => {
      const amount = Number(m[1]) * (m[2].toLowerCase().startsWith('week') ? 7 : 1);
      date = addDays(startOfDay(now), amount);
    }],
    [new RegExp(`(?:^|\\s)(?:(?:on|by|due|next)\\s+)?(${Object.keys(WEEKDAYS).join('|')})(?=\\s|$|[,.])`, 'i'), (m) => {
      date = nextWeekday(now, WEEKDAYS[m[1].toLowerCase()]);
    }],
    [new RegExp(`(?:^|\\s)(?:on|by|due|next)\\s+(${Object.keys(SHORT_WEEKDAYS).join('|')})(?=\\s|$|[,.])`, 'i'), (m) => {
      date = nextWeekday(now, SHORT_WEEKDAYS[m[1].toLowerCase()]);
    }],
  ];
  for (const [pattern, onMatch] of datePatterns) if (take(state, pattern, onMatch)) break;

  const timePatterns = [
    [/(?:^|\s)(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)(?=\s|$|[,.])/i, (m) => {
      time = to24h(m[1], m[2], m[3]);
      if (!time) return false;
    }],
    [/(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$|[,.])/, (m) => {
      time = to24h(m[1], m[2]);
    }],
    [/(?:^|\s)at\s+([01]?\d|2[0-3])(?=\s|$|[,.])/i, (m) => {
      time = to24h(m[1], 0);
    }],
    [/(?:^|\s)(?:at\s+)?(noon|midday)(?=\s|$|[,.])/i, () => {
      time = { hours: 12, minutes: 0 };
    }],
  ];
  for (const [pattern, onMatch] of timePatterns) if (take(state, pattern, onMatch)) break;

  let due = null;
  if (date) {
    const at = time || (tonight ? { hours: 20, minutes: 0 } : defaultTime);
    due = atTime(date, at.hours, at.minutes);
  } else if (time) {
    due = atTime(now, time.hours, time.minutes);
    if (due <= now) due = addDays(due, 1);
  }

  let title = collapseSpaces(state.text).replace(/[\s,;:]+(?:on|by|due|at)?$/i, '').replace(/\s+(?:on|by|due|at)$/i, '');
  if (!title) title = cleaned;
  return { title, list, priority, due, hasTime: Boolean(time), raw: line };
}

function resolveList(tag, lists, defaultList) {
  if (!tag) return { name: defaultList, known: true };
  const wanted = normalizeKey(tag);
  const found = lists.find((name) => normalizeKey(name) === wanted);
  return found ? { name: found, known: true } : { name: defaultList, known: false };
}

// input: { body (note HTML), now, lists, defaultList, openTitles: { [list]: [title] }, defaultTime }
// Returns what to create, what already exists, and the lines to keep if the note is cleared.
export function planInbox(input) {
  const lines = htmlToLines(input.body);
  const titleIndex = lines.findIndex((line) => line.trim() !== '');
  const noteTitle = titleIndex >= 0 ? lines[titleIndex].trim() : '';
  const existing = new Map();
  for (const [list, titles] of Object.entries(input.openTitles || {})) {
    existing.set(normalizeKey(list), new Set(titles.map(normalizeKey)));
  }
  const plan = { noteTitle, create: [], duplicates: [], keep: [], warnings: [] };
  lines.forEach((line, index) => {
    if (index <= titleIndex) return;
    const parsed = parseCaptureLine(line, { now: input.now, defaultTime: input.defaultTime });
    if (!parsed) return;
    if (parsed.skip) {
      plan.keep.push(line.trim());
      return;
    }
    const list = resolveList(parsed.list, input.lists || [], input.defaultList);
    if (!list.known) plan.warnings.push(`List "${parsed.list}" not found, "${parsed.title}" goes to ${list.name}.`);
    const item = { title: parsed.title, list: list.name, due: parsed.due, priority: parsed.priority, line: line.trim() };
    const key = normalizeKey(list.name);
    const seen = existing.get(key) || new Set();
    if (seen.has(normalizeKey(parsed.title))) {
      plan.duplicates.push(item);
      return;
    }
    seen.add(normalizeKey(parsed.title));
    existing.set(key, seen);
    plan.create.push(item);
  });
  return plan;
}

// The note body after --clear: the title, then only the lines that were left alone.
export function clearedInboxHtml(noteTitle, keep) {
  const lines = [`<div><h1>${escapeHtml(noteTitle || 'Inbox')}</h1></div>`];
  for (const line of keep) lines.push(`<div>${escapeHtml(line)}</div>`);
  if (!keep.length) lines.push('<div><br></div>');
  return `${lines.join('\n')}\n`;
}
