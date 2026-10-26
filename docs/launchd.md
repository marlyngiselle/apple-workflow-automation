# Running on a schedule with launchd

`examples/launchd/local.awa.weekly-review.plist` is a user agent that runs `awa weekly-review --folder Reviews` every Friday at 17:00. `scripts/install-launchd.sh` fills in the paths and loads it.

```bash
npm run build
awa weekly-review --dry-run
scripts/install-launchd.sh print
scripts/install-launchd.sh install
```

The dry run comes first on purpose. A launchd job cannot show a consent prompt, so the consents must already exist (see [permissions](permissions.md)).

| Task | Command |
| --- | --- |
| See the plist it will install | `scripts/install-launchd.sh print` |
| Install and load | `scripts/install-launchd.sh install` |
| Run it now | `launchctl kickstart "gui/$(id -u)/local.awa.weekly-review"` |
| What launchd knows | `scripts/install-launchd.sh status` |
| Read the log | `tail -n 50 ~/Library/Logs/awa/weekly-review.log` |
| Remove | `scripts/install-launchd.sh uninstall` |

## Changing the schedule

Edit `StartCalendarInterval` in the template and install again. `Weekday` counts from 0 (Sunday), so 5 is Friday. This is a Sunday evening review at 19:00.

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Weekday</key>
  <integer>0</integer>
  <key>Hour</key>
  <integer>19</integer>
  <key>Minute</key>
  <integer>0</integer>
</dict>
```

If the Mac is asleep at that time, launchd runs the job once it wakes. If it is off, the run is skipped until the next week.

## More agents

Copy the template, change `Label`, the file name and `ProgramArguments`. A weekday meeting-prep at 08:30 needs one `StartCalendarInterval` dictionary per weekday inside an array.

> [!NOTE]
> Re-running the weekly review is safe. The note for the week is found by its title and refreshed, and what you wrote under Reflection stays. Renaming the note detaches it, so the next run starts a new one (see [ADR 0003](adr/0003-idempotent-notes-by-title.md)).
