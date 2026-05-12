#!/bin/bash
# Start main agent services

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Read only what this script actually needs; avoid `set -a && source .env`,
# which would leak TELEGRAM_BOT_TOKEN into the environment and then into
# every tmux session the dashboard launches (see channels.sh for details).
if [ -f "$INSTALL_DIR/.env" ]; then
  SLUG="$(grep -E '^MAIN_AGENT_ID=' "$INSTALL_DIR/.env" | head -1 | cut -d= -f2-)"
  BOT_NAME="$(grep -E '^BOT_NAME=' "$INSTALL_DIR/.env" | head -1 | cut -d= -f2-)"
fi
SLUG="${SLUG:-marveen}"

echo "${BOT_NAME:-Marveen} inditas..."
OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  launchctl load "$HOME/Library/LaunchAgents/com.${SLUG}.dashboard.plist" 2>/dev/null || true
  launchctl load "$HOME/Library/LaunchAgents/com.${SLUG}.channels.plist" 2>/dev/null || true
elif [ "$OS" = "Linux" ]; then
  if systemctl --user start "${SLUG}-dashboard" "${SLUG}-channels" 2>/dev/null; then
    : # systemctl --user worked
  else
    # systemctl --user unavailable (LXC/root without D-Bus); start directly.
    # Augment PATH so node can find claude (installed under ~/.local/bin etc.)
    export PATH="$HOME/.local/bin:$HOME/.npm/bin:/usr/local/bin:$PATH"
    NODE_BIN="$(command -v node || echo node)"
    nohup "$NODE_BIN" "$INSTALL_DIR/dist/index.js" \
      >"$INSTALL_DIR/store/dashboard.log" 2>&1 &
    disown $!
    # Restart the main agent channels session.
    nohup bash "$INSTALL_DIR/scripts/channels.sh" \
      >/dev/null 2>&1 &
    disown $!
  fi
fi

echo "✓ Dashboard: http://localhost:3420"
echo "✓ Telegram csatorna inditva"
