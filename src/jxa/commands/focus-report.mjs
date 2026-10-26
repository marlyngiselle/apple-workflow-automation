// awa focus-report: where the scheduled time went, by calendar or by #tag.

import { addDays, startOfDay } from '../../core/dates.mjs';
import { usageError } from '../../core/errors.mjs';
import { buildFocusReport, dayRange, focusReportCsv, focusReportMarkdown } from '../../core/focus-report.mjs';
import { writeText } from '../lib/io.mjs';
import { runCommand } from '../lib/runtime.mjs';

function focusReport({ options, source, now }) {
  const to = options.to || startOfDay(now);
  const from = options.from || addDays(to, -6);
  if (from > to) throw usageError('--from must be on or before --to.');
  const range = dayRange(from, to);
  if (range.days > 366) throw usageError('The range is limited to 366 days.', 'Split it into several reports.');
  const report = buildFocusReport(source.events(range, { calendars: options.calendars }), { range, groupBy: options.groupBy, calendars: options.calendars });
  const rendered = options.format === 'csv' ? focusReportCsv(report) : options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : focusReportMarkdown(report);
  if (options.output) {
    writeText(options.output, rendered);
    return { text: `Wrote ${options.format} report (${report.rows.length} rows) to ${options.output}.`, data: { report, output: options.output } };
  }
  return { text: rendered, data: { report } };
}

export function main(argv) {
  return runCommand('focus-report', argv, focusReport);
}
