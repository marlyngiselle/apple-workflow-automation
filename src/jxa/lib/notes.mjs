// Notes adapter. Reads folders and notes; writes only through upsertNote() and setBody().

import { AwaError } from '../../core/errors.mjs';
import { guard, readAll } from './apps.mjs';

function first(specifier) {
  return readAll(specifier, 'id').length ? specifier[0] : null;
}

function container(Notes, account) {
  if (!account) return null;
  const found = first(Notes.accounts.whose({ name: account }));
  if (!found) throw new AwaError('notFound', `Notes has no account named "${account}".`, `Accounts: ${Notes.accounts.name().join(', ')}`);
  return found;
}

// "Work/Reviews" walks nested folders. With create, missing folders are made
// in the given account, or in the default account.
function resolveFolder(Notes, path, account, create) {
  const parts = String(path).split('/').map((part) => part.trim()).filter(Boolean);
  let parent = container(Notes, account);
  let folder = null;
  for (const part of parts) {
    const scope = parent ? parent.folders : Notes.folders;
    folder = first(scope.whose({ name: part }));
    if (!folder) {
      if (!create) throw new AwaError('notFound', `Notes has no folder "${path}".`, 'Check the name, or pass --account if it lives in another account.');
      const made = Notes.Folder({ name: part });
      (parent || Notes.defaultAccount()).folders.push(made);
      folder = first((parent || Notes.defaultAccount()).folders.whose({ name: part }));
    }
    parent = folder;
  }
  return folder;
}

export function readFolderNotes(path, account) {
  return guard('Notes', (Notes) => {
    const folder = resolveFolder(Notes, path, account, false);
    const ids = readAll(folder.notes, 'id');
    const names = readAll(folder.notes, 'name');
    const modified = readAll(folder.notes, 'modificationDate');
    return ids.map((id, i) => ({ id, folder: path, title: names[i], modifiedAt: modified[i] }));
  });
}

export function findNote(title, path, account) {
  return guard('Notes', (Notes) => {
    const scope = path ? resolveFolder(Notes, path, account, false).notes : (container(Notes, account) || Notes).notes;
    const note = first(scope.whose({ name: title }));
    if (!note) return null;
    return { id: note.id(), title: note.name(), body: note.body(), modifiedAt: note.modificationDate() };
  });
}

// Updates the note with this title in the folder, or creates it. merge(oldBody, newBody)
// decides what survives from the old body. Returns 'created' or 'updated'.
export function upsertNote(path, account, title, html, merge) {
  return guard('Notes', (Notes) => {
    const folder = resolveFolder(Notes, path, account, true);
    const existing = first(folder.notes.whose({ name: title }));
    if (existing) {
      existing.body = merge ? merge(existing.body(), html) : html;
      return { action: 'updated', id: existing.id() };
    }
    const note = Notes.Note({ body: html });
    folder.notes.push(note);
    return { action: 'created', id: note.id() };
  });
}

export function createNoteIfMissing(path, account, title, html) {
  return guard('Notes', (Notes) => {
    const folder = resolveFolder(Notes, path, account, true);
    const existing = first(folder.notes.whose({ name: title }));
    if (existing) return { action: 'exists', id: existing.id() };
    const note = Notes.Note({ body: html });
    folder.notes.push(note);
    return { action: 'created', id: note.id() };
  });
}

export function setBody(id, html) {
  return guard('Notes', (Notes) => {
    Notes.notes.byId(id).body = html;
  });
}
