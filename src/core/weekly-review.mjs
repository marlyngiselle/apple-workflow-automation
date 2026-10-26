// weekly-review: one note per ISO week that sums up Calendar, Reminders, Notes and,
// if asked, flagged Mail. Re-running the same week rebuilds the facts and keeps
// whatever was written under the Reflection heading.

import { formatDayLabel, formatDateTime, formatDuration, formatRangeLabel } from './dates.mjs';
import { eventsInRange, filterCalendars, notesInRange, summarizeEvents, summarizeMail, summarizeReminders } from './aggregate.mjs';
import { senderName } from './model.mjs';
import { toHtml, toMarkdown } from './render.mjs';
import { plural, truncate } from './text.mjs';

export const REFLECTION_HEADING = 'Reflection';
export const REFLECTION_PROMPTS = ['What moved forward?', 'What got in the way?', 'Top three for next week:'];

export function weeklyReviewTitle(range, prefix) {
  return `${prefix || 'Weekly review'} ${range.key}`;
}

function dayLine(day) {
  const titles = day.titles.slice(0, 6).map((title) => truncate(title, 40));
  const more = day.titles.length > 6 ? `, +${day.titles.length - 6} more` : '';
  return {
    strong: `${formatDayLabel(day.date)}:`,
    text: `${plural(day.count, 'event')}, ${formatDuration(day.minutes)}. ${titles.join(', ')}${more}`,
  };
}

export function buildWeeklyReview(input, options) {
  const { range, now } = options;
  const title = weeklyReviewTitle(range, options.titlePrefix);
  const scoped = filterCalendars(input.events, options.calendars);
  const { items, unsupported } = eventsInRange(scoped, range.start, range.end);
  const calendar = summarizeEvents(items);
  const reminders = summarizeReminders(input.reminders, range.start, range.end, now);
  const notes = options.sourceFolder ? notesInRange(input.notes, range.start, range.end, options.sourceFolder) : [];
  const mail = options.includeMail ? summarizeMail(input.mail, options.mailLimit || 10) : null;

  const doc = [
    { type: 'h1', text: title },
    { type: 'p', text: formatRangeLabel(range.start, range.end) },
    {
      type: 'ul',
      items: [
        { strong: 'Meetings and blocks:', text: `${calendar.count}, ${formatDuration(calendar.totalMinutes)} scheduled` },
        { strong: 'Reminders done:', text: String(reminders.completed.length) },
        { strong: 'Overdue:', text: String(reminders.overdue.length) },
        ...(options.sourceFolder ? [{ strong: 'Notes touched:', text: `${notes.length} in ${options.sourceFolder}` }] : []),
        ...(mail ? [{ strong: 'Flagged mail:', text: String(mail.count) }] : []),
      ],
    },
    { type: 'h2', text: 'Calendar' },
  ];

  if (calendar.count === 0 && calendar.allDayCount === 0) {
    doc.push({ type: 'p', text: 'No events this week.' });
  } else {
    doc.push({ type: 'h3', text: 'Time by calendar' });
    doc.push({
      type: 'table',
      head: ['Calendar', 'Events', 'Time', 'Share'],
      rows: calendar.byCalendar.map((row) => [row.name, String(row.count), formatDuration(row.minutes), `${row.share}%`]),
      items: calendar.byCalendar.map((row) => `${row.name}: ${plural(row.count, 'event')}, ${formatDuration(row.minutes)} (${row.share}%)`),
    });
    doc.push({ type: 'h3', text: 'Day by day' });
    doc.push({ type: 'ul', items: calendar.byDay.map(dayLine) });
    if (calendar.longest.length) {
      doc.push({ type: 'h3', text: 'Longest blocks' });
      doc.push({
        type: 'ul',
        items: calendar.longest.map((item) => `${item.title} (${formatDayLabel(item.start)}, ${formatDuration(item.minutes)})`),
      });
    }
    if (calendar.allDayCount) {
      doc.push({ type: 'h3', text: 'All-day' });
      doc.push({ type: 'ul', items: calendar.allDayTitles });
    }
    if (unsupported.length) {
      doc.push({ type: 'p', text: `Repeat rule not expanded, first occurrence only: ${unsupported.map((item) => item.title).join(', ')}` });
    }
  }

  doc.push({ type: 'h2', text: 'Reminders' });
  doc.push({ type: 'h3', text: `Completed (${reminders.completed.length})` });
  doc.push(
    reminders.completed.length
      ? { type: 'ul', items: reminders.completed.map((item) => `${item.title} (${item.list}, ${formatDayLabel(item.completedAt)})`) }
      : { type: 'p', text: 'Nothing completed this week.' }
  );
  doc.push({ type: 'h3', text: `Overdue (${reminders.overdue.length})` });
  doc.push(
    reminders.overdue.length
      ? {
          type: 'ul',
          items: reminders.overdue.map((item) => `${item.title} (${item.list}, due ${formatDayLabel(item.due)}, ${plural(item.daysOverdue, 'day')} late)`),
        }
      : { type: 'p', text: 'Nothing overdue.' }
  );

  if (options.sourceFolder) {
    doc.push({ type: 'h2', text: `Notes in ${options.sourceFolder}` });
    doc.push(
      notes.length
        ? { type: 'ul', items: notes.map((note) => `${note.title} (${formatDayLabel(note.modifiedAt)})`) }
        : { type: 'p', text: 'No notes changed this week.' }
    );
  }

  if (mail) {
    doc.push({ type: 'h2', text: 'Flagged mail' });
    doc.push(
      mail.count
        ? {
            type: 'ul',
            items: mail.shown.map((message) => `${truncate(message.subject, 70)} (${senderName(message.sender) || 'unknown sender'})`),
          }
        : { type: 'p', text: 'No flagged messages.' }
    );
    if (mail.count > mail.shown.length) doc.push({ type: 'p', text: `And ${mail.count - mail.shown.length} more in Mail.` });
  }

  doc.push({ type: 'p', text: `Updated by awa weekly-review on ${formatDateTime(now)}. Re-running it refreshes everything above ${REFLECTION_HEADING} and keeps what you write below it.` });
  doc.push({ type: 'h2', text: REFLECTION_HEADING });
  doc.push({ type: 'ul', items: REFLECTION_PROMPTS });

  const stats = {
    week: range.key,
    events: calendar.count,
    allDayEvents: calendar.allDayCount,
    scheduledMinutes: calendar.totalMinutes,
    remindersCompleted: reminders.completed.length,
    remindersOverdue: reminders.overdue.length,
    notesTouched: notes.length,
    flaggedMail: mail ? mail.count : null,
  };
  return { title, stats, doc, html: toHtml(doc), markdown: toMarkdown(doc) };
}

// Keeps what the user wrote under the Reflection heading when the note is rebuilt.
// Notes rewrites the HTML it is given (headings can come back as <div><b>...</b></div>),
// so the heading is found by its text, and every closing tag right after it is kept with it.
export function mergeReflection(existingHtml, freshHtml) {
  const heading = new RegExp(`>\\s*${REFLECTION_HEADING}\\s*<\\/[a-z0-9]+>(?:\\s*<\\/[a-z0-9]+>)*`, 'i');
  const oldMatch = heading.exec(existingHtml || '');
  const newMatch = heading.exec(freshHtml);
  if (!oldMatch || !newMatch) return freshHtml;
  const kept = existingHtml.slice(oldMatch.index + oldMatch[0].length);
  if (!kept.replace(/<[^>]+>/g, '').trim()) return freshHtml;
  return freshHtml.slice(0, newMatch.index + newMatch[0].length) + kept;
}
