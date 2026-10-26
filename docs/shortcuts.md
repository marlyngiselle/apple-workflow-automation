# Shortcuts recipes

Every command is a single shell line, so any shortcut can run it with the Run Shell Script action. That puts awa in the menu bar, on a keyboard shortcut, in Siri or in a Focus automation.

## One-time setup

1. Build the bundles and put `awa` on a fixed path:

   ```bash
   npm run build
   mkdir -p "$HOME/.local/bin"
   ln -sf "$PWD/bin/awa" "$HOME/.local/bin/awa"
   ```

2. In Shortcuts, open Settings > Advanced and turn on Allow Running Scripts.
3. Run each shortcut once by hand and accept the prompts. Shortcuts asks for its own consent, separate from Terminal's (see [permissions](permissions.md)).

## Recipes

Each recipe is one Run Shell Script action, shell `zsh`, input "Nothing". Shortcuts does not load your shell profile, so the path is spelled out.

| Shortcut | Script | Pair it with |
| --- | --- | --- |
| Weekly review | `"$HOME/.local/bin/awa" weekly-review --folder "Reviews" --source-folder "Projects"` | Show Notification with the Shell Script Result |
| Last week's review | `"$HOME/.local/bin/awa" weekly-review --week last` | Monday morning automation |
| Prep my next meetings | `"$HOME/.local/bin/awa" meeting-prep --hours 3 --min-attendees 2` | Time of day automation, every weekday at 08:30 |
| Empty my inbox note | `"$HOME/.local/bin/awa" inbox-to-reminders --note "Inbox" --clear` | Keyboard shortcut |
| Focus this month | `"$HOME/.local/bin/awa" focus-report --group-by tag --from 2026-10-01 --to 2026-10-31` | Quick Look, or Save File |

## Passing input from a shortcut

Run Shell Script can pass the shortcut's input as arguments. Set Pass Input to "as arguments" and use `"$1"`.

```bash
"$HOME/.local/bin/awa" weekly-review --week "$1"
```

Combined with an Ask for Input action, this gives a "Review which week?" prompt that accepts `last` or `2026-W43`.

## Machine-readable results

Add `--json` and feed the Shell Script Result into Get Dictionary from Input. Every command returns `ok`, `command`, `dryRun` and its own fields, for example `stats.remindersOverdue` for the weekly review.

```bash
"$HOME/.local/bin/awa" weekly-review --json
```

## When a shortcut fails

The action shows the stderr line and the shortcut stops. The exit codes are the same as in the terminal, 2 for a bad option, 3 for a missing consent and 4 when a folder, note or list does not exist.
