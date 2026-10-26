// Date helpers shared by every command.
// Everything works in the Mac's local time zone, the same one Calendar and Reminders show.
// Ranges are half-open: start is included, end is excluded.

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime());
}

// Parses "YYYY-MM-DD" as a local calendar day. new Date("YYYY-MM-DD") would give UTC midnight.
export function parseLocalDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text).trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

// Accepts a Date, epoch milliseconds, "YYYY-MM-DD" or an ISO date-time.
// A date-time without an offset is read as local time, which is what fixtures and snapshots use.
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (isDate(value)) return new Date(value.getTime());
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const dayOnly = parseLocalDate(value);
    if (dayOnly) return dayOnly;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  throw new TypeError(`Not a valid date: ${String(value)}`);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Calendar arithmetic, so a day stays a day across daylight saving changes.
export function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function atTime(date, hours, minutes) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

export function minutesBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

export function daysBetween(start, end) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

// Minutes of [start, end) that fall inside [rangeStart, rangeEnd).
export function overlapMinutes(start, end, rangeStart, rangeEnd) {
  const from = Math.max(start.getTime(), rangeStart.getTime());
  const to = Math.min(end.getTime(), rangeEnd.getTime());
  return to > from ? Math.round((to - from) / MINUTE_MS) : 0;
}

export function overlaps(start, end, rangeStart, rangeEnd) {
  return start.getTime() < rangeEnd.getTime() && end.getTime() > rangeStart.getTime();
}

// Monday is day 0, as in ISO 8601.
export function isoWeekday(date) {
  return (date.getDay() + 6) % 7;
}

export function startOfIsoWeek(date) {
  const day = startOfDay(date);
  return addDays(day, -isoWeekday(day));
}

function firstIsoMonday(year) {
  return startOfIsoWeek(new Date(year, 0, 4));
}

export function isoWeek(date) {
  const thursday = addDays(startOfIsoWeek(date), 3);
  const year = thursday.getFullYear();
  const week = 1 + Math.round((thursday.getTime() - addDays(firstIsoMonday(year), 3).getTime()) / (7 * DAY_MS));
  return { year, week };
}

export function isoWeeksInYear(year) {
  return isoWeek(new Date(year, 11, 28)).week;
}

export function isoWeekKey(date) {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseIsoWeekKey(key) {
  const match = /^(\d{4})-?W(\d{1,2})$/i.exec(String(key).trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > isoWeeksInYear(year)) return null;
  return addDays(firstIsoMonday(year), (week - 1) * 7);
}

export function weekRange(date) {
  const start = startOfIsoWeek(date);
  return { start, end: addDays(start, 7), key: isoWeekKey(start) };
}

// "this", "last", "next", or an ISO week such as "2026-W43".
export function resolveWeek(spec, now) {
  const value = String(spec || 'this').trim().toLowerCase();
  if (value === 'this' || value === 'current') return weekRange(now);
  if (value === 'last' || value === 'previous') return weekRange(addDays(now, -7));
  if (value === 'next') return weekRange(addDays(now, 7));
  const monday = parseIsoWeekKey(value);
  if (!monday) return null;
  return weekRange(monday);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(date) {
  return `${formatIsoDate(date)} ${formatTime(date)}`;
}

// "Mon 19 Oct"
export function formatDayLabel(date) {
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

// "Mon 19 Oct to Sun 25 Oct 2026" for a half-open range.
export function formatRangeLabel(start, endExclusive) {
  const last = addDays(endExclusive, -1);
  return `${formatDayLabel(start)} to ${formatDayLabel(last)} ${last.getFullYear()}`;
}

// 0 -> "0m", 45 -> "45m", 90 -> "1h 30m", 120 -> "2h"
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatHours(minutes) {
  return (Math.round((minutes / 60) * 10) / 10).toFixed(1);
}
