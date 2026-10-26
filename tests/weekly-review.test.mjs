import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWeek } from '../src/core/dates.mjs';
import { eventsInRange, summarizeEvents, summarizeReminders } from '../src/core/aggregate.mjs';
import { buildWeeklyReview, mergeReflection, weeklyReviewTitle } from '../src/core/weekly-review.mjs';
import { loadSnapshot } from './helpers/fixtures.mjs';
import { matchSnapshot } from './helpers/snapshot.mjs';

const snapshot = loadSnapshot();
const now = snapshot.now;
const range = resolveWeek('this', now);
const options = { range, now, sourceFolder: 'Projects', includeMail: true };

describe('aggregation over the fixture week', () => {
  const { items, unsupported } = eventsInRange(snapshot.events, range.start, range.end);
  const summary = summarizeEvents(items);

  it('expands series, drops cancelled and out-of-week events', () => {
    const titles = items.map((item) => item.title);
    assert.equal(titles.filter((title) => title === 'Team stand-up').length, 5);
    assert.equal(titles.filter((title) => title === '1:1 with Sam').length, 1);
    assert.ok(!titles.includes('Cancelled sync'));
    assert.ok(!titles.includes('Team offsite'));
    assert.deepEqual(unsupported.map((item) => item.title), ['Monthly sync']);
  });
  it('adds up time per calendar', () => {
    assert.equal(summary.count, 14);
    assert.equal(summary.totalMinutes, 735);
    assert.deepEqual(
      summary.byCalendar.map((row) => [row.name, row.count, row.minutes, row.share]),
      [
        ['Work', 10, 390, 53.1],
        ['Focus', 2, 240, 32.7],
        ['Personal', 2, 105, 14.3],
      ]
    );
    assert.equal(summary.allDayCount, 1);
    assert.equal(summary.busiest.date.getDate(), 21);
  });
  it('splits reminders into done this week and overdue now', () => {
    const reminders = summarizeReminders(snapshot.reminders, range.start, range.end, now);
    assert.deepEqual(reminders.completed.map((item) => item.title), ['Book train tickets', 'Submit expense report', 'Renew library card', 'Review open pull requests']);
    assert.deepEqual(reminders.overdue.map((item) => [item.title, item.daysOverdue]), [['Call the plumber', 3], ['Update the team wiki', 1]]);
  });
});

describe('buildWeeklyReview', () => {
  const review = buildWeeklyReview(snapshot, options);

  it('titles the note by ISO week so reruns find it', () => {
    assert.equal(review.title, 'Weekly review 2026-W43');
    assert.equal(weeklyReviewTitle(range, 'Review'), 'Review 2026-W43');
    assert.ok(review.html.startsWith('<h1>Weekly review 2026-W43</h1>'));
  });
  it('reports the stats it rendered', () => {
    assert.deepEqual(review.stats, {
      week: '2026-W43',
      events: 14,
      allDayEvents: 1,
      scheduledMinutes: 735,
      remindersCompleted: 4,
      remindersOverdue: 2,
      notesTouched: 2,
      flaggedMail: 3,
    });
  });
  it('is deterministic for the same input', () => {
    assert.equal(buildWeeklyReview(snapshot, options).html, review.html);
  });
  it('leaves out optional sections unless asked', () => {
    const lean = buildWeeklyReview(snapshot, { range, now });
    assert.ok(!lean.markdown.includes('Flagged mail'));
    assert.ok(!lean.markdown.includes('Notes in'));
    assert.equal(lean.stats.flaggedMail, null);
  });
  it('handles an empty week', () => {
    const empty = buildWeeklyReview({ events: [], reminders: [], notes: [], mail: [] }, { range: resolveWeek('2026-W01', now), now });
    assert.match(empty.markdown, /No events this week\./);
    assert.match(empty.markdown, /Nothing completed this week\./);
  });
  it('escapes titles that look like HTML', () => {
    const tricky = buildWeeklyReview(
      { events: [{ ...snapshot.events[1], title: '<script>alert(1)</script> & co' }], reminders: [], notes: [], mail: [] },
      { range, now }
    );
    assert.ok(!tricky.html.includes('<script>'));
    assert.ok(tricky.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co'));
  });
  it('matches the HTML snapshot', () => matchSnapshot(review.html, 'weekly-review.html'));
  it('matches the Markdown snapshot', () => matchSnapshot(review.markdown, 'weekly-review.md'));
});

describe('mergeReflection', () => {
  const fresh = buildWeeklyReview(snapshot, options).html;

  it('keeps what was written under Reflection, as Notes stores it', () => {
    const edited = '<div><b>Weekly review 2026-W43</b></div><div>old facts</div><div><b>Reflection</b></div><div>Shipped the migration plan.</div><div>Too many meetings on Wednesday.</div>';
    const merged = mergeReflection(edited, fresh);
    assert.ok(merged.endsWith('<div>Shipped the migration plan.</div><div>Too many meetings on Wednesday.</div>'));
    assert.ok(merged.includes('Updated by awa weekly-review'));
    assert.ok(!merged.includes('old facts'));
    assert.equal((merged.match(/Reflection</g) || []).length, 1);
  });
  it('uses the fresh body when there is nothing to keep', () => {
    assert.equal(mergeReflection('', fresh), fresh);
    assert.equal(mergeReflection('<div>no heading here</div>', fresh), fresh);
    assert.equal(mergeReflection('<h2>Reflection</h2><div><br></div>', fresh), fresh);
  });
  it('is stable when run twice', () => {
    const once = mergeReflection('<h2>Reflection</h2><div>Note to self</div>', fresh);
    assert.equal(mergeReflection(once, fresh), once);
  });
});
