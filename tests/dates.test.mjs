import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  formatDuration,
  formatHours,
  formatRangeLabel,
  isoWeek,
  isoWeekKey,
  isoWeeksInYear,
  overlapMinutes,
  parseIsoWeekKey,
  parseLocalDate,
  resolveWeek,
  toDate,
  weekRange,
} from '../src/core/dates.mjs';

const day = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('ISO weeks', () => {
  const cases = [
    [day(2026, 10, 19), '2026-W43'],
    [day(2026, 10, 25, 23, 59), '2026-W43'],
    [day(2026, 10, 26), '2026-W44'],
    [day(2026, 1, 1), '2026-W01'],
    [day(2027, 1, 1), '2026-W53'],
    [day(2027, 1, 4), '2027-W01'],
    [day(2024, 12, 30), '2025-W01'],
    [day(2021, 1, 3), '2020-W53'],
  ];
  for (const [date, key] of cases) {
    it(`${date.toDateString()} is ${key}`, () => assert.equal(isoWeekKey(date), key));
  }

  it('knows which years have 53 weeks', () => {
    assert.equal(isoWeeksInYear(2026), 53);
    assert.equal(isoWeeksInYear(2025), 52);
    assert.equal(isoWeeksInYear(2020), 53);
  });

  it('parses a week key back to its Monday', () => {
    assert.deepEqual(parseIsoWeekKey('2026-W43'), day(2026, 10, 19));
    assert.deepEqual(parseIsoWeekKey('2026w01'), day(2025, 12, 29));
    assert.equal(parseIsoWeekKey('2025-W53'), null);
    assert.equal(parseIsoWeekKey('2026-43'), null);
  });

  it('round-trips every week of 2026', () => {
    for (let week = 1; week <= 53; week += 1) {
      const key = `2026-W${String(week).padStart(2, '0')}`;
      assert.equal(isoWeekKey(parseIsoWeekKey(key)), key);
      assert.deepEqual(isoWeek(addDays(parseIsoWeekKey(key), 6)), { year: 2026, week });
    }
  });
});

describe('week ranges', () => {
  const now = day(2026, 10, 23, 16);
  it('runs Monday to the next Monday, end excluded', () => {
    const range = weekRange(now);
    assert.deepEqual(range.start, day(2026, 10, 19));
    assert.deepEqual(range.end, day(2026, 10, 26));
    assert.equal(range.key, '2026-W43');
  });
  it('resolves this, last, next and explicit weeks', () => {
    assert.equal(resolveWeek('this', now).key, '2026-W43');
    assert.equal(resolveWeek(undefined, now).key, '2026-W43');
    assert.equal(resolveWeek('last', now).key, '2026-W42');
    assert.equal(resolveWeek('next', now).key, '2026-W44');
    assert.equal(resolveWeek('2027-W01', now).key, '2027-W01');
    assert.equal(resolveWeek('someday', now), null);
  });
  it('labels a range by its first and last day', () => {
    const range = weekRange(now);
    assert.equal(formatRangeLabel(range.start, range.end), 'Mon 19 Oct to Sun 25 Oct 2026');
  });
});

describe('parsing and formatting', () => {
  it('reads YYYY-MM-DD as a local day and rejects impossible dates', () => {
    assert.deepEqual(parseLocalDate('2026-02-28'), day(2026, 2, 28));
    assert.equal(parseLocalDate('2026-02-30'), null);
    assert.equal(parseLocalDate('28/02/2026'), null);
  });
  it('converts the shapes a snapshot can hold', () => {
    assert.deepEqual(toDate('2026-10-19'), day(2026, 10, 19));
    assert.deepEqual(toDate('2026-10-19T09:30:00'), day(2026, 10, 19, 9, 30));
    assert.equal(toDate(null), null);
    assert.equal(toDate(''), null);
    assert.throws(() => toDate('not a date'), /Not a valid date/);
  });
  it('formats durations the way people say them', () => {
    assert.equal(formatDuration(0), '0m');
    assert.equal(formatDuration(45), '45m');
    assert.equal(formatDuration(60), '1h');
    assert.equal(formatDuration(135), '2h 15m');
    assert.equal(formatHours(45), '0.8');
  });
  it('counts only the overlapping minutes', () => {
    const rangeStart = day(2026, 10, 19);
    const rangeEnd = day(2026, 10, 26);
    assert.equal(overlapMinutes(day(2026, 10, 18, 23), day(2026, 10, 19, 1), rangeStart, rangeEnd), 60);
    assert.equal(overlapMinutes(day(2026, 10, 20, 9), day(2026, 10, 20, 10), rangeStart, rangeEnd), 60);
    assert.equal(overlapMinutes(day(2026, 10, 26), day(2026, 10, 26, 1), rangeStart, rangeEnd), 0);
  });
});
