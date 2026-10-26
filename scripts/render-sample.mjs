#!/usr/bin/env node
// Prints what each command would write for a snapshot, without macOS or any app.
//   npm run sample                       the bundled synthetic week
//   node scripts/render-sample.mjs my-snapshot.json
import { readFileSync } from 'node:fs';
import { resolveWeek } from '../src/core/dates.mjs';
import { buildFocusReport, dayRange, focusReportMarkdown } from '../src/core/focus-report.mjs';
import { buildMeetingPrep, upcomingMeetings } from '../src/core/meeting-prep.mjs';
import { normalizeSnapshot } from '../src/core/model.mjs';
import { buildWeeklyReview } from '../src/core/weekly-review.mjs';

const file = process.argv[2] || new URL('../tests/fixtures/week-2026-w43.json', import.meta.url);
const snapshot = normalizeSnapshot(JSON.parse(readFileSync(file, 'utf8')));
const now = snapshot.now || new Date();
const range = resolveWeek('this', now);

const sections = [
  buildWeeklyReview(snapshot, { range, now, sourceFolder: 'Projects', includeMail: true }).markdown,
  ...upcomingMeetings(snapshot.events, now, 4).map((event) => buildMeetingPrep(event).markdown),
  focusReportMarkdown(buildFocusReport(snapshot.events, { range: dayRange(range.start, new Date(range.end.getTime() - 1)), groupBy: 'tag' })),
];
process.stdout.write(sections.join('\n---\n\n'));
