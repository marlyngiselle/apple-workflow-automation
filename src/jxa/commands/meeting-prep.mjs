// awa meeting-prep: a prep note for each meeting starting in the next few hours.

import { addMinutes } from '../../core/dates.mjs';
import { buildMeetingPrep, upcomingMeetings } from '../../core/meeting-prep.mjs';
import { runCommand } from '../lib/runtime.mjs';

function meetingPrep({ options, source, write, now }) {
  const range = { start: now, end: addMinutes(now, options.hours * 60) };
  const events = source.events(range, { calendars: options.calendars, withAttendees: true });
  const meetings = upcomingMeetings(events, now, options.hours, options).filter((event) => event.attendees.length >= options.minAttendees);
  const preps = meetings.map(buildMeetingPrep);
  const data = { folder: options.folder, hours: options.hours, meetings: preps.map((prep) => ({ title: prep.title, ...prep.event })) };
  if (!preps.length) return { text: `No meetings in the next ${options.hours} hours.`, data: { ...data, created: 0 } };
  if (options.dryRun) {
    const body = preps.map((prep) => (options.format === 'html' ? prep.html : prep.markdown));
    return { text: body.join(options.format === 'html' ? '\n' : '\n---\n\n'), data };
  }
  const results = preps.map((prep) => ({ title: prep.title, action: write.createNoteIfMissing(options.folder, options.account, prep.title, prep.html).action }));
  const created = results.filter((result) => result.action === 'created').length;
  const lines = results.map((result) => `${result.action === 'created' ? 'created' : 'kept   '} ${result.title}`);
  return {
    text: [`${created} prep notes created in ${options.folder}, ${results.length - created} already there.`, ...lines].join('\n'),
    data: { ...data, created, results },
  };
}

export function main(argv) {
  return runCommand('meeting-prep', argv, meetingPrep);
}
