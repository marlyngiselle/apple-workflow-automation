// File snapshots: the expected output lives next to the tests as a readable file.
// Set UPDATE_SNAPSHOTS=1 (npm run test:update) to rewrite them after an intended change.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = new URL('../__snapshots__/', import.meta.url);

export function matchSnapshot(actual, name) {
  const file = fileURLToPath(new URL(name, DIR));
  if (process.env.UPDATE_SNAPSHOTS === '1' || !existsSync(file)) {
    mkdirSync(fileURLToPath(DIR), { recursive: true });
    writeFileSync(file, actual);
    if (process.env.UPDATE_SNAPSHOTS !== '1' && process.env.CI) assert.fail(`Snapshot ${name} was missing; run npm run test:update locally and commit it.`);
    return;
  }
  assert.equal(actual, readFileSync(file, 'utf8'), `Snapshot ${name} changed. Run npm run test:update if the change is intended.`);
}
