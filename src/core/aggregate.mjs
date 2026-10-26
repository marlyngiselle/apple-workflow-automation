// Turning raw records into the numbers a review needs.

import { daysBetween, formatIsoDate, overlapMinutes, overlaps, startOfDay } from './dates.mjs';
import { expandOccurrences } from './recurrence.mjs';
import { normalizeKey } from './text.mjs';

export function filterCalendars(events, calendars) {
  if (!calendars || calendars.length === 0) return events;
  const wanted = new Set(calendars.map(normalizeKey));
  return events.filter((event) => wanted.has(normalizeKey(event.calendar)));
}

// Every occurrence that overlaps the range, with recurring series expanded,
// cancelled events dropped and duplicates (same series, same start) removed.
// Each item gets `minutes`, the part of the event that falls inside the range.
export function eventsInRange(events, rangeStart, rangeEnd) {
  const seen = new Set();
  const items = [];
  const unsupported = [];
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    let spans = [{ start: event.start, end: event.end }];
    if (event.recurrence) {
      const expanded = expandOccurrences(event, rangeStart, rangeEnd);
      if (expanded.unsupported) unsupported.push({ title: event.title, reason: expanded.unsupported });
      else spans = expanded.occurrences;
    }
    for (const span of spans) {
      if (!overlaps(span.start, span.end, rangeStart, rangeEnd) && !(event.allDay && span.start.getTime() === span.end.getTime())) continue;
      const key = `${event.id}@${span.start.getTime()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        ...event,
        start: span.start,
        end: span.end,
        minutes: event.allDay ? 0 : overlapMinutes(span.start, span.end, rangeStart, rangeEnd),
      });
    }
  }
  items.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  return { items, unsupported };
}

function share(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function summarizeEvents(items) {
  const timed = items.filter((item) => !item.allDay);
  const allDay = items.filter((item) => item.allDay);
  const totalMinutes = timed.reduce((sum, item) => sum + item.minutes, 0);
  const calendars = new Map();
  const days = new Map();
  for (const item of timed) {
    const calendar = calendars.get(item.calendar) || { name: item.calendar, count: 0, minutes: 0 };
    calendar.count += 1;
    calendar.minutes += item.minutes;
    calendars.set(item.calendar, calendar);
    const dayKey = formatIsoDate(item.start);
    const day = days.get(dayKey) || { date: startOfDay(item.start), count: 0, minutes: 0, titles: [] };
    day.count += 1;
    day.minutes += item.minutes;
    day.titles.push(item.title);
    days.set(dayKey, day);
  }
  const byCalendar = [...calendars.values()]
    .map((calendar) => ({ ...calendar, share: share(calendar.minutes, totalMinutes) }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  const byDay = [...days.values()].sort((a, b) => a.date - b.date);
  const busiest = byDay.reduce((best, day) => (!best || day.minutes > best.minutes ? day : best), null);
  const longest = [...timed].sort((a, b) => b.minutes - a.minutes || a.start - b.start).slice(0, 5);
  return {
    count: timed.length,
    allDayCount: allDay.length,
    allDayTitles: allDay.map((item) => item.title),
    totalMinutes,
    byCalendar,
    byDay,
    busiest,
    longest,
  };
}

export function summarizeReminders(reminders, rangeStart, rangeEnd, now) {
  const completed = reminders
    .filter((item) => item.completed && item.completedAt && item.completedAt >= rangeStart && item.completedAt < rangeEnd)
    .sort((a, b) => a.completedAt - b.completedAt);
  const overdue = reminders
    .filter((item) => !item.completed && item.due && item.due < now)
    .map((item) => ({ ...item, daysOverdue: Math.max(0, daysBetween(item.due, now)) }))
    .sort((a, b) => a.due - b.due || a.title.localeCompare(b.title));
  const lists = new Map();
  for (const item of completed) lists.set(item.list, (lists.get(item.list) || 0) + 1);
  const completedByList = [...lists.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { completed, overdue, completedByList };
}

export function notesInRange(notes, rangeStart, rangeEnd, folder) {
  const wanted = folder ? normalizeKey(folder.split('/').pop()) : null;
  return notes
    .filter((note) => (!wanted || normalizeKey(note.folder.split('/').pop()) === wanted))
    .filter((note) => note.modifiedAt >= rangeStart && note.modifiedAt < rangeEnd)
    .sort((a, b) => b.modifiedAt - a.modifiedAt || a.title.localeCompare(b.title));
}

export function summarizeMail(messages, limit) {
  const sorted = [...messages].sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
  return { count: sorted.length, shown: sorted.slice(0, limit) };
}
