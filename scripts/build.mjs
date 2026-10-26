#!/usr/bin/env node
// Bundles each command in src/jxa/commands into one self-contained file in dist/.
//
// JXA has no module loader, so every ES module the command reaches is wrapped in a
// function scope and concatenated in dependency order. Only the subset of module
// syntax this repo uses is accepted, and anything else fails the build loudly:
//   import { a, b as c } from './x.mjs';
//   import * as x from './x.mjs';
//   export function / export const / export class
// The output is deterministic (no timestamps), so two builds of the same tree are identical.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMANDS_DIR = path.join(ROOT, 'src', 'jxa', 'commands');

const IMPORT_NAMED = /^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const IMPORT_NAMESPACE = /^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const UNSUPPORTED = /^\s*(import\s|import\(|export\s+(default|\*|\{)|export\s+var\s)/m;

function moduleId(file) {
  return `__awa_${path.relative(path.join(ROOT, 'src'), file).replace(/\.mjs$/, '').replace(/[^A-Za-z0-9]/g, '_')}`;
}

async function loadModule(file, modules, stack) {
  if (modules.has(file)) return;
  if (stack.includes(file)) throw new Error(`Import cycle: ${[...stack, file].map((f) => path.relative(ROOT, f)).join(' -> ')}`);
  let source = await readFile(file, 'utf8');
  const deps = [];
  const bindings = [];
  source = source.replace(IMPORT_NAMED, (_, names, spec) => {
    const target = path.resolve(path.dirname(file), spec);
    deps.push(target);
    const list = names
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.replace(/\s+as\s+/, ': '));
    bindings.push(`var { ${list.join(', ')} } = ${moduleId(target)};`);
    return '';
  });
  source = source.replace(IMPORT_NAMESPACE, (_, name, spec) => {
    const target = path.resolve(path.dirname(file), spec);
    deps.push(target);
    bindings.push(`var ${name} = ${moduleId(target)};`);
    return '';
  });
  if (UNSUPPORTED.test(source)) {
    const line = source.split('\n').find((text) => UNSUPPORTED.test(text));
    throw new Error(`${path.relative(ROOT, file)}: module syntax the bundler does not support: ${line.trim()}`);
  }
  const exported = [];
  source = source.replace(EXPORT_DECL, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  for (const dep of deps) await loadModule(dep, modules, [...stack, file]);
  const body = source.replace(/^\s*\n/, '').trimEnd();
  modules.set(file, {
    id: moduleId(file),
    exported,
    code: [
      `// ---- ${path.relative(ROOT, file)}`,
      `var ${moduleId(file)} = (function () {`,
      "'use strict';",
      ...bindings,
      body,
      `return { ${exported.map((name) => `${name}: ${name}`).join(', ')} };`,
      '})();',
    ].join('\n'),
  });
}

export async function bundle(entry, version) {
  const modules = new Map();
  await loadModule(entry, modules, []);
  const main = modules.get(entry);
  if (!main.exported.includes('main')) throw new Error(`${path.relative(ROOT, entry)} must export main(argv).`);
  const command = path.basename(entry, '.mjs');
  return [
    `// awa ${command} ${version}`,
    '// Built from src/ by scripts/build.mjs. Edit the sources, not this file.',
    `// Run: osascript -l JavaScript ${command}.js '{"dryRun": true}'`,
    '',
    ...[...modules.values()].map((module) => module.code),
    '',
    '// osascript calls run() with the command-line arguments.',
    `function run(argv) {`,
    `  return ${main.id}.main(argv);`,
    '}',
    '',
  ].join('\n');
}

export async function build(outDir = path.join(ROOT, 'dist')) {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const entries = (await readdir(COMMANDS_DIR)).filter((name) => name.endsWith('.mjs')).sort();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const name of entries) {
    const code = await bundle(path.join(COMMANDS_DIR, name), pkg.version);
    const file = path.join(outDir, name.replace(/\.mjs$/, '.js'));
    await writeFile(file, code);
    written.push({ file, bytes: Buffer.byteLength(code) });
  }
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  build(outDir)
    .then((written) => {
      for (const { file, bytes } of written) console.log(`built ${path.relative(process.cwd(), file)} (${(bytes / 1024).toFixed(1)} KiB)`);
    })
    .catch((error) => {
      console.error(`build failed: ${error.message}`);
      process.exitCode = 1;
    });
}
