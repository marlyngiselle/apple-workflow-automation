import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRIORITY, clearedInboxHtml, parseCaptureLine, planInbox } from '../src/core/inbox.mjs';
import { loadSnapshot } from './helpers/fixtures.mjs';

// Friday 23 October 2026, 16:00.
const now = new Date(2026, 9, 23, 16, 0);
const at = (m, d, h, min = 0) => new Date(2026, m - 1, d, h, min);
const parse = (line) => parseCaptureLine(line, { now });

describe('parseCaptureLine', () => {
  const cases = [
    ['Call the bank tomorrow 9am #errands !!', { title: 'Call the bank', list: 'errands', priority: PRIORITY.medium, due: at(10, 24, 9) }],
    ['Send slides friday', { title: 'Send slides', list: null, priority: 0, due: at(10, 30, 9) }],
    ['Pay invoice by monday', { title: 'Pay invoice', due: at(10, 26, 9) }],
    ['Prepare demo on wed', { title: 'Prepare demo', due: at(10, 28, 9) }],
    ['Prepare demo next thu 14:30', { title: 'Prepare demo', due: at(10, 29, 14, 30) }],
    ['Renew passport 2026-11-15 #admin', { title: 'Renew passport', list: 'admin', due: at(11, 15, 9) }],
    ['Water the plants tonight', { title: 'Water the plants', due: at(10, 23, 20) }],
    ['Take out the bins today at 18', { title: 'Take out the bins', due: at(10, 23, 18) }],
    ['Stretch at 9:30pm', { title: 'Stretch', due: at(10, 23, 21, 30) }],
    ['Check the oven 3pm', { title: 'Check the oven', due: at(10, 24, 15) }],
    ['Lunch with the team noon tomorrow', { title: 'Lunch with the team', due: at(10, 24, 12) }],
    ['Plan the offsite in 2 weeks !!!', { title: 'Plan the offsite', priority: PRIORITY.high, due: at(11, 6, 9) }],
    ['Book a review in 3 days', { title: 'Book a review', due: at(10, 26, 9) }],
    ['Sort the garage next week #home-projects !', { title: 'Sort the garage', list: 'home projects', priority: PRIORITY.low, due: at(10, 26, 9) }],
    ['- [ ] Read chapter 4', { title: 'Read chapter 4', due: null }],
    ['* Buy sun cream', { title: 'Buy sun cream', due: null }],
    ['1. Reply to the landlord', { title: 'Reply to the landlord', due: null }],
  ];
  for (const [line, expected] of cases) {
    it(line, () => {
      const parsed = parse(line);
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(parsed[key], value, `${key} of "${line}"`);
    });
  }

  it('ignores empty and checked lines', () => {
    assert.equal(parse('   '), null);
    assert.deepEqual(parse('- [x] Done already'), { skip: 'done', raw: '- [x] Done already' });
    assert.deepEqual(parse('[X] Also done').skip, 'done');
  });

  it('does not read a short weekday inside a sentence as a date', () => {
    assert.equal(parse('Wed photos for sun deck').due, null);
  });

  it('rejects impossible dates and times instead of guessing', () => {
    const parsed = parse('Archive 2026-02-30 at 13pm');
    assert.equal(parsed.due, null);
    assert.equal(parsed.title, 'Archive 2026-02-30 at 13pm');
  });

  it('uses the default time when only a date is given', () => {
    assert.deepEqual(parseCaptureLine('File taxes tomorrow', { now, defaultTime: { hours: 7, minutes: 45 } }).due, at(10, 24, 7, 45));
  });

  it('keeps the whole line when every word was syntax', () => {
    assert.equal(parse('tomorrow').title, 'tomorrow');
  });
});

describe('planInbox', () => {
  const snapshot = loadSnapshot();
  const inbox = snapshot.notes.find((note) => note.title === 'Inbox');
  const plan = planInbox({
    body: inbox.body,
    now: snapshot.now,
    lists: snapshot.reminderLists,
    defaultList: 'Reminders',
    openTitles: { Errands: ['Buy coffee beans'] },
  });

  it('skips the title line and checked lines', () => {
    assert.equal(plan.noteTitle, 'Inbox');
    assert.deepEqual(plan.keep, ['- [x] Pick up dry cleaning']);
  });
  it('routes items to existing lists, case and dashes aside', () => {
    assert.deepEqual(
      plan.create.map((item) => [item.title, item.list]),
      [
        ['Call the bank', 'Errands'],
        ['Send slides', 'Work'],
        ['Renew passport', 'Reminders'],
        ['Water the plants', 'Reminders'],
        ['Plan the team offsite', 'Reminders'],
        ['Book a table & confirm guests', 'Reminders'],
      ]
    );
  });
  it('warns about an unknown list instead of failing', () => {
    assert.deepEqual(plan.warnings, ['List "admin" not found, "Renew passport" goes to Reminders.']);
  });
  it('does not duplicate an open reminder, even on a second run', () => {
    assert.deepEqual(plan.duplicates.map((item) => item.title), ['Buy coffee beans']);
    const again = planInbox({
      body: inbox.body,
      now: snapshot.now,
      lists: snapshot.reminderLists,
      defaultList: 'Reminders',
      openTitles: Object.fromEntries(['Errands', 'Work', 'Reminders'].map((list) => [list, plan.create.filter((item) => item.list === list).map((item) => item.title)])),
    });
    assert.equal(again.create.length, 1);
    assert.equal(again.create[0].title, 'Buy coffee beans');
  });
  it('de-duplicates the same line written twice', () => {
    const twice = planInbox({ body: '<div>Inbox</div><div>Buy milk</div><div>buy milk</div>', now, lists: [], defaultList: 'Reminders' });
    assert.equal(twice.create.length, 1);
    assert.equal(twice.duplicates.length, 1);
  });
  it('clears the note down to its title and the lines it left alone', () => {
    assert.equal(clearedInboxHtml('Inbox', ['- [x] Pick up dry cleaning']), '<div><h1>Inbox</h1></div>\n<div>- [x] Pick up dry cleaning</div>\n');
    assert.equal(clearedInboxHtml('Q&A', []), '<div><h1>Q&amp;A</h1></div>\n<div><br></div>\n');
  });
});
