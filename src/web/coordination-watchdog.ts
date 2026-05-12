import { logger } from '../logger.js'
import { MAIN_AGENT_ID } from '../config.js'
import {
  getStuckDeliveredMessages,
  markAgentMessageStuckAlerted,
  type AgentMessage,
} from '../db.js'
import {
  agentSessionName,
  capturePane,
  isSessionReadyForPrompt,
  sendPromptToSession,
} from './agent-process.js'
import { detectPaneState } from '../pane-state.js'
import { MAIN_CHANNELS_SESSION } from './main-agent.js'

// Both thresholds env-configurable so an operator can tune without a redeploy.
// Defaults match the failure scenario reported on 2026-04-28: Marveen waited
// silently for 9min on Chris before noticing -- 5min is the smallest gap that
// avoids alerting during normal long-running specialist work, 30s scan keeps
// follow-up latency bounded.
const SCAN_INTERVAL_MS = clamp(
  parseInt(process.env['MARVEEN_COORD_SCAN_MS'] ?? '30000', 10),
  5_000,
  600_000,
)
const STUCK_THRESHOLD_MS = clamp(
  parseInt(process.env['MARVEEN_COORD_STUCK_MS'] ?? String(5 * 60 * 1000), 10),
  60_000,
  60 * 60 * 1000,
)

const alerted = new Set<number>()

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

function sessionFor(agent: string): string {
  return agent === MAIN_AGENT_ID ? MAIN_CHANNELS_SESSION : agentSessionName(agent)
}

function fmtClock(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function tick(): void {
  const cutoffSec = Math.floor((Date.now() - STUCK_THRESHOLD_MS) / 1000)
  let stuck: AgentMessage[]
  try {
    stuck = getStuckDeliveredMessages(cutoffSec)
  } catch (err) {
    logger.warn({ err }, 'Coordination watchdog: stuck query failed')
    return
  }

  for (const msg of stuck) {
    if (alerted.has(msg.id)) continue

    const targetSession = sessionFor(msg.to_agent)
    const targetPane = capturePane(targetSession)
    if (targetPane == null) continue
    if (detectPaneState(targetPane) !== 'idle') continue

    const senderSession = sessionFor(msg.from_agent)
    if (!isSessionReadyForPrompt(senderSession)) continue

    const deliveredSec = msg.delivered_at ?? msg.created_at
    const idleMin = Math.max(
      1,
      Math.round((Date.now() - deliveredSec * 1000) / 60_000),
    )
    const snippet =
      msg.content.length > 80 ? msg.content.slice(0, 77) + '...' : msg.content
    const headsUp =
      `[SYSTEM: stuck coordination] You delegated msg #${msg.id} ("${snippet}") ` +
      `to @${msg.to_agent} at ${fmtClock(deliveredSec)}, but @${msg.to_agent} ` +
      `has been idle for ~${idleMin}min with no reply queued. ` +
      `Peek the pane (tmux capture-pane -t ${targetSession}) or send a follow-up.`

    try {
      sendPromptToSession(senderSession, headsUp)
      markAgentMessageStuckAlerted(msg.id, Math.floor(Date.now() / 1000))
      alerted.add(msg.id)
      logger.info(
        {
          id: msg.id,
          from: msg.from_agent,
          to: msg.to_agent,
          idleMin,
        },
        'Coordination watchdog: stuck-alert sent',
      )
    } catch (err) {
      logger.warn(
        { err, id: msg.id },
        'Coordination watchdog: failed to inject heads-up',
      )
    }
  }
}

export function startCoordinationWatchdog(): NodeJS.Timeout {
  return setInterval(tick, SCAN_INTERVAL_MS)
}

export function getCoordinationWatchdogConfig(): {
  scanIntervalMs: number
  stuckThresholdMs: number
} {
  return { scanIntervalMs: SCAN_INTERVAL_MS, stuckThresholdMs: STUCK_THRESHOLD_MS }
}
