# ADR 0003 Idempotent notes, found by title

| Status | Accepted |
| --- | --- |

## Context

A review that is scheduled, or run again after a late meeting, must not leave two notes for the same week. Notes offers no custom metadata through scripting. A note has an id, a name (its first line), a body and dates. Ids are stable but would have to be stored somewhere, and awa keeps no state.

People also write in the review. A rerun that overwrote their reflections would make the tool unusable.

## Decision

- The title carries the key. Weekly reviews are `Weekly review 2026-W43` (ISO 8601 week, so the week of 31 December is never ambiguous). Prep notes are `Prep 2026-10-23 17:00 Customer demo`.
- `weekly-review` looks for that title in the target folder and updates the body if found, creates the note if not.
- Before updating, `mergeReflection()` finds the Reflection heading by its text in the old body (Notes rewrites headings into its own markup) and keeps everything below it. Everything above it is rebuilt from the apps.
- `meeting-prep` never updates. If the prep note exists, it is left as it is.
- `inbox-to-reminders` checks open reminders with the same title in the target list before creating one.

## Consequences

- Running any command twice is safe, which is what a scheduler and a Shortcuts automation need.
- Renaming a review note detaches it, and the next run creates a fresh one. The README and `docs/launchd.md` say so.
- `--title-prefix` exists for people who want another wording; the week key stays at the end.
