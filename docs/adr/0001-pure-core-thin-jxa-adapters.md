# ADR 0001 Pure core, thin JXA adapters

| Status | Accepted |
| --- | --- |

## Context

JXA scripts are usually written as one file that queries an app and formats the result in the same loop. That style cannot be tested without the app, which means without a Mac, without granted permissions and without personal data. It also makes CI pointless, because a hosted macOS runner has no calendars and cannot answer a consent prompt.

## Decision

Split the code in two.

| Part | Rule |
| --- | --- |
| `src/core` | Plain ES modules. No `Application`, no `ObjC`, no Node APIs. ESLint enforces it with `no-restricted-globals`. Every decision lives here: date math, recurrence, parsing, aggregation, rendering, option validation, error translation |
| `src/jxa` | The only code that calls `Application()`, all of it in `apps.mjs`. Adapters read properties in bulk and return plain records; commands wire a source, the core and a writer together |

Both sides meet at the records defined in `core/model.mjs`. A JSON snapshot with the same shape replaces the apps entirely (`--input`).

## Consequences

- The core has unit and snapshot tests that run on Linux in seconds.
- The same snapshot runs through the real bundles under `osascript` in CI, with `Application()` replaced by a function that throws, and the output must match the Node snapshots byte for byte.
- Adapters stay small enough to review by eye, which matters because they are the only part that needs a real Mac to exercise.
- A new app or command means one adapter and one core module, not a new monolith.
