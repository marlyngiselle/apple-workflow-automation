// File and process IO through the Objective-C bridge. No app is involved,
// so nothing here triggers an Automation prompt.

import { AwaError } from '../../core/errors.mjs';

let loaded = false;

function bridge() {
  if (!loaded) {
    ObjC.import('Foundation');
    ObjC.import('stdlib');
    loaded = true;
  }
}

function expand(path) {
  bridge();
  return $(String(path)).stringByStandardizingPath.js;
}

export function readText(path) {
  bridge();
  const error = $();
  const contents = $.NSString.stringWithContentsOfFileEncodingError(expand(path), $.NSUTF8StringEncoding, error);
  if (contents.isNil()) throw new AwaError('input', `Cannot read ${path}.`, 'Check the path and that the file is UTF-8 text.');
  return contents.js;
}

export function readJson(path) {
  const text = readText(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AwaError('input', `${path} is not valid JSON: ${error.message}`);
  }
}

export function writeText(path, text) {
  bridge();
  const ok = $(String(text)).writeToFileAtomicallyEncodingError(expand(path), true, $.NSUTF8StringEncoding, null);
  if (!ok) throw new AwaError('input', `Cannot write ${path}.`, 'Check that the folder exists and is writable.');
}

export function writeStderr(text) {
  bridge();
  const data = $(`${text}\n`).dataUsingEncoding($.NSUTF8StringEncoding);
  $.NSFileHandle.fileHandleWithStandardError.writeData(data);
}

export function exitWith(code) {
  bridge();
  $.exit(code);
}
