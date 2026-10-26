# Privacy

awa runs on your Mac and only on your Mac.

| Question | Answer |
| --- | --- |
| Does it make network requests? | No. There is no HTTP client in the code, and no dependency at runtime. The bundles in `dist/` are plain scripts run by `osascript`. |
| Where does the output go? | Into your own Notes and Reminders, to the terminal, or to a file you name with `--output`. |
| What does it read from Mail? | Only with `--include-mail`: the subject, sender and date of flagged messages in the Inbox. Never a message body. Nothing in Mail is changed. |
| What goes into a weekly review note? | Event titles and durations, reminder titles, note titles, and for flagged mail the subject and the sender's display name (the address is dropped). |
| What goes into a meeting prep note? | The attendees' names, addresses and replies, and the links already in the invite. |
| Does it keep a cache or a log? | No cache. Logs exist only if you schedule it with launchd, in `~/Library/Logs/awa/`, and contain the one-line summary each run prints. |
| What does the snapshot file contain? | Whatever you put in it. `--input` reads a file; nothing ever writes one for you. |

## What it can change

| App | Changes | Never |
| --- | --- | --- |
| Notes | Creates or updates the weekly review note; creates prep notes; with `--clear`, rewrites the capture note | Deletes a note |
| Reminders | Creates reminders | Edits, completes or deletes a reminder |
| Calendar | Nothing | Any change |
| Mail | Nothing | Any change, any body read |

Every change goes through one object (`writer()` in `src/jxa/lib/source.mjs`). With `--dry-run` or `--input` its methods throw before reaching an app.

## Tests and CI

The tests and the CI pipeline use only the synthetic snapshot in `tests/fixtures/`. Every name, address and link in it is invented. CI never asks for, and never gets, access to any app.
