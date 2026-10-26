# Command reference

Every command accepts the common options, prints text by default and a JSON result with `--json`. `awa help <command>` prints the same list from the code, so it never drifts from this page.

## Common options

| Option | Meaning |
| --- | --- |
| `--dry-run` | Read the apps, print what would be written, change nothing |
| `--json` | Print a JSON result (`ok`, `command`, `dryRun`, `source`, plus the command's fields) |
| `--input <file>` | Read a JSON snapshot instead of the apps. Implies `--dry-run` |
| `--now <date-time>` | Pretend the current time is this, for example `2026-10-23T16:00` |
| `--help` | Show the options |

## weekly-review

Builds the note `Weekly review <ISO week>` in a Notes folder, or refreshes it if it already exists.

| Option | Default | Meaning |
| --- | --- | --- |
| `--folder` | `Reviews` | Target folder. `Parent/Child` for a nested folder. Created if missing |
| `--account` | default account | Notes account of the target folder |
| `--week` | `this` | `this`, `last`, `next` or an ISO week such as `2026-W43` |
| `--source-folder` | none | Folder whose notes changed this week are listed |
| `--calendars` | all | Comma-separated calendar names |
| `--include-mail` | off | Add flagged Inbox messages, headers only |
| `--mail-limit` | `10` | How many flagged messages to list |
| `--title-prefix` | `Weekly review` | Text before the week key in the title |
| `--format` | `markdown` | Dry-run output, `markdown` or `html` |

The note has a summary, time by calendar, day by day, longest blocks, all-day events, reminders completed this week, reminders overdue now, notes changed, flagged mail, and Reflection. Re-running keeps what you wrote under Reflection.

## meeting-prep

Creates `Prep <date> <time> <title>` for each meeting that starts in the next hours. An existing prep note is left alone.

| Option | Default | Meaning |
| --- | --- | --- |
| `--hours` | `4` | Look-ahead window, 1 to 168 |
| `--folder` | `Meeting prep` | Target folder, created if missing |
| `--account` | default account | Notes account |
| `--calendars` | all | Comma-separated calendar names |
| `--include-all-day` | off | Also prepare all-day events |
| `--min-attendees` | `0` | Skip events with fewer attendees, for example `2` to skip solo blocks |
| `--format` | `markdown` | Dry-run output, `markdown` or `html` |

Each note has the time, the calendar, the place or the call link, the attendees with their replies, every link found in the invite's URL, location and notes, and an agenda skeleton.

## inbox-to-reminders

Reads a capture note line by line and creates one reminder per line. The note's first line is its title and is skipped. An open reminder with the same title in the same list is not created twice, so running it again is safe.

| Option | Default | Meaning |
| --- | --- | --- |
| `--note` | `Inbox` | Title of the capture note |
| `--folder` | any | Only look in this folder |
| `--account` | all | Only look in this account |
| `--list` | Reminders' default list | List for lines without `#list` |
| `--default-time` | `09:00` | Time for a date given without one |
| `--clear` | off | Afterwards, leave only the title and the checked lines in the note |

### Capture syntax

Everything is optional and can go anywhere on the line.

| You write | You get |
| --- | --- |
| `#errands`, `#deep-work` | List "Errands", list "Deep Work" (case, spaces and dashes are ignored). An unknown list falls back to the default with a warning |
| `!`, `!!`, `!!!` | Low, medium, high priority |
| `today`, `tomorrow`, `tonight` | That day; `tonight` means 20:00 unless a time is given |
| `monday` ... `sunday` | The next one, never today: on a Friday, `friday` is next week |
| `on mon`, `by fri`, `next thu` | Short weekday names work after `on`, `by`, `due` or `next` |
| `next week` | Monday of next week |
| `in 3 days`, `in 2 weeks` | Relative to today |
| `2026-11-15` | That date |
| `9am`, `9:30pm`, `14:00`, `at 9`, `noon` | That time. Without a date: today, or tomorrow if the time has passed |
| `- [ ] task`, `* task`, `1. task` | The bullet is removed |
| `- [x] task` | Ignored, and kept in the note by `--clear` |

On Friday 23 October 2026 at 16:00, these lines give the following reminders.

| Line | Reminder | List | Due | Priority |
| --- | --- | --- | --- | --- |
| `Call the bank tomorrow 9am #errands !!` | Call the bank | Errands | Sat 24 Oct 09:00 | Medium |
| `Send slides friday #work` | Send slides | Work | Fri 30 Oct 09:00 | None |
| `Water the plants tonight` | Water the plants | default | Fri 23 Oct 20:00 | None |
| `Plan the team offsite in 2 weeks !!!` | Plan the team offsite | default | Fri 6 Nov 09:00 | High |

## focus-report

Adds up scheduled time per calendar or per `#tag` over whole days.

| Option | Default | Meaning |
| --- | --- | --- |
| `--from` | 6 days before `--to` | First day, `YYYY-MM-DD` |
| `--to` | today | Last day, included |
| `--group-by` | `calendar` | `calendar` or `tag` (tags come from the title and the notes) |
| `--calendars` | all | Comma-separated calendar names |
| `--format` | `markdown` | `markdown`, `csv` or `json` |
| `--output` | stdout | Write to this file |

All-day events are not counted. Events crossing the range edges count only for the part inside. With `--group-by tag`, an event with two tags counts in full under each, and the report says so.

## Snapshot format

`--input` takes a JSON object. Every field is optional. Dates without an offset are read in local time. [`tests/fixtures/week-2026-w43.json`](../tests/fixtures/week-2026-w43.json) is a complete example, and this is the shape in short.

```json
{
  "now": "2026-10-23T16:00:00",
  "reminderLists": ["Reminders", "Errands"],
  "events": [{ "calendar": "Work", "title": "Planning", "start": "2026-10-21T10:00:00", "end": "2026-10-21T11:00:00", "recurrence": "FREQ=WEEKLY" }],
  "reminders": [{ "list": "Errands", "title": "Buy stamps", "completed": false, "due": "2026-10-22T09:00:00" }],
  "notes": [{ "folder": "Projects", "title": "Garden plan", "modifiedAt": "2026-10-20T19:00:00", "body": "<div>...</div>" }],
  "mail": [{ "subject": "Invoice", "sender": "Billing <billing@example.com>", "receivedAt": "2026-10-21T08:12:00" }]
}
```
