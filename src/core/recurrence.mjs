// Calendar's scripting dictionary returns a recurring series once, as its first occurrence.
// This module expands the common RRULE shapes so a weekly stand-up counts every week.
// Supported: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL and, for WEEKLY, BYDAY.
// Anything else is reported as unsupported and the caller keeps the single occurrence it has.

import { addDays, atTime, isoWeekday, overlaps, startOfIsoWeek } from './dates.mjs';

const DAY_CODES = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
const SUPPORTED_KEYS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST']);
const MAX_STEPS = 20000;

function parseUntil(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!match) return null;
  const [y, mo, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  if (!match[4]) return new Date(y, mo, d, 23, 59, 59);
  const [h, mi, s] = [Number(match[4]), Number(match[5]), Number(match[6])];
  return match[7] ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
}

// Returns { freq, interval, count, until, byDay } or { unsupported: reason }. Empty input returns null.
export function parseRRule(text) {
  if (!text) return null;
  const body = String(text).trim().replace(/^RRULE:/i, '');
  if (!body) return null;
  const parts = {};
  for (const pair of body.split(';')) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    parts[key.toUpperCase()] = (value || '').toUpperCase();
  }
  const unknown = Object.keys(parts).filter((key) => !SUPPORTED_KEYS.has(key));
  if (unknown.length) return { unsupported: `RRULE parts not supported: ${unknown.join(', ')}` };
  const freq = parts.FREQ;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return { unsupported: `FREQ=${freq || '(missing)'}` };
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1) return { unsupported: `INTERVAL=${parts.INTERVAL}` };
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  const until = parts.UNTIL ? parseUntil(parts.UNTIL) : null;
  if (parts.UNTIL && !until) return { unsupported: `UNTIL=${parts.UNTIL}` };
  let byDay = [];
  if (parts.BYDAY) {
    if (freq !== 'WEEKLY') return { unsupported: `BYDAY with FREQ=${freq}` };
    for (const code of parts.BYDAY.split(',')) {
      if (!(code in DAY_CODES)) return { unsupported: `BYDAY=${parts.BYDAY}` };
      byDay.push(DAY_CODES[code]);
    }
    byDay = [...new Set(byDay)].sort((a, b) => a - b);
  }
  return { freq, interval, count, until, byDay };
}

function sameTimeOn(day, master) {
  const date = atTime(day, master.getHours(), master.getMinutes());
  date.setSeconds(master.getSeconds());
  return date;
}

function* candidates(rule, start) {
  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i += rule.interval) yield sameTimeOn(addDays(start, i), start);
  }
  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay.length ? rule.byDay : [isoWeekday(start)];
    const firstMonday = startOfIsoWeek(start);
    for (let week = 0; ; week += rule.interval) {
      const monday = addDays(firstMonday, week * 7);
      for (const offset of days) yield sameTimeOn(addDays(monday, offset), start);
    }
  }
  if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
    const stepMonths = rule.freq === 'MONTHLY' ? rule.interval : rule.interval * 12;
    for (let months = 0; ; months += stepMonths) {
      const candidate = new Date(start.getFullYear(), start.getMonth() + months, start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds());
      // Skip months without that day (the 31st, or 29 February), as Calendar does.
      if (candidate.getDate() === start.getDate()) yield candidate;
    }
  }
}

// Occurrences of a recurring event that overlap [rangeStart, rangeEnd).
// event: { start, end, recurrence }. Returns { occurrences, unsupported }.
export function expandOccurrences(event, rangeStart, rangeEnd) {
  const rule = parseRRule(event.recurrence);
  if (!rule) return { occurrences: [], unsupported: null };
  if (rule.unsupported) return { occurrences: [], unsupported: rule.unsupported };
  const durationMs = event.end.getTime() - event.start.getTime();
  const occurrences = [];
  let emitted = 0;
  let steps = 0;
  for (const start of candidates(rule, event.start)) {
    steps += 1;
    if (steps > MAX_STEPS) break;
    if (start.getTime() < event.start.getTime()) continue;
    if (rule.until && start.getTime() > rule.until.getTime()) break;
    if (rule.count !== null && emitted >= rule.count) break;
    if (start.getTime() >= rangeEnd.getTime()) break;
    emitted += 1;
    const end = new Date(start.getTime() + durationMs);
    if (overlaps(start, end, rangeStart, rangeEnd)) occurrences.push({ start, end });
  }
  return { occurrences, unsupported: null };
}
