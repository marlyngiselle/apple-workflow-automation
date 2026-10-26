// awa weekly-review: the week's calendar, reminders, notes and flagged mail in one note.

import { resolveWeek } from '../../core/dates.mjs';
import { buildWeeklyReview, mergeReflection } from '../../core/weekly-review.mjs';
import { runCommand } from '../lib/runtime.mjs';

function weeklyReview({ options, source, write, now }) {
  const range = resolveWeek(options.week, now);
  const input = {
    events: source.events(range, { calendars: options.calendars }),
    reminders: source.reminders(range),
    notes: options.sourceFolder ? source.folderNotes(options.sourceFolder, options.account) : [],
    mail: options.includeMail ? source.flaggedMail() : [],
  };
  const review = buildWeeklyReview(input, { ...options, range, now });
  const data = { title: review.title, folder: options.folder, stats: review.stats };
  if (options.dryRun) {
    return {
      text: options.format === 'html' ? review.html : review.markdown,
      data: { ...data, action: 'none', html: review.html, markdown: review.markdown },
    };
  }
  const saved = write.upsertNote(options.folder, options.account, review.title, review.html, mergeReflection);
  const s = review.stats;
  return {
    text: `${saved.action === 'created' ? 'Created' : 'Updated'} "${review.title}" in ${options.folder}: ${s.events} events, ${s.remindersCompleted} reminders done, ${s.remindersOverdue} overdue.`,
    data: { ...data, action: saved.action },
  };
}

export function main(argv) {
  return runCommand('weekly-review', argv, weeklyReview);
}
