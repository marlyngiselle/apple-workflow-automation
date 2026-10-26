# Permissions

macOS protects Calendar, Reminders, Notes and Mail behind two kinds of consent. awa needs both for the apps it touches, and the prompts appear the first time a command reaches each app.

| Prompt | Wording (roughly) | Needed for | Where to change it later |
| --- | --- | --- | --- |
| Automation | "Terminal wants access to control Calendar" | Every app awa talks to | System Settings > Privacy & Security > Automation |
| Calendars | "Terminal would like full access to your calendars" | Calendar | System Settings > Privacy & Security > Calendars |
| Reminders | "Terminal would like full access to your reminders" | Reminders | System Settings > Privacy & Security > Reminders |

Notes and Mail only use the Automation consent.

> [!IMPORTANT]
> The consent belongs to the app that started `osascript`, not to awa. Terminal, iTerm, Visual Studio Code, Shortcuts and launchd each ask separately. Grant it once from the app you will actually use.

## First run, in order

```bash
awa doctor
awa weekly-review --dry-run
awa meeting-prep --dry-run
awa inbox-to-reminders --dry-run
```

Each dry run reads from the apps, so it triggers the prompts without writing anything. Answer them, then run the commands for real.

## Which commands need which apps

| Command | Calendar | Reminders | Notes | Mail |
| --- | --- | --- | --- | --- |
| `weekly-review` | Read | Read | Read (with `--source-folder`) and write | Read (with `--include-mail`) |
| `meeting-prep` | Read | | Write | |
| `inbox-to-reminders` | | Read and write | Read (and write with `--clear`) | |
| `focus-report` | Read | | | |

## When something was refused

A refused consent makes the command exit with status 3 and print a hint like this one.

```text
awa weekly-review: macOS did not allow access to Calendar.
hint: Open System Settings > Privacy & Security > Automation and allow your terminal (or Shortcuts) to control Calendar. ...
```

To be asked again from scratch, reset the consent for your terminal app. This resets it for every app that terminal controls.

```bash
tccutil reset AppleEvents com.apple.Terminal
tccutil reset Calendar com.apple.Terminal
tccutil reset Reminders com.apple.Terminal
```

## Scheduled runs

A launchd agent cannot show a prompt. Run the command once by hand first, from the same app that will own the job, so the consent is already in place. If the scheduled run still exits with status 3, open the log in `~/Library/Logs/awa/` and grant the consent listed there. See [launchd](launchd.md).

## Shortcuts

Shortcuts asks for its own consent, and only runs shell scripts once Settings > Advanced > Allow Running Scripts is on. See [Shortcuts](shortcuts.md).
