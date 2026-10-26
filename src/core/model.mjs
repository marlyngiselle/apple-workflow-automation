// The plain records every command works on. The JXA adapters produce them from the apps,
// and --input produces them from a JSON snapshot, so the logic never knows the difference.

import { toDate } from './dates.mjs';
import { AwaError } from './errors.mjs';

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

function required(value, what) {
  const date = toDate(value);
  if (!date) throw new AwaError('input', `Missing ${what}.`);
  return date;
}

export function normalizeEvent(raw) {
  const start = required(raw.start, `start for event "${text(raw.title)}"`);
  const end = toDate(raw.end) || start;
  return {
    id: text(raw.id) || `${text(raw.calendar)}:${text(raw.title)}:${start.getTime()}`,
    calendar: text(raw.calendar) || '(no calendar)',
    title: text(raw.title).trim() || '(untitled)',
    start,
    end: end.getTime() < start.getTime() ? start : end,
    allDay: Boolean(raw.allDay),
    location: text(raw.location),
    url: text(raw.url),
    notes: text(raw.notes),
    recurrence: text(raw.recurrence),
    status: text(raw.status || 'confirmed').toLowerCase(),
    attendees: Array.isArray(raw.attendees)
      ? raw.attendees.map((person) => ({
          name: text(person.name).trim(),
          email: text(person.email).trim().replace(/^mailto:/i, ''),
          status: text(person.status || 'unknown').toLowerCase(),
        }))
      : [],
  };
}

export function normalizeReminder(raw) {
  return {
    id: text(raw.id) || `${text(raw.list)}:${text(raw.title)}`,
    list: text(raw.list) || 'Reminders',
    title: text(raw.title).trim() || '(untitled)',
    due: toDate(raw.due),
    completed: Boolean(raw.completed),
    completedAt: toDate(raw.completedAt),
    priority: Number(raw.priority) || 0,
    notes: text(raw.notes),
  };
}

export function normalizeNote(raw) {
  return {
    id: text(raw.id) || text(raw.title),
    folder: text(raw.folder),
    title: text(raw.title).trim() || '(untitled)',
    modifiedAt: required(raw.modifiedAt, `modifiedAt for note "${text(raw.title)}"`),
    body: text(raw.body),
  };
}

export function normalizeMessage(raw) {
  return {
    subject: text(raw.subject).trim() || '(no subject)',
    sender: text(raw.sender).trim(),
    receivedAt: toDate(raw.receivedAt),
    mailbox: text(raw.mailbox) || 'Inbox',
  };
}

// "Ada Example <ada@example.com>" -> "Ada Example". Only the display name goes into a note.
export function senderName(sender) {
  const value = text(sender).trim();
  const named = /^"?([^"<]+?)"?\s*<[^>]+>$/.exec(value);
  if (named) return named[1].trim();
  return value.replace(/^<|>$/g, '');
}

function list(json, key, normalize) {
  const value = json[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new AwaError('input', `Snapshot field "${key}" must be an array.`);
  return value.map((item, index) => {
    try {
      return normalize(item);
    } catch (error) {
      throw new AwaError('input', `Snapshot ${key}[${index}]: ${error.message}`);
    }
  });
}

// The --input file format. Every field is optional; see tests/fixtures for a full example.
export function normalizeSnapshot(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new AwaError('input', 'Snapshot must be a JSON object.');
  return {
    now: toDate(json.now),
    events: list(json, 'events', normalizeEvent),
    reminders: list(json, 'reminders', normalizeReminder),
    notes: list(json, 'notes', normalizeNote),
    mail: list(json, 'mail', normalizeMessage),
    reminderLists: Array.isArray(json.reminderLists) ? json.reminderLists.map(text) : [],
  };
}
