// GET /api/sessions -- live status + pane preview for every agent. The
// frontend Sessions page polls this every few seconds so the user can see
// at a glance who is busy and what they are working on. The pane-state
// cache here is intentionally module-scoped and in-memory: stale
// "busy since 2 days ago" timers would be worse than a fresh zero on
// dashboard restart.

import { execSync } from 'node:child_process'
import { json } from '../http-helpers.js'
import {
  agentSessionName,
  capturePane,
} from '../agent-process.js'
import {
  listAgentNames,
  readAgentDisplayName,
} from '../agent-config.js'
import { MAIN_CHANNELS_SESSION } from '../main-agent.js'
import { BOT_NAME, MAIN_AGENT_ID } from '../../config.js'
import { detectPaneState, type PaneState } from '../../pane-state.js'
import type { RouteContext } from './types.js'

type ObservedPaneState = PaneState | 'stopped'

const sessionStateCache = new Map<
  string,
  { state: ObservedPaneState; since: number }
>()

function listRunningTmuxSessions(): Set<string> {
  try {
    const out = execSync('tmux list-sessions -F "#{session_name}"', {
      timeout: 3000,
      encoding: 'utf-8',
    })
    return new Set(
      out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

// Strip the live input box, footer, and ❯ prompt from a capture, then
// return the last `maxLines` non-empty content lines. Each line is
// truncated so the API payload stays bounded even if an agent dumps a
// wide log line.
const FOOTER_RX =
  /bypass permissions on \(shift\+tab to cycle\)|\? for shortcuts|esc to interrupt/
const BOX_SEP_RX = /─{10,}/

function buildSessionPreview(
  pane: string,
  maxLines = 12,
  maxLen = 200,
): string[] {
  if (!pane) return []
  const lines = pane.split('\n')
  let cutAt = lines.length
  let footerIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (FOOTER_RX.test(lines[i])) {
      footerIdx = i
      break
    }
  }
  if (footerIdx >= 0) {
    let bottomSep = -1
    for (let i = footerIdx - 1; i >= 0; i--) {
      if (BOX_SEP_RX.test(lines[i])) {
        bottomSep = i
        break
      }
    }
    let topSep = -1
    if (bottomSep > 0) {
      for (let i = bottomSep - 1; i >= 0; i--) {
        if (BOX_SEP_RX.test(lines[i])) {
          topSep = i
          break
        }
      }
    }
    cutAt = topSep >= 0 ? topSep : bottomSep >= 0 ? bottomSep : footerIdx
  }
  const out: string[] = []
  for (const raw of lines.slice(0, cutAt)) {
    const trimmedRight = raw.replace(/\s+$/, '')
    if (!trimmedRight.trim()) continue
    if (BOX_SEP_RX.test(trimmedRight)) continue
    if (/^\s*❯[ \t]/.test(trimmedRight)) continue
    if (/esc to interrupt/.test(trimmedRight)) continue
    out.push(
      trimmedRight.length > maxLen
        ? trimmedRight.slice(0, maxLen) + '…'
        : trimmedRight,
    )
  }
  return out.slice(-maxLines)
}

interface SessionObservation {
  paneState: PaneState | null
  sinceMs: number | null
  preview: string[]
}

function observeSessionState(
  session: string,
  isRunning: boolean,
): SessionObservation {
  if (!isRunning) {
    sessionStateCache.delete(session)
    return { paneState: null, sinceMs: null, preview: [] }
  }
  const pane = capturePane(session)
  const now = Date.now()
  if (pane == null) {
    const cached = sessionStateCache.get(session)
    if (!cached || cached.state !== 'unknown') {
      sessionStateCache.set(session, { state: 'unknown', since: now })
      return { paneState: 'unknown', sinceMs: 0, preview: [] }
    }
    return {
      paneState: 'unknown',
      sinceMs: now - cached.since,
      preview: [],
    }
  }
  const state = detectPaneState(pane)
  const cached = sessionStateCache.get(session)
  let since: number
  if (!cached || cached.state !== state) {
    since = now
    sessionStateCache.set(session, { state, since })
  } else {
    since = cached.since
  }
  return {
    paneState: state,
    sinceMs: now - since,
    preview: buildSessionPreview(pane),
  }
}

export async function tryHandleSessions(ctx: RouteContext): Promise<boolean> {
  const { path, method, res } = ctx
  if (path !== '/api/sessions' || method !== 'GET') return false

  const running = listRunningTmuxSessions()

  const sessions: Array<{
    name: string
    displayName: string
    avatar: string
    role: 'main' | 'sub'
    running: boolean
    paneState: PaneState | null
    sinceMs: number | null
    busyForMs: number | null
    preview: string[]
  }> = []

  // Main agent first.
  const mainRunning = running.has(MAIN_CHANNELS_SESSION)
  const mainObs = observeSessionState(MAIN_CHANNELS_SESSION, mainRunning)
  sessions.push({
    name: MAIN_AGENT_ID,
    displayName: BOT_NAME,
    avatar: '/api/marveen/avatar',
    role: 'main',
    running: mainRunning,
    paneState: mainObs.paneState,
    sinceMs: mainObs.sinceMs,
    busyForMs: mainObs.paneState === 'busy' ? mainObs.sinceMs : null,
    preview: mainObs.preview,
  })

  for (const name of listAgentNames()) {
    const session = agentSessionName(name)
    const isRunning = running.has(session)
    const obs = observeSessionState(session, isRunning)
    sessions.push({
      name,
      displayName: readAgentDisplayName(name),
      avatar: `/api/agents/${encodeURIComponent(name)}/avatar`,
      role: 'sub',
      running: isRunning,
      paneState: obs.paneState,
      sinceMs: obs.sinceMs,
      busyForMs: obs.paneState === 'busy' ? obs.sinceMs : null,
      preview: obs.preview,
    })
  }

  json(res, { sessions })
  return true
}
