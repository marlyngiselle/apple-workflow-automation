import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UNTAGGED, buildFocusReport, dayRange, focusReportCsv, focusReportMarkdown, tagsOf } from '../src/core/focus-report.mjs';
import { loadSnapshot } from './helpers/fixtures.mjs';
import { matchSnapshot } from './helpers/snapshot.mjs';

const snapshot = loadSnapshot();
const range = dayRange(new Date(2026, 9, 19), new Date(2026, 9, 25));

describe('focus-report', () => {
  it('reads tags from the title and the notes', () => {
    assert.deepEqual(tagsOf({ title: 'Deep work #deep', notes: 'Write the plan #writing (#Deep)' }), ['deep', 'writing']);
    assert.deepEqual(tagsOf({ title: 'Issue #42 triage', notes: '' }), []);
  });
  it('covers whole days, both ends included', () => {
    assert.equal(range.days, 7);
    assert.deepEqual(range.end, new Date(2026, 9, 26));
  });
  it('groups by calendar with shares that add up', () => {
    const report = buildFocusReport(snapshot.events, { range });
    assert.deepEqual(report.rows.map((row) => [row.group, row.minutes]), [['Work', 390], ['Focus', 240], ['Personal', 105]]);
    assert.equal(report.rows.reduce((sum, row) => sum + row.minutes, 0), report.totalMinutes);
    assert.equal(report.multiTagged, false);
  });
  it('groups by tag and flags multi-tagged events', () => {
    const report = buildFocusReport(snapshot.events, { range, groupBy: 'tag' });
    assert.equal(report.rows[0].group, 'deep');
    assert.ok(report.rows.some((row) => row.group === UNTAGGED));
    assert.equal(report.multiTagged, true);
  });
  it('clips events that cross the range edges', () => {
    const crossing = [{ id: 'x', calendar: 'Work', title: 'Overnight', start: new Date(2026, 9, 25, 23), end: new Date(2026, 9, 26, 2), status: 'confirmed', recurrence: '', notes: '' }];
    assert.equal(buildFocusReport(crossing, { range }).totalMinutes, 60);
  });
  it('renders CSV and Markdown snapshots', () => {
    const report = buildFocusReport(snapshot.events, { range, groupBy: 'tag' });
    matchSnapshot(focusReportCsv(report), 'focus-report-by-tag.csv');
    matchSnapshot(focusReportMarkdown(buildFocusReport(snapshot.events, { range })), 'focus-report-by-calendar.md');
  });
});
