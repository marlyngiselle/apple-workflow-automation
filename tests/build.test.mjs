// The bundles must be plain scripts: no import or export left, a global run(argv),
// and valid syntax. macOS CI additionally compiles them with osacompile.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

describe('scripts/build.mjs', () => {
  let outDir;
  let written;
  before(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'awa-build-'));
    written = await build(outDir);
  });
  after(() => rm(outDir, { recursive: true, force: true }));

  it('builds one script per command', () => {
    assert.deepEqual(written.map((item) => path.basename(item.file)), ['focus-report.js', 'inbox-to-reminders.js', 'meeting-prep.js', 'weekly-review.js']);
  });

  it('leaves no module syntax and defines run()', async () => {
    for (const { file } of written) {
      const code = await readFile(file, 'utf8');
      assert.doesNotMatch(code, /^\s*(import|export)\s/m, path.basename(file));
      const context = vm.createContext({});
      new vm.Script(code, { filename: file }).runInContext(context);
      assert.equal(typeof context.run, 'function', path.basename(file));
    }
  });

  it('is deterministic', async () => {
    const again = await mkdtemp(path.join(tmpdir(), 'awa-build-'));
    try {
      const second = await build(again);
      for (let i = 0; i < written.length; i += 1) {
        assert.equal(await readFile(second[i].file, 'utf8'), await readFile(written[i].file, 'utf8'));
      }
    } finally {
      await rm(again, { recursive: true, force: true });
    }
  });

  it('never touches an app while loading', async () => {
    const calls = [];
    const context = vm.createContext({ Application: (name) => calls.push(name), ObjC: { import: () => calls.push('ObjC') } });
    new vm.Script(await readFile(written[0].file, 'utf8')).runInContext(context);
    assert.deepEqual(calls, []);
  });
});
