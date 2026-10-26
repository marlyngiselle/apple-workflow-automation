// Calendar adapter, read only. Returns plain event records (see core/model.mjs).

import { normalizeKey } from '../../core/text.mjs';
import { guard, readAll, safe } from './apps.mjs';

function attendeesOf(event) {
  return safe(() => event.attendees(), []).map((person) => ({
    name: safe(() => person.displayName(), ''),
    email: safe(() => person.email(), ''),
    status: safe(() => person.participationStatus(), 'unknown'),
  }));
}

function collect(specifier, calendarName, withAttendees, out) {
  const ids = readAll(specifier, 'uid');
  if (!ids.length) return;
  const titles = readAll(specifier, 'summary');
  const starts = readAll(specifier, 'startDate');
  const ends = readAll(specifier, 'endDate');
  const allDay = readAll(specifier, 'alldayEvent');
  const locations = readAll(specifier, 'location');
  const urls = readAll(specifier, 'url');
  const notes = readAll(specifier, 'description');
  const recurrences = readAll(specifier, 'recurrence');
  const statuses = readAll(specifier, 'status');
  for (let i = 0; i < ids.length; i += 1) {
    out.push({
      id: ids[i],
      calendar: calendarName,
      title: titles[i],
      start: starts[i],
      end: ends[i],
      allDay: allDay[i],
      location: locations[i],
      url: urls[i],
      notes: notes[i],
      recurrence: recurrences[i],
      status: statuses[i],
      attendees: withAttendees ? attendeesOf(specifier[i]) : [],
    });
  }
}

// Events overlapping the range, plus every recurring series that started before
// the range ends. The core expands the series; Calendar only returns their first occurrence.
export function readEvents(range, options = {}) {
  const wanted = (options.calendars || []).map(normalizeKey);
  return guard('Calendar', (Calendar) => {
    const out = [];
    for (const calendar of Calendar.calendars()) {
      const name = calendar.name();
      if (wanted.length && !wanted.includes(normalizeKey(name))) continue;
      collect(
        calendar.events.whose({ _and: [{ startDate: { _lessThan: range.end } }, { endDate: { _greaterThan: range.start } }] }),
        name,
        options.withAttendees,
        out
      );
      // Some Calendar versions reject a filter on recurrence; the range query above still stands.
      safe(() => {
        const recurring = calendar.events.whose({ _and: [{ startDate: { _lessThan: range.end } }, { recurrence: { _beginsWith: 'FREQ' } }] });
        collect(recurring, name, options.withAttendees, out);
      }, null);
    }
    return out;
  });
}
