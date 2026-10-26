// The entry point every command shares: arguments in, one result out, a clean exit code.
// osascript prints whatever run() returns, so text goes out as the return value
// and errors go to stderr with an exit code from core/errors.mjs.

import { AwaError, exitCodeFor, formatError } from '../../core/errors.mjs';
import { helpText, normalizeOptions, parseArgv } from '../../core/options.mjs';
import { exitWith, writeStderr } from './io.mjs';
import { createSource, writer } from './source.mjs';

export function runCommand(command, argv, handler) {
  try {
    const raw = parseArgv(argv);
    if (raw.help === true || raw.help === 'true') return helpText(command);
    const options = normalizeOptions(command, raw);
    const source = createSource(options);
    const context = { options, source, write: writer(options), now: options.now || source.now || new Date() };
    const result = handler(context);
    if (options.json) return JSON.stringify({ ok: true, command, dryRun: options.dryRun, source: source.kind, ...result.data }, null, 2);
    return String(result.text).replace(/\s+$/, '');
  } catch (error) {
    const failure = error instanceof AwaError ? error : new AwaError('internal', String((error && error.message) || error));
    writeStderr(formatError(command, failure));
    exitWith(exitCodeFor(failure));
    return '';
  }
}
