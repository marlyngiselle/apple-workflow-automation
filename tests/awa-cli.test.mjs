// bin/awa only translates flags into JSON. AWA_PRINT_ARGS=1 makes it print that JSON
// instead of calling osascript, so this runs on Linux and never touches an app.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const AWA = fileURLToPath(new URL('../bin/awa', import.meta.url));
const CWD = realpathSync(tmpdir());

function awa(args, env = { AWA_PRINT_ARGS: '1' }, cwd = CWD) {
  return spawnSync('bash', [AWA, ...args], { encoding: 'utf8', cwd, env: { PATH: process.env.PATH, HOME: '/Users/example', ...env } });
}

function sent(args) {
  const result = awa(args);
  assert.equal(result.status, 0, result.stderr);
  const [command, ...json] = result.stdout.trim().split(' ');
  return { command, args: JSON.parse(json.join(' ')) };
}

describe('bin/awa', () => {
  it('turns flags into one JSON object with camelCase keys', () => {
    assert.deepEqual(sent(['weekly-review', '--folder', 'Weekly Reviews', '--dry-run', '--include-mail']), {
      command: 'weekly-review',
      args: { folder: 'Weekly Reviews', dryRun: true, includeMail: true },
    });
  });
  it('accepts --name=value', () => {
    assert.deepEqual(sent(['focus-report', '--group-by=tag', '--format', 'csv']).args, { groupBy: 'tag', format: 'csv' });
  });
  it('escapes quotes, backslashes and newlines', () => {
    const value = 'Q4 "big" plan \\ draft\nline two\ttab';
    assert.equal(sent(['inbox-to-reminders', '--note', value]).args.note, value);
  });
  it('makes --input and --output absolute', () => {
    assert.deepEqual(sent(['focus-report', '--input', 'fixtures/week.json', '--output', '~/report.csv']).args, {
      input: `${CWD}/fixtures/week.json`,
      output: '/Users/example/report.csv',
    });
  });
  it('sends an empty object when there are no flags', () => {
    assert.deepEqual(sent(['meeting-prep']).args, {});
  });
  it('routes help for a command to the script', () => {
    assert.deepEqual(sent(['help', 'focus-report']), { command: 'focus-report', args: { help: true } });
  });
  it('rejects unknown commands and stray words with exit code 2', () => {
    const unknown = awa(['weekly']);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /unknown command "weekly"/);
    const stray = awa(['weekly-review', 'Reviews']);
    assert.equal(stray.status, 2);
    assert.match(stray.stderr, /unexpected argument "Reviews"/);
  });
  it('prints usage and version', () => {
    assert.match(awa([]).stdout, /Usage:\n {2}awa <command>/);
    assert.match(awa(['version']).stdout, /^\d+\.\d+\.\d+\n$/);
  });
  it('says how to build when dist is missing', () => {
    const result = awa(['weekly-review'], { AWA_DIST: '/nonexistent' });
    assert.equal(result.status, 4);
    assert.match(result.stderr, /npm run build/);
  });
});
