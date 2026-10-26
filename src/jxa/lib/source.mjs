// Where the records come from: the live apps, or a JSON snapshot given with --input.
// Both return the same normalized shapes, so commands do not care which one they get.

import { AwaError } from '../../core/errors.mjs';
import { normalizeEvent, normalizeMessage, normalizeNote, normalizeReminder, normalizeSnapshot } from '../../core/model.mjs';
import { normalizeKey } from '../../core/text.mjs';
import * as calendar from './calendar.mjs';
import { readJson } from './io.mjs';
import * as mail from './mail.mjs';
import * as notes from './notes.mjs';
import * as reminders from './reminders.mjs';

function liveSource() {
  return {
    kind: 'apps',
    now: null,
    events: (range, options) => calendar.readEvents(range, options).map(normalizeEvent),
    reminders: (range) => reminders.readReminders(range).map(normalizeReminder),
    reminderLists: () => reminders.listNames(),
    defaultList: () => reminders.defaultListName(),
    openTitles: () => reminders.openTitlesByList(),
    folderNotes: (path, account) => notes.readFolderNotes(path, account).map(normalizeNote),
    findNote: (title, path, account) => notes.findNote(title, path, account),
    flaggedMail: () => mail.readFlagged().map(normalizeMessage),
  };
}

function snapshotSource(path) {
  const snapshot = normalizeSnapshot(readJson(path));
  const inFolder = (note, path) => !path || normalizeKey(note.folder.split('/').pop()) === normalizeKey(String(path).split('/').pop());
  return {
    kind: 'snapshot',
    now: snapshot.now,
    events: () => snapshot.events,
    reminders: () => snapshot.reminders,
    reminderLists: () => (snapshot.reminderLists.length ? snapshot.reminderLists : [...new Set(snapshot.reminders.map((item) => item.list))]),
    defaultList: () => snapshot.reminderLists[0] || 'Reminders',
    openTitles: () => {
      const out = {};
      for (const item of snapshot.reminders.filter((reminder) => !reminder.completed)) (out[item.list] = out[item.list] || []).push(item.title);
      return out;
    },
    folderNotes: (path) => snapshot.notes.filter((note) => inFolder(note, path)),
    findNote: (title, path) => snapshot.notes.find((note) => note.title === title && inFolder(note, path)) || null,
    flaggedMail: () => snapshot.mail,
  };
}

export function createSource(options) {
  return options.input ? snapshotSource(options.input) : liveSource();
}

// Writes go through here so a dry run or a snapshot run can never reach an app.
export function writer(options) {
  const refuse = () => {
    throw new AwaError('internal', 'Refusing to write during a dry run.');
  };
  if (options.dryRun || options.input) {
    return { upsertNote: refuse, createNoteIfMissing: refuse, setBody: refuse, createReminder: refuse };
  }
  return {
    upsertNote: notes.upsertNote,
    createNoteIfMissing: notes.createNoteIfMissing,
    setBody: notes.setBody,
    createReminder: reminders.createReminder,
  };
}
