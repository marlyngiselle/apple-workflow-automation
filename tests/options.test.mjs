import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMMANDS, camel, helpText, kebab, normalizeOptions, parseArgv } from '../src/core/options.mjs';

describe('parseArgv', () => {
  it('reads the JSON object bin/awa sends', () => {
    assert.deepEqual(parseArgv(['{"folder":"Reviews","dryRun":true}']), { folder: 'Reviews', dryRun: true });
  });
  it('reads --flags when a dist script is run directly', () => {
    assert.deepEqual(parseArgv(['--folder', 'Weekly Reviews', '--dry-run', '--week=last']), { folder: 'Weekly Reviews', dryRun: true, week: 'last' });
    assert.deepEqual(parseArgv([]), {});
    assert.deepEqual(parseArgv(undefined), {});
  });
  it('rejects stray arguments and broken JSON', () => {
    assert.throws(() => parseArgv(['weekly']), (error) => error.code === 'usage');
    assert.throws(() => parseArgv(['{nope']), /not valid JSON/);
  });
  it('converts flag names both ways', () => {
    assert.equal(camel('--include-all-day'), 'includeAllDay');
    assert.equal(kebab('includeAllDay'), 'include-all-day');
  });
});

describe('normalizeOptions', () => {
  it('fills defaults', () => {
    const options = normalizeOptions('weekly-review', {});
    assert.equal(options.folder, 'Reviews');
    assert.equal(options.week, 'this');
    assert.equal(options.dryRun, false);
    assert.deepEqual(options.calendars, []);
  });
  it('coerces strings from the shell', () => {
    const options = normalizeOptions('meeting-prep', { hours: '8', calendars: 'Work, Personal', includeAllDay: 'true' });
    assert.equal(options.hours, 8);
    assert.deepEqual(options.calendars, ['Work', 'Personal']);
    assert.equal(options.includeAllDay, true);
    assert.deepEqual(normalizeOptions('inbox-to-reminders', { defaultTime: '07:30' }).defaultTime, { hours: 7, minutes: 30 });
    assert.deepEqual(normalizeOptions('focus-report', { from: '2026-10-01' }).from, new Date(2026, 9, 1));
  });
  it('makes --input a dry run, always', () => {
    assert.equal(normalizeOptions('weekly-review', { input: 'snapshot.json' }).dryRun, true);
  });
  it('explains what is wrong, with a suggestion', () => {
    assert.throws(() => normalizeOptions('weekly-review', { foldr: 'x' }), (error) => error.code === 'usage' && error.hint === 'Did you mean --folder?');
    assert.throws(() => normalizeOptions('meeting-prep', { hours: '0' }), /from 1 to 168/);
    assert.throws(() => normalizeOptions('focus-report', { groupBy: 'colour' }), /calendar, tag/);
    assert.throws(() => normalizeOptions('weekly-review', { week: '2026-W60' }), /ISO week/);
    assert.throws(() => normalizeOptions('focus-report', { to: '2026-13-01' }), /date like/);
    assert.throws(() => normalizeOptions('weekly-review', { folder: true }), /needs a value/);
    assert.throws(() => normalizeOptions('nope', {}), /Unknown command/);
  });
  it('documents every option in help', () => {
    for (const command of Object.keys(COMMANDS)) {
      const help = helpText(command);
      for (const name of Object.keys(COMMANDS[command].options)) assert.ok(help.includes(`--${kebab(name)}`), `${command} --${kebab(name)}`);
    }
  });
});
