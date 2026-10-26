// Command-line options. bin/awa sends them as one JSON object; running a dist script
// directly with osascript also accepts --flags. Both end up in normalizeOptions.

import { parseLocalDate, resolveWeek, toDate } from './dates.mjs';
import { usageError } from './errors.mjs';
import { parseTimeOfDay } from './inbox.mjs';

const COMMON = {
  dryRun: { type: 'boolean', default: false, help: 'Print what would be written, change nothing' },
  json: { type: 'boolean', default: false, help: 'Print a JSON result instead of text' },
  now: { type: 'datetime', default: null, help: 'Pretend the current time is this ISO date-time' },
  input: { type: 'string', default: null, help: 'Read a JSON snapshot instead of the apps (implies --dry-run)' },
  help: { type: 'boolean', default: false, help: 'Show this help' },
};

export const COMMANDS = {
  'weekly-review': {
    summary: 'Build or refresh the weekly review note for an ISO week',
    options: {
      folder: { type: 'string', default: 'Reviews', help: 'Notes folder for the review ("Parent/Child" for nested)' },
      account: { type: 'string', default: null, help: 'Notes account (default: the default account)' },
      week: { type: 'week', default: 'this', help: 'this, last, next, or an ISO week like 2026-W43' },
      sourceFolder: { type: 'string', default: null, help: 'Notes folder whose changes this week are listed' },
      calendars: { type: 'list', default: [], help: 'Only these calendars (comma separated)' },
      includeMail: { type: 'boolean', default: false, help: 'Add flagged Inbox messages (read only)' },
      mailLimit: { type: 'integer', default: 10, min: 1, max: 100, help: 'Flagged messages to list' },
      titlePrefix: { type: 'string', default: 'Weekly review', help: 'Note title before the week key' },
      format: { type: 'enum', values: ['markdown', 'html'], default: 'markdown', help: 'Dry-run output format' },
    },
  },
  'meeting-prep': {
    summary: 'Create a prep note for each meeting in the next hours',
    options: {
      hours: { type: 'integer', default: 4, min: 1, max: 168, help: 'Look-ahead window in hours' },
      folder: { type: 'string', default: 'Meeting prep', help: 'Notes folder for prep notes' },
      account: { type: 'string', default: null, help: 'Notes account (default: the default account)' },
      calendars: { type: 'list', default: [], help: 'Only these calendars (comma separated)' },
      includeAllDay: { type: 'boolean', default: false, help: 'Also prepare all-day events' },
      minAttendees: { type: 'integer', default: 0, min: 0, max: 1000, help: 'Skip events with fewer attendees' },
      format: { type: 'enum', values: ['markdown', 'html'], default: 'markdown', help: 'Dry-run output format' },
    },
  },
  'inbox-to-reminders': {
    summary: 'Turn the lines of a quick-capture note into reminders',
    options: {
      note: { type: 'string', default: 'Inbox', help: 'Title of the capture note' },
      folder: { type: 'string', default: null, help: 'Only look for the note in this folder' },
      account: { type: 'string', default: null, help: 'Notes account (default: all accounts)' },
      list: { type: 'string', default: null, help: 'Default Reminders list (default: the app default)' },
      defaultTime: { type: 'time', default: '09:00', help: 'Time for dates given without one' },
      clear: { type: 'boolean', default: false, help: 'Remove processed lines from the note afterwards' },
    },
  },
  'focus-report': {
    summary: 'Time per calendar or #tag over a date range, as Markdown, CSV or JSON',
    options: {
      from: { type: 'date', default: null, help: 'First day, YYYY-MM-DD (default: 6 days before --to)' },
      to: { type: 'date', default: null, help: 'Last day, inclusive, YYYY-MM-DD (default: today)' },
      groupBy: { type: 'enum', values: ['calendar', 'tag'], default: 'calendar', help: 'Group by calendar or by #tag' },
      calendars: { type: 'list', default: [], help: 'Only these calendars (comma separated)' },
      format: { type: 'enum', values: ['markdown', 'csv', 'json'], default: 'markdown', help: 'Output format' },
      output: { type: 'string', default: null, help: 'Write to this file instead of printing' },
    },
  },
};

