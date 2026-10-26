// awa inbox-to-reminders: lines of a quick-capture note become reminders.

import { AwaError } from '../../core/errors.mjs';
import { formatDateTime } from '../../core/dates.mjs';
import { clearedInboxHtml, planInbox } from '../../core/inbox.mjs';
import { runCommand } from '../lib/runtime.mjs';

function describe(item) {
  const due = item.due ? `, due ${formatDateTime(item.due)}` : '';
  const priority = item.priority ? `, priority ${item.priority}` : '';
  return `${item.title} (${item.list}${due}${priority})`;
}

function inboxToReminders({ options, source, write, now }) {
  const note = source.findNote(options.note, options.folder, options.account);
  if (!note) {
    throw new AwaError('notFound', `No note titled "${options.note}"${options.folder ? ` in ${options.folder}` : ''}.`, 'Create it in Notes, or pass --note with the title of your capture note.');
  }
  const lists = source.reminderLists();
  const plan = planInbox({
    body: note.body,
    now,
    lists,
    defaultList: options.list || source.defaultList(),
    openTitles: source.openTitles(),
    defaultTime: options.defaultTime,
  });
  const data = {
    note: plan.noteTitle,
    create: plan.create,
    duplicates: plan.duplicates,
    warnings: plan.warnings,
    cleared: false,
  };
  const lines = [
    ...plan.create.map((item) => `${options.dryRun ? 'would add' : 'added    '} ${describe(item)}`),
    ...plan.duplicates.map((item) => `skipped   ${describe(item)}, already open`),
    ...plan.warnings.map((warning) => `warning   ${warning}`),
  ];
  if (!options.dryRun) {
    for (const item of plan.create) write.createReminder(item);
    if (options.clear) {
      write.setBody(note.id, clearedInboxHtml(plan.noteTitle, plan.keep));
      data.cleared = true;
    }
  }
  const head = `${plan.create.length} to add, ${plan.duplicates.length} already open${data.cleared ? ', note cleared' : ''}.`;
  return { text: [head, ...lines].join('\n'), data };
}

export function main(argv) {
  return runCommand('inbox-to-reminders', argv, inboxToReminders);
}
