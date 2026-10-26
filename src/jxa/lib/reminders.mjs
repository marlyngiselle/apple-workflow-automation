// Reminders adapter. Reads lists and reminders; writes only in createReminder().

import { AwaError } from '../../core/errors.mjs';
import { normalizeKey } from '../../core/text.mjs';
import { guard, readAll, safe } from './apps.mjs';

function records(specifier, listName, completed) {
  const ids = readAll(specifier, 'id');
  const names = readAll(specifier, 'name');
  const due = readAll(specifier, 'dueDate');
  const done = completed ? readAll(specifier, 'completionDate') : [];
  const priority = readAll(specifier, 'priority');
  return ids.map((id, i) => ({
    id,
    list: listName,
    title: names[i],
    due: due[i] || null,
    completed,
    completedAt: completed ? done[i] || null : null,
    priority: priority[i] || 0,
  }));
}

export function listNames() {
  return guard('Reminders', (Reminders) => Reminders.lists().map((list) => list.name()));
}

export function defaultListName() {
  return guard('Reminders', (Reminders) => safe(() => Reminders.defaultList().name(), null) || listNames()[0] || null);
}

// Completed inside the range, plus every open reminder (the core decides what is overdue).
export function readReminders(range) {
  return guard('Reminders', (Reminders) => {
    const out = [];
    for (const list of Reminders.lists()) {
      const name = list.name();
      out.push(...records(list.reminders.whose({ _and: [{ completed: true }, { completionDate: { _greaterThanEquals: range.start } }] }), name, true));
      out.push(...records(list.reminders.whose({ completed: false }), name, false));
    }
    return out;
  });
}

export function openTitlesByList() {
  return guard('Reminders', (Reminders) => {
    const out = {};
    for (const list of Reminders.lists()) out[list.name()] = readAll(list.reminders.whose({ completed: false }), 'name');
    return out;
  });
}

export function createReminder(item) {
  return guard('Reminders', (Reminders) => {
    const list = Reminders.lists().find((candidate) => normalizeKey(candidate.name()) === normalizeKey(item.list));
    if (!list) throw new AwaError('notFound', `Reminders has no list named "${item.list}".`, 'Create the list in Reminders, or pass --list with an existing one.');
    const properties = { name: item.title };
    if (item.notes) properties.body = item.notes;
    if (item.priority) properties.priority = item.priority;
    const reminder = Reminders.Reminder(properties);
    list.reminders.push(reminder);
    if (item.due) reminder.dueDate = item.due;
    return safe(() => reminder.id(), '');
  });
}
