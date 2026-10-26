import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandOccurrences, parseRRule } from '../src/core/recurrence.mjs';

const day = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const week = { start: day(2026, 10, 19), end: day(2026, 10, 26) };
const starts = (event, range = week) => expandOccurrences(event, range.start, range.end).occurrences.map((o) => o.start.getDate());

describe('parseRRule', () => {
  it('reads the common parts', () => {
    assert.deepEqual(parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR,MO'), { freq: 'WEEKLY', interval: 2, count: null, until: null, byDay: [0, 4] });
  });
  it('returns null for an empty rule and flags what it cannot expand', () => {
    assert.equal(parseRRule(''), null);
    assert.match(parseRRule('FREQ=MONTHLY;BYDAY=1MO').unsupported, /BYDAY/);
    assert.match(parseRRule('FREQ=HOURLY').unsupported, /HOURLY/);
    assert.match(parseRRule('FREQ=DAILY;BYSETPOS=1').unsupported, /BYSETPOS/);
  });
});

describe('expandOccurrences', () => {
  const master = (start, minutes, recurrence) => ({ start, end: new Date(start.getTime() + minutes * 60000), recurrence });

  it('expands a weekday stand-up that started weeks ago', () => {
    assert.deepEqual(starts(master(day(2026, 9, 7, 9), 15, 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')), [19, 20, 21, 22, 23]);
  });
  it('honours INTERVAL', () => {
    assert.deepEqual(starts(master(day(2026, 10, 8, 16), 30, 'FREQ=WEEKLY;INTERVAL=2')), [22]);
    assert.deepEqual(starts(master(day(2026, 10, 15, 16), 30, 'FREQ=WEEKLY;INTERVAL=2')), []);
  });
  it('stops at COUNT and UNTIL', () => {
    assert.deepEqual(starts(master(day(2026, 10, 17, 7), 30, 'FREQ=DAILY;COUNT=4')), [19, 20]);
    assert.deepEqual(starts(master(day(2026, 10, 1, 7), 30, 'FREQ=DAILY;UNTIL=20261021T235959Z')), [19, 20, 21]);
    assert.deepEqual(starts(master(day(2026, 10, 1, 7), 30, 'FREQ=DAILY;UNTIL=20261020')), [19, 20]);
  });
  it('skips months that do not have the day', () => {
    const monthly = master(day(2026, 1, 31, 10), 60, 'FREQ=MONTHLY');
    const year = { start: day(2026, 1, 1), end: day(2027, 1, 1) };
    const months = expandOccurrences(monthly, year.start, year.end).occurrences.map((o) => o.start.getMonth() + 1);
    assert.deepEqual(months, [1, 3, 5, 7, 8, 10, 12]);
  });
  it('keeps the time of day and the duration', () => {
    const [first] = expandOccurrences(master(day(2026, 1, 3, 8), 60, 'FREQ=WEEKLY'), week.start, week.end).occurrences;
    assert.deepEqual(first, { start: day(2026, 10, 24, 8), end: day(2026, 10, 24, 9) });
  });
  it('includes an occurrence that started before the range but ends inside it', () => {
    const overnight = master(day(2026, 10, 11, 23), 120, 'FREQ=WEEKLY');
    assert.deepEqual(starts(overnight), [18, 25]);
  });
});
