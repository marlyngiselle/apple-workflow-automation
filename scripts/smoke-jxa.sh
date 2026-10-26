#!/usr/bin/env bash
# Runs every bundled command through osascript, the real JXA runtime, against the
# synthetic snapshot in tests/fixtures. No app is ever contacted:
#   1. every command runs with --input, which reads the snapshot and forces --dry-run;
#   2. on top of that, the one Application() call in each bundle is replaced with a
#      function that throws, and the script refuses to run if any other call remains.
# The output must match the Node snapshots byte for byte, which proves the bundles
# behave the same under JavaScriptCore as the tested modules do under Node.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/tests/fixtures/week-2026-w43.json"
SNAPSHOTS="$ROOT/tests/__snapshots__"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ "$(uname -s)" = "Darwin" ] || { echo "smoke-jxa: needs macOS (osascript)" >&2; exit 2; }

for cmd in weekly-review meeting-prep inbox-to-reminders focus-report; do
  src="$ROOT/dist/$cmd.js"
  [ -f "$src" ] || { echo "smoke-jxa: $src missing, run npm run build" >&2; exit 2; }
  [ "$(grep -c 'cache\[name\] = Application(name);' "$src")" = "1" ] || { echo "smoke-jxa: unexpected Application() layout in $cmd" >&2; exit 1; }
  {
    echo "function awaSmokeBlockedApplication(name) { throw new Error('smoke run: access to ' + name + ' is blocked'); }"
    sed 's/cache\[name\] = Application(name);/cache[name] = awaSmokeBlockedApplication(name);/' "$src"
  } > "$WORK/$cmd.js"
  if grep -v '^[[:space:]]*//' "$WORK/$cmd.js" | grep -E '(^|[^A-Za-z_.$])Application[[:space:]]*\(' >/dev/null; then
    echo "smoke-jxa: $cmd still calls Application(), refusing to run" >&2
    exit 1
  fi
done

pass=0
fail=0

run() {
  local cmd="$1" json="$2"
  osascript -l JavaScript "$WORK/$cmd.js" "$json"
}

expect_same() {
  local name="$1" expected="$2" actual="$3"
  if [ "$(printf '%s' "$actual" | tr -d '\r')" = "$(tr -d '\r' < "$expected" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')" ]; then
    echo "ok    $name"; pass=$((pass + 1))
  else
    echo "FAIL  $name"; fail=$((fail + 1))
    diff <(tr -d '\r' < "$expected") <(printf '%s\n' "$actual" | tr -d '\r') | head -20 || true
  fi
}

expect_match() {
  local name="$1" pattern="$2" actual="$3"
  if printf '%s' "$actual" | grep -Eq -- "$pattern"; then
    echo "ok    $name"; pass=$((pass + 1))
  else
    echo "FAIL  $name: no match for /$pattern/"; fail=$((fail + 1))
    printf '%s\n' "$actual" | head -10
  fi
}

expect_exit() {
  local name="$1" code="$2" pattern="$3" cmd="$4" json="$5" status=0 err
  err="$(osascript -l JavaScript "$WORK/$cmd.js" "$json" 2>&1 >/dev/null)" || status=$?
  if [ "$status" = "$code" ] && printf '%s' "$err" | grep -Eq -- "$pattern"; then
    echo "ok    $name"; pass=$((pass + 1))
  else
    echo "FAIL  $name: exit $status, stderr: $err"; fail=$((fail + 1))
  fi
}

# JSON arguments: the snapshot plus extra fields. printf keeps the braces away from the shell.
with_input() {
  printf '{"input":"%s"%s}' "$FIXTURE" "${1:-}"
}

out="$(run weekly-review "$(with_input ',"sourceFolder":"Projects","includeMail":true')")"
expect_same "weekly-review markdown matches the Node snapshot" "$SNAPSHOTS/weekly-review.md" "$out"

out="$(run weekly-review "$(with_input ',"sourceFolder":"Projects","includeMail":true,"format":"html"')")"
expect_same "weekly-review html matches the Node snapshot" "$SNAPSHOTS/weekly-review.html" "$out"

out="$(run focus-report "$(with_input ',"from":"2026-10-19","to":"2026-10-25"')")"
expect_same "focus-report by calendar matches the Node snapshot" "$SNAPSHOTS/focus-report-by-calendar.md" "$out"

out="$(run focus-report "$(with_input ',"from":"2026-10-19","to":"2026-10-25","groupBy":"tag","format":"csv"')")"
expect_same "focus-report CSV by tag matches the Node snapshot" "$SNAPSHOTS/focus-report-by-tag.csv" "$out"

out="$(run meeting-prep "$(with_input)")"
expect_match "meeting-prep finds the two meetings in the next 4 hours" '^# Prep 2026-10-23 17:00 Customer demo' "$out"
expect_match "meeting-prep separates the second meeting" '# Prep 2026-10-23 18:30 Weekly wrap-up' "$out"

out="$(run inbox-to-reminders "$(with_input)")"
expect_match "inbox-to-reminders plans 6 reminders and skips 1 duplicate" '^6 to add, 1 already open\.' "$out"

out="$(run weekly-review "$(with_input ',"json":true')")"
expect_match "--json returns a machine-readable result" '"remindersOverdue": 2' "$out"

out="$(osascript -l JavaScript "$WORK/focus-report.js" --help)"
expect_match "flags work when a script is run directly" '^awa focus-report: ' "$out"

expect_exit "unknown option exits 2 with a suggestion" 2 'Did you mean --folder' weekly-review "$(with_input ',"foldr":"x"')"
expect_exit "unreadable snapshot exits 5" 5 'Cannot read' weekly-review '{"input":"/nonexistent/snapshot.json"}'
expect_exit "missing capture note exits 4" 4 'No note titled "Nope"' inbox-to-reminders "$(with_input ',"note":"Nope"')"

echo "smoke-jxa: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