export function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function camel(flag) {
  return flag.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

// ["--folder", "Reviews", "--dry-run"] -> { folder: "Reviews", dryRun: true }
// A single argument that starts with "{" is read as the JSON object bin/awa sends.
export function parseArgv(argv) {
  const args = Array.isArray(argv) ? argv.map(String) : [];
  if (args.length === 1 && args[0].trim().startsWith('{')) {
    try {
      return JSON.parse(args[0]);
    } catch (error) {
      throw usageError(`Arguments are not valid JSON: ${error.message}`);
    }
  }
  const raw = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--') || arg === '--') throw usageError(`Unexpected argument "${arg}".`, 'Options look like --name value or --flag.');
    const eq = arg.indexOf('=');
    if (eq > 0) {
      raw[camel(arg.slice(0, eq))] = arg.slice(eq + 1);
    } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      raw[camel(arg)] = args[i + 1];
      i += 1;
    } else {
      raw[camel(arg)] = true;
    }
  }
  return raw;
}

function closest(name, candidates) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const best = candidates.map((candidate) => [candidate, distance(name, candidate)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 3 ? best[0] : null;
}

function coerce(name, spec, value) {
  const flag = `--${kebab(name)}`;
  if (value === null || value === undefined) return spec.default;
  switch (spec.type) {
    case 'boolean':
      if (value === true || value === 'true' || value === '1' || value === 'yes') return true;
      if (value === false || value === 'false' || value === '0' || value === 'no') return false;
      throw usageError(`${flag} is a switch and takes no value (got "${value}").`);
    case 'string': {
      const text = String(value).trim();
      if (!text || value === true) throw usageError(`${flag} needs a value.`);
      return text;
    }
    case 'integer': {
      const number = Number(value);
      if (!Number.isInteger(number) || number < spec.min || number > spec.max) {
        throw usageError(`${flag} must be a whole number from ${spec.min} to ${spec.max} (got "${value}").`);
      }
      return number;
    }
    case 'enum':
      if (!spec.values.includes(String(value))) throw usageError(`${flag} must be one of ${spec.values.join(', ')} (got "${value}").`);
      return String(value);
    case 'list':
      return (Array.isArray(value) ? value : String(value).split(',')).map((item) => String(item).trim()).filter(Boolean);
    case 'date': {
      const date = parseLocalDate(value);
      if (!date) throw usageError(`${flag} must be a date like 2026-10-19 (got "${value}").`);
      return date;
    }
    case 'datetime': {
      try {
        return toDate(value);
      } catch {
        throw usageError(`${flag} must be an ISO date-time like 2026-10-23T16:00 (got "${value}").`);
      }
    }
    case 'time': {
      const time = parseTimeOfDay(value);
      if (!time) throw usageError(`${flag} must be a 24-hour time like 09:00 (got "${value}").`);
      return time;
    }
    case 'week': {
      if (!resolveWeek(value, new Date())) throw usageError(`${flag} must be this, last, next or an ISO week like 2026-W43 (got "${value}").`);
      return String(value);
    }
    default:
      throw new TypeError(`Unknown option type ${spec.type}`);
  }
}

export function normalizeOptions(command, raw) {
  const definition = COMMANDS[command];
  if (!definition) throw usageError(`Unknown command "${command}".`, `Commands: ${Object.keys(COMMANDS).join(', ')}`);
  const specs = { ...COMMON, ...definition.options };
  const options = {};
  for (const key of Object.keys(raw || {})) {
    if (!(key in specs)) {
      const suggestion = closest(key, Object.keys(specs));
      throw usageError(`Unknown option --${kebab(key)} for ${command}.`, suggestion ? `Did you mean --${kebab(suggestion)}?` : `Run awa help ${command}.`);
    }
  }
  for (const [name, spec] of Object.entries(specs)) {
    const value = coerce(name, spec, raw ? raw[name] : undefined);
    options[name] = spec.type === 'time' && typeof value === 'string' ? parseTimeOfDay(value) : value;
  }
  if (options.input) options.dryRun = true;
  return options;
}

export function helpText(command) {
  const definition = COMMANDS[command];
  const specs = { ...definition.options, ...COMMON };
  const rows = Object.entries(specs).map(([name, spec]) => {
    const flag = `--${kebab(name)}${spec.type === 'boolean' ? '' : ` <${spec.type === 'enum' ? spec.values.join('|') : spec.type}>`}`;
    const fallback = spec.default === null || spec.default === false || (Array.isArray(spec.default) && !spec.default.length) ? '' : ` (default: ${spec.default})`;
    return `  ${flag.padEnd(36)} ${spec.help}${fallback}`;
  });
  return [`awa ${command}: ${definition.summary}`, '', 'Options:', ...rows].join('\n');
}
