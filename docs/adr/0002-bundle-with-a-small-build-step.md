# ADR 0002 Bundle with a small build step

| Status | Accepted |
| --- | --- |

## Context

`osascript -l JavaScript` runs one file. JXA has no `import`, and its `Library()` loader only works with compiled script libraries installed in `~/Library/Script Libraries`, which complicates installation and cannot share code with Node tests.

General-purpose bundlers would work, but add a dependency tree, a configuration and output that is hard to read in a stack trace.

## Decision

`scripts/build.mjs` does it in about 120 lines with no dependencies.

1. Starts from each file in `src/jxa/commands/`.
2. Follows `import { a } from './x.mjs'` and `import * as x from './x.mjs'`.
3. Wraps each module in a function that returns its exports, and replaces each import with a destructuring of that object.
4. Concatenates the modules in dependency order and appends the global `run(argv)` that `osascript` calls.

Anything outside that subset (default exports, re-exports, dynamic imports) fails the build with the file and line.

## Consequences

- One readable file per command in `dist/`, with a `// ---- src/...` banner before each module, so an error line maps back to its source quickly.
- The build is deterministic (no timestamps); a test builds twice and compares.
- Every bundle is compiled with `osacompile -l JavaScript` in CI, which catches syntax JavaScriptCore rejects even when Node accepts it.
- Each bundle carries the whole shared library, around 55 to 75 KB. That costs nothing at run time and keeps installation to "copy one file".
