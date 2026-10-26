// meeting-prep: one prep note per upcoming meeting, with who is coming, the links
// already sitting in the invite, and a short agenda skeleton to fill in.

import { addMinutes, formatDayLabel, formatDuration, formatIsoDate, formatTime } from './dates.mjs';
import { eventsInRange, filterCalendars } from './aggregate.mjs';
import { toHtml, toMarkdown } from './render.mjs';
import { extractLinks, isCallLink, plural, truncate } from './text.mjs';

const STATUS_LABELS = { accepted: 'accepted', declined: 'declined', tentative: 'maybe', undecided: 'no answer yet', unknown: 'no answer yet' };

export function upcomingMeetings(events, now, hours, options = {}) {
  const end = addMinutes(now, hours * 60);
  const scoped = filterCalendars(events, options.calendars);
  return eventsInRange(scoped, now, end)
    .items.filter((event) => options.includeAllDay || !event.allDay)
    .filter((event) => event.start >= now || options.includeStarted);
}

export function meetingPrepTitle(event) {
  return `Prep ${formatIsoDate(event.start)} ${formatTime(event.start)} ${truncate(event.title, 60)}`;
}

function attendeeLine(person) {
  const who = person.name && person.email && person.name !== person.email ? `${person.name} (${person.email})` : person.name || person.email;
  return `${who}, ${STATUS_LABELS[person.status] || person.status}`;
}

export function buildMeetingPrep(event) {
  const title = meetingPrepTitle(event);
  const links = extractLinks(event.url, event.location, event.notes);
  const callLinks = links.filter(isCallLink);
  const otherLinks = links.filter((url) => !isCallLink(url));
  const declined = event.attendees.filter((person) => person.status === 'declined').length;

  const when = event.allDay
    ? `${formatDayLabel(event.start)}, all day`
    : `${formatDayLabel(event.start)}, ${formatTime(event.start)} to ${formatTime(event.end)} (${formatDuration((event.end - event.start) / 60000)})`;

  const doc = [
    { type: 'h1', text: title },
    {
      type: 'ul',
      items: [
        { strong: 'When:', text: when },
        { strong: 'Calendar:', text: event.calendar },
        ...(event.location && !isCallLink(event.location) ? [{ strong: 'Where:', text: event.location }] : []),
        ...(callLinks.length ? [{ strong: 'Join:', text: callLinks[0] }] : []),
      ],
    },
    { type: 'h2', text: `Attendees (${event.attendees.length})` },
    event.attendees.length
      ? { type: 'ul', items: event.attendees.map(attendeeLine) }
      : { type: 'p', text: 'No attendees on the invite.' },
  ];
  if (declined) doc.push({ type: 'p', text: `${plural(declined, 'person has', 'people have')} declined.` });

  doc.push({ type: 'h2', text: 'Links from the invite' });
  doc.push(
    links.length
      ? { type: 'ul', items: [...callLinks, ...otherLinks].map((url) => ({ text: truncate(url, 80), href: url })) }
      : { type: 'p', text: 'No links in the invite.' }
  );
  doc.push({ type: 'h2', text: 'Agenda' });
  doc.push({ type: 'ul', items: ['Goal of this meeting:', 'Decisions needed:', 'Open questions:'] });
  doc.push({ type: 'h2', text: 'Notes' });
  doc.push({ type: 'ul', items: ['Action items:'] });

  return {
    title,
    event: { title: event.title, calendar: event.calendar, start: event.start, end: event.end, attendees: event.attendees.length, links: links.length },
    doc,
    html: toHtml(doc),
    markdown: toMarkdown(doc),
  };
}
