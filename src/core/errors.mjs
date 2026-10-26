// One error type with a stable code, so the shell wrapper, Shortcuts and launchd
// can react to the exit status without parsing messages.

export const EXIT_CODES = {
  ok: 0,
  internal: 1,
  usage: 2,
  permission: 3,
  notFound: 4,
  input: 5,
};

export class AwaError extends Error {
  constructor(code, message, hint) {
    super(message);
    this.name = 'AwaError';
    this.code = EXIT_CODES[code] === undefined ? 'internal' : code;
    this.hint = hint || '';
  }
}

export function usageError(message, hint) {
  return new AwaError('usage', message, hint);
}

export function exitCodeFor(error) {
  return error && error.code && EXIT_CODES[error.code] !== undefined ? EXIT_CODES[error.code] : EXIT_CODES.internal;
}

// Apple Events errors arrive as plain Error objects whose message carries the OSA code.
// -1743: the user has not allowed this host to control the app.
// -1728: the object (folder, list, note) does not exist.
// -1712: the app did not answer in time.
// -600: the app is not running and could not be launched.
export function translateAppError(appName, error) {
  if (error instanceof AwaError) return error;
  const message = String((error && error.message) || error || 'Unknown error');
  const settings = 'System Settings > Privacy & Security';
  if (/-1743|not authori[sz]ed|not allowed/i.test(message)) {
    return new AwaError(
      'permission',
      `macOS did not allow access to ${appName}.`,
      `Open ${settings} > Automation and allow your terminal (or Shortcuts) to control ${appName}. ` +
        'For Calendar and Reminders, also check the Calendars and Reminders panes. See docs/permissions.md.'
    );
  }
  if (/-1728|can.t get|doesn.t understand|invalid index/i.test(message)) {
    return new AwaError('notFound', `${appName} could not find the requested item.`, message);
  }
  if (/-1712|timed out|timeout/i.test(message)) {
    return new AwaError('internal', `${appName} did not answer in time.`, 'Open the app once, let it finish syncing, then retry.');
  }
  if (/-600|isn.t running|application can.t be found/i.test(message)) {
    return new AwaError('notFound', `${appName} is not available on this Mac.`, message);
  }
  return new AwaError('internal', `${appName}: ${message}`);
}

export function formatError(command, error) {
  const lines = [`awa ${command}: ${error.message}`];
  if (error.hint) lines.push(`hint: ${error.hint}`);
  return lines.join('\n');
}
