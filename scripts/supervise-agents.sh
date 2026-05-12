#!/bin/bash
# Periodic supervisor: walks /opt/projects/marveen/agents and ensures every
# agent that has Telegram configured is running. Idempotent. Designed to be
# invoked by marveen-agents.timer every minute.
#
# Why this exists separately from the dashboard's telegram-plugin monitor:
# the in-dashboard monitor only restarts agents that are *already running*
# but whose bun grandchild died. A clean tmux session crash (whole session
# gone) is not auto-recovered by the dashboard. This script closes that gap.

set -u

AGENTS_DIR="/opt/projects/marveen/agents"
DASHBOARD_URL="${MARVEEN_DASHBOARD_URL:-http://localhost:3420}"
TOKEN_FILE="/opt/projects/marveen/store/.dashboard-token"
LOG="/opt/projects/marveen/store/supervise-agents.log"

ts() { date -Iseconds; }
log() { echo "$(ts) $*" >>"$LOG"; }

# Wait for dashboard token file (max 30s) -- on cold boot the dashboard
# generates this file on its first run.
for i in $(seq 1 30); do
  [[ -s "$TOKEN_FILE" ]] && break
  sleep 1
done
if [[ ! -s "$TOKEN_FILE" ]]; then
  log "no dashboard token after 30s, aborting"
  exit 1
fi
TOKEN=$(<"$TOKEN_FILE")

# Wait for dashboard HTTP to answer (auth-status is the only public probe).
for i in $(seq 1 30); do
  if curl -fsS -m 2 "$DASHBOARD_URL/api/auth/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# --- Liveness probe for the main agent ---
# Uses getMe (non-competing, idempotent) instead of getUpdates.
# getUpdates competes with grammy's long-poll slot: a simultaneous external
# getUpdates can cause a 409 on grammy's side, disrupting message delivery.
# getMe just verifies the token is valid and the API is reachable; the
# dashboard's in-process monitor handles frozen-event-loop detection.
probe_main_polling() {
  local env_file="/opt/projects/marveen/.env"
  [[ -f "$env_file" ]] || return 0  # token unknown, skip
  local token
  token=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$env_file" | head -1 | cut -d= -f2-)
  [[ -n "$token" ]] || return 0
  # Three probes; all must fail before we restart (network blips are common).
  local dead=0
  for i in 1 2 3; do
    local res
    res=$(curl -fsS -m 5 "https://api.telegram.org/bot${token}/getMe" 2>/dev/null) || res=""
    if echo "$res" | grep -q '"ok":true'; then
      return 0  # healthy: token valid, API reachable
    fi
    dead=$((dead + 1))
    sleep 1
  done
  if [[ "$dead" -ge 3 ]]; then
    log "main bot unreachable (3/3 getMe probes failed); restarting marveen-channels"
    /usr/bin/systemctl restart marveen-channels.service >/dev/null 2>&1
    return 1
  fi
  return 0
}
probe_main_polling

# --- Local-side probe: claude is up but plugin never spawned ---
# The dashboard's monitor only escalates after a plugin-down state spans
# multiple ticks AND it can run /mcp soft-reconnect. When `claude --channels
# plugin:telegram@...` starts but the MCP launcher fails to spawn the bun
# (intermittent — the /mcp menu shows "plugin:telegram:telegram · ✘ failed"),
# the dashboard can hit "gave_up" without recovering. Catch this from
# outside: if the channels.service is up >90s but bot.pid is missing or
# points to a dead PID, force a restart.
probe_main_pid_present() {
  local svc_state svc_uptime_s
  svc_state=$(systemctl is-active marveen-channels.service 2>/dev/null)
  [[ "$svc_state" == "active" ]] || return 0  # systemd will handle inactive
  # Wall-clock active timestamp (Monotonic property is unreliable inside LXC).
  local active_str active_ts
  active_str=$(systemctl show -p ActiveEnterTimestamp --value marveen-channels.service 2>/dev/null)
  [[ -n "$active_str" ]] || return 0
  active_ts=$(date -d "$active_str" +%s 2>/dev/null) || return 0
  svc_uptime_s=$(( $(date +%s) - active_ts ))
  (( svc_uptime_s >= 90 )) || return 0  # too soon to judge, plugin may still be starting
  local pid_file="/opt/projects/marveen/.claude/channels/telegram/bot.pid"
  local pid="" alive=0
  [[ -f "$pid_file" ]] && pid=$(<"$pid_file")
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    alive=1
  fi
  if (( alive == 0 )); then
    log "main bot pid missing or dead (svc up ${svc_uptime_s}s, pid='$pid'); restarting marveen-channels"
    /usr/bin/systemctl restart marveen-channels.service >/dev/null 2>&1
    return 1
  fi
  return 0
}
probe_main_pid_present

started=0
checked=0
for d in "$AGENTS_DIR"/*/; do
  name=$(basename "$d")
  [[ "$name" == _* ]] && continue
  # Only manage agents that have Telegram configured (have a token .env).
  [[ -f "$d/.claude/channels/telegram/.env" ]] || continue
  checked=$((checked + 1))
  session="agent-$name"
  if tmux has-session -t "$session" 2>/dev/null; then
    continue
  fi
  log "agent $name not running, starting via dashboard API"
  resp=$(curl -fsS -m 10 -X POST -H "Authorization: Bearer $TOKEN" \
    "$DASHBOARD_URL/api/agents/$name/start" 2>&1) || {
    log "  start failed: $resp"
    continue
  }
  started=$((started + 1))
done
log "tick: checked=$checked started=$started"
