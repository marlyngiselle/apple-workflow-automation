#!/usr/bin/env bash
# Installs, removes or inspects the weekly-review launchd agent for the current user.
#
#   scripts/install-launchd.sh print       show the rendered plist, change nothing
#   scripts/install-launchd.sh install     write it to ~/Library/LaunchAgents and load it
#   scripts/install-launchd.sh uninstall   unload it and delete the plist
#   scripts/install-launchd.sh status      what launchd knows about the job
#
# Run awa weekly-review once by hand from Terminal first, so macOS asks for the
# Calendar, Reminders and Notes permissions while you are there to answer.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="local.awa.weekly-review"
TEMPLATE="$ROOT/examples/launchd/$LABEL.plist"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

render() {
  sed -e "s|__AWA__|$ROOT/bin/awa|g" -e "s|__HOME__|$HOME|g" "$TEMPLATE"
}

case "${1:-print}" in
  print)
    render
    ;;
  install)
    [ -f "$ROOT/dist/weekly-review.js" ] || { echo "Build first: npm run build" >&2; exit 2; }
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/awa"
    render > "$TARGET"
    plutil -lint "$TARGET" >/dev/null
    launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$TARGET"
    echo "Installed $TARGET. Logs: $HOME/Library/Logs/awa/weekly-review.log"
    echo "Run it now with: launchctl kickstart $DOMAIN/$LABEL"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
    rm -f "$TARGET"
    echo "Removed $LABEL."
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL"
    ;;
  *)
    echo "Usage: $0 print|install|uninstall|status" >&2
    exit 2
    ;;
esac
