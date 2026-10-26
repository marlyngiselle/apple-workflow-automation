// focus-report: where the scheduled time went over a date range, grouped by
// calendar or by #tag (taken from the event title or its notes).

import { addDays, formatDuration, formatHours, formatIsoDate, startOfDay } from './dates.mjs';
import { eventsInRange, filterCalendars } from './aggregate.mjs';
import { toMarkdown } from './render.mjs';
import { toCsv } from './text.mjs';

export const UNTAGGED = '(untagged)';
const TAG_PATTERN = /(?:^|[\s(])#([a-z][\w-]*)/gi;

export function tagsOf(event) {
  const tags = new Set();
  for (const source of [event.title, event.notes]) {
    for (const match of String(source || '').matchAll(TAG_PATTERN)) tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

// Inclusive calendar days: from 2026-10-01 to 2026-10-31 covers all of October.
export function dayRange(from, to) {
  const start = startOfDay(from);
  const end = addDays(startOfDay(to), 1);
  return { start, end, days: Math.round((end - start) / 86400000) };
}

export function buildFocusReport(events, options) {
  const { start, end } = options.range;
  const groupBy = options.groupBy || 'calendar';
  const { items } = eventsInRange(filterCalendars(events, options.calendars), start, end);
  const timed = items.filter((item) => !item.allDay && item.minutes > 0);
  const totalMinutes = timed.reduce((sum, item) => sum + item.minutes, 0);
  const groups = new Map();
  for (const item of timed) {
    const keys = groupBy === 'tag' ? (tagsOf(item).length ? tagsOf(item) : [UNTAGGED]) : [item.calendar];
    for (const key of keys) {
      const group = groups.get(key) || { group: key, events: 0, minutes: 0 };
      group.events += 1;
      group.minutes += item.minutes;
      groups.set(key, group);
    }
  }
  const rows = [...groups.values()]
    .map((group) => ({
      ...group,
      hours: formatHours(group.minutes),
      share: totalMinutes > 0 ? Math.round((group.minutes / totalMinutes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.group.localeCompare(b.group));
  return {
    from: formatIsoDate(start),
    to: formatIsoDate(addDays(end, -1)),
    groupBy,
    events: timed.length,
    totalMinutes,
    multiTagged: groupBy === 'tag' && timed.some((item) => tagsOf(item).length > 1),
    rows,
  };
}

export function focusReportCsv(report) {
  return toCsv(report.rows, [
    { key: 'group', header: report.groupBy },
    { key: 'events', header: 'events' },
    { key: 'minutes', header: 'minutes' },
    { key: 'hours', header: 'hours' },
    { key: 'share', header: 'share_percent' },
  ]);
}

export function focusReportMarkdown(report) {
  const doc = [
    { type: 'h1', text: `Focus report ${report.from} to ${report.to}` },
    { type: 'p', text: `${report.events} events, ${formatDuration(report.totalMinutes)} scheduled, grouped by ${report.groupBy}.` },
  ];
  if (report.rows.length) {
    doc.push({
      type: 'table',
      head: [report.groupBy === 'tag' ? 'Tag' : 'Calendar', 'Events', 'Time', 'Hours', 'Share'],
      rows: report.rows.map((row) => [row.group, String(row.events), formatDuration(row.minutes), row.hours, `${row.share}%`]),
    });
  } else {
    doc.push({ type: 'p', text: 'No timed events in this range.' });
  }
  if (report.multiTagged) {
    doc.push({ type: 'p', text: 'Events with several tags count in full under each tag, so shares can add up to more than 100%.' });
  }
  return toMarkdown(doc);
}
