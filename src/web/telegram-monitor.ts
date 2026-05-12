import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync, execFileSync } from 'node:child_process'
import { resolveFromPath } from '../platform.js'
import { logger } from '../logger.js'
import { MAIN_AGENT_ID, BOT_NAME, PROJECT_ROOT } from '../config.js'
import { agentDir, listAgentNames } from './agent-config.js'
import {
  agentSessionName,
  isAgentRunning,
  isSessionReadyForPrompt,
  sendPromptToSession,
  startAgentProcess,
  stopAgentProcess,
} from './agent-process.js'
import { MAIN_CHANNELS_SESSION, MAIN_CHANNELS_PLIST } from './main-agent.js'
import { sendMarveenAlert } from './telegram.js'

const TMUX = resolveFromPath('tmux')
const CLAUDE = resolveFromPath('claude')

// --- Telegram Plugin Health Monitor ---
// Detect when the bun server.ts grandchild dies under a Claude session
// by walking the process tree. (We deliberately don't pane-scan for
// "Failed to reconnect" strings -- those persist in scrollback and fire
// false positives, e.g. if the source containing the regex is shown.)
// Agents recover via stop+start; for the main agent's channels session
// we can only alert, because killing it would terminate the live agent.

function getClaudePidForSession(session: string): number | null {
  try {
    const out = execFileSync(TMUX, ['list-panes', '-t', session, '-F', '#{pane_pid}'], { timeout: 3000, encoding: 'utf-8' })
    const panePid = parseInt(out.trim().split('\n')[0], 10)
    if (!panePid) return null
    const cmd = execFileSync('/bin/ps', ['-p', String(panePid), '-o', 'comm='], { timeout: 3000, encoding: 'utf-8' }).trim()
    if (cmd === 'claude' || cmd.endsWith('/claude')) return panePid
    try {
      const child = execFileSync('/usr/bin/pgrep', ['-P', String(panePid), '-x', 'claude'], { timeout: 3000, encoding: 'utf-8' }).trim()
      if (child) return parseInt(child.split('\n')[0], 10)
    } catch { /* none */ }
    return null
  } catch {
    return null
  }
}

// Read TELEGRAM_BOT_TOKEN from the channel .env file for a given pidDir.
function readBotToken(pidDir: string): string | null {
  const envPath = join(pidDir, '.env')
  if (!existsSync(envPath)) return null
  try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (t.startsWith('TELEGRAM_BOT_TOKEN=')) {
        return t.slice('TELEGRAM_BOT_TOKEN='.length).trim() || null
      }
    }
  } catch { /* unreadable */ }
  return null
}

// Returns true if someone is actively polling the bot (Telegram returns 409
// Conflict when another getUpdates call is already in flight). On network
// error we optimistically return true to avoid false-positive dead detection.
async function isBotPolling(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=-1&limit=1&timeout=2`,
      { signal: AbortSignal.timeout(6000) },
    )
    const body = await res.json() as { error_code?: number }
    return body.error_code === 409
  } catch {
    return true // network failure -- don't false-positive
  }
}

function hasTelegramPluginAlive(claudePid: number, agentName?: string): boolean {
  try {
    const ps = execFileSync('/bin/ps', ['-axo', 'pid,ppid,command'], { timeout: 3000, encoding: 'utf-8' })
    const lines = ps.split('\n').slice(1)
    const childrenOf = new Map<number, number[]>()
    const cmdOf = new Map<number, string>()
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
      if (!m) continue
      const pid = parseInt(m[1], 10)
      const ppid = parseInt(m[2], 10)
      cmdOf.set(pid, m[3])
      const arr = childrenOf.get(ppid) || []
      arr.push(pid)
      childrenOf.set(ppid, arr)
    }
    const stack = [claudePid]
    const seen = new Set<number>()
    while (stack.length) {
      const p = stack.pop()!
      if (seen.has(p)) continue
      seen.add(p)
      const cmd = cmdOf.get(p) || ''
      // The plugin is alive only if the actual `bun server.ts` poller is in
      // the subtree. The `bun run` supervisor (whose argv carries the
      // /telegram/ path) survives a server.ts crash for a window before
      // exiting itself, so matching it alone gave a false-positive alive
      // while polling was already dead.
      if (/\bbun\b/.test(cmd) && cmd.includes('server.ts')) return true
      for (const k of (childrenOf.get(p) || [])) stack.push(k)
    }
    // Fallback: bun may have been reparented to init (ppid=1) after its
    // intermediate parent crashed. The subtree walk from claudePid then
    // misses it and we declare the plugin down even though it's fine.
    // Check bot.pid directly as a last-resort liveness signal.
    const pidDir = agentName
      ? join(agentDir(agentName), '.claude', 'channels', 'telegram')
      : join(homedir(), '.claude', 'channels', 'telegram')
    const pidPath = join(pidDir, 'bot.pid')
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10)
      if (pid > 1) {
        try {
          process.kill(pid, 0)
          const cmd = cmdOf.get(pid) || ''
          if (cmd.includes('bun') || cmd.includes('server.ts') || cmd.includes('telegram')) {
            logger.debug({ claudePid, orphanPid: pid, agentName }, 'Telegram plugin alive via bot.pid (reparented)')
            return true
          }
        } catch { /* process gone */ }
      }
    }
    return false
  } catch {
    return false
  }
}

const agentDownSince: Map<string, number> = new Map()
const agentLastRestart: Map<string, number> = new Map()
const AGENT_RESTART_GRACE_MS = 90_000
const PLUGIN_ALERT_DEDUP_MS = 30 * 60 * 1000

// Marveen recovery is a 4-stage escalator because killing the session
// terminates the live Marveen conversation, so we try cheap fixes first.
// The "save" stage gives Marveen one tick to persist hot/warm memory to
// SQLite before we pull the rug, so the next session wakes up with the
// last-moment context from the dying one.
type MarveenRecoveryStage = 'soft' | 'save' | 'hard' | 'gave_up'
interface MarveenDownState {
  downSince: number
  stage: MarveenRecoveryStage
  lastAlertAt: number
  softAttempts: number
  // When we last transitioned to the current stage. Used by 'save' to
  // honour the announced ~60s memory-save grace before jumping to 'hard'.
  stageStartedAt?: number
}

const SAVE_WINDOW_MS = 60_000
let marveenDownState: MarveenDownState | null = null

function softReconnectMarveen(): boolean {
  // /mcp opens Claude Code's MCP status dialog; a follow-up Enter picks
  // the first action (Reconnect if the plugin is disconnected). We send
  // Escape first in case a different dialog is already open.
  //
  // Guard: if the session is mid-turn (esc to interrupt on screen) or the
  // operator has text parked in the input box, our Escape would interrupt
  // their turn or wipe what they typed. In that case bail out -- the caller
  // will retry on the next outage tick, by which point the pane is likely
  // idle again.
  if (!isSessionReadyForPrompt(MAIN_CHANNELS_SESSION)) {
    logger.warn('Marveen soft reconnect skipped: main session busy or has pending input')
    return false
  }
  try {
    execFileSync(TMUX, ['send-keys', '-t', MAIN_CHANNELS_SESSION, 'Escape'], { timeout: 3000 })
    execFileSync('/bin/sleep', ['0.2'], { timeout: 1000 })
    execFileSync(TMUX, ['send-keys', '-t', MAIN_CHANNELS_SESSION, '/mcp', 'Enter'], { timeout: 3000 })
    execFileSync('/bin/sleep', ['0.3'], { timeout: 1000 })
    execFileSync(TMUX, ['send-keys', '-t', MAIN_CHANNELS_SESSION, 'Enter'], { timeout: 3000 })
    logger.info('Marveen soft reconnect: sent /mcp + Enter')
    return true
  } catch (err) {
    logger.warn({ err }, 'Marveen soft reconnect failed')
    return false
  }
}

function triggerMarveenMemorySave(): void {
  // Nudge Marveen to persist whatever hot/warm state is still in context
  // before the hard restart pulls the session. Uses sendPromptToSession
  // so the long prompt isn't buffered as a [Pasted text] and actually
  // reaches the agent as an input turn.
  const prompt = [
    '[SYSTEM: channels recovery] A Telegram plugin nem reagál, kb 60 másodperc',
    `múlva hard restart lesz a ${MAIN_CHANNELS_SESSION} session-ön (a beszélgetés elvész).`,
    'MOST mentsd el a ClaudeClaw memóriába amit a következő sessionnek tudnia kell:',
    'aktív feladatok (category hot), friss döntések/preferenciák (warm), tanulságok (cold).',
    'Használd: curl -s -X POST http://localhost:3420/api/memories ... (lásd CLAUDE.md).',
    'Ha kész vagy, írj egy rövid napi napló bejegyzést is a /api/daily-log-ra. Utána elég.',
  ].join(' ')
  try {
    sendPromptToSession(MAIN_CHANNELS_SESSION, prompt)
    logger.info(`${BOT_NAME} memory-save prompt dispatched before hard restart`)
  } catch (err) {
    logger.warn({ err }, `Failed to dispatch ${BOT_NAME} memory-save prompt`)
  }
}

let marveenLastHardRestart = 0
const MARVEEN_HARD_RESTART_GRACE_MS = 120_000

export function hardRestartMarveenChannels(): { ok: boolean; error?: string } {
  // Platform-specific restart. macOS uses launchctl + the LaunchAgent plist
  // installed by install.sh; Linux uses a direct tmux respawn (mirrors the
  // logic of scripts/channels.sh so behaviour matches a fresh boot).
  if (process.platform === 'darwin') {
    try {
      execFileSync('/bin/launchctl', ['unload', MAIN_CHANNELS_PLIST], { timeout: 5000 })
      execFileSync('/bin/sleep', ['2'], { timeout: 4000 })
      execFileSync('/bin/launchctl', ['load', MAIN_CHANNELS_PLIST], { timeout: 5000 })
      marveenLastHardRestart = Date.now()
      logger.warn(`Hard restart: launchctl reload of com.${MAIN_AGENT_ID}.channels`)
      return { ok: true }
    } catch (err) {
      logger.error({ err }, 'Hard restart failed (darwin/launchctl)')
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
  // Linux: kill the tmux session AND any orphaned Marveen channels claude
  // processes that survived a previous SIGHUP. The bun (telegram plugin)
  // child of the orphan keeps polling the same bot token, so a fresh
  // claude's bun would lose to it on 409 Conflict and never come up. We
  // identify Marveen orphans by their argv: --channels with NO --model
  // (sub-agents always carry --model X). Then respawn the session.
  try {
    try { execFileSync(TMUX, ['kill-session', '-t', MAIN_CHANNELS_SESSION], { timeout: 5000 }) } catch { /* may not exist */ }
    execFileSync('/bin/sleep', ['1'], { timeout: 3000 })
    // Walk ps for `claude --dangerously-skip-permissions --channels plugin:telegram@...`
    // WITHOUT a --model flag (those are Marveen's signature; sub-agents have --model).
    try {
      const ps = execFileSync('/bin/ps', ['-eo', 'pid,args'], { timeout: 3000, encoding: 'utf-8' })
      for (const line of ps.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(.*)$/)
        if (!m) continue
        const args = m[2]
        if (!args.includes('--channels plugin:telegram')) continue
        if (!args.includes('--dangerously-skip-permissions')) continue
        if (args.includes('--model ')) continue  // sub-agent, leave alone
        const pid = parseInt(m[1], 10)
        if (pid === process.pid) continue
        try { process.kill(pid, 'SIGTERM') } catch { /* gone */ }
        logger.warn({ pid }, 'Killed orphaned Marveen channels claude before respawn')
      }
    } catch { /* ps unavailable */ }
    // Kill orphaned bun server.ts processes (reparented to init, ppid=1) from
    // the previous session. These hold the bot token open, causing 409 Conflict
    // in the new session's polling loop which silently exits without process.exit().
    try {
      const botPidPath = join(homedir(), '.claude', 'channels', 'telegram', 'bot.pid')
      const currentBotPid = existsSync(botPidPath)
        ? parseInt(readFileSync(botPidPath, 'utf-8').trim(), 10) : 0
      const ps2 = execFileSync('/bin/ps', ['-axo', 'pid,ppid,command'], { timeout: 3000, encoding: 'utf-8' })
      for (const line of ps2.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)
        if (!m) continue
        const pid = parseInt(m[1], 10)
        const ppid = parseInt(m[2], 10)
        const cmd = m[3]
        if (!/\bbun\b/.test(cmd) || !cmd.includes('server.ts')) continue
        if (pid === currentBotPid) continue  // active bot, leave alone
        if (ppid !== 1) continue             // not an orphan
        try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
        logger.warn({ pid }, 'Killed orphaned bun server.ts before Marveen respawn')
      }
    } catch { /* ps unavailable */ }
    execFileSync('/bin/sleep', ['2'], { timeout: 4000 })
    const home = process.env.HOME || '/root'
    const sandboxEnv = process.env.IS_SANDBOX ? `IS_SANDBOX=${process.env.IS_SANDBOX} ` : 'IS_SANDBOX=1 '
    const cmd = `${sandboxEnv}PATH=${home}/.bun/bin:${home}/.local/bin:/usr/local/bin:/usr/bin:/bin ${CLAUDE} --dangerously-skip-permissions --channels plugin:telegram@claude-plugins-official`
    execFileSync(TMUX, ['new-session', '-d', '-s', MAIN_CHANNELS_SESSION, '-c', PROJECT_ROOT, cmd], { timeout: 10000 })
    marveenLastHardRestart = Date.now()
    logger.warn(`Hard restart: tmux respawn of ${MAIN_CHANNELS_SESSION}`)
    return { ok: true }
  } catch (err) {
    logger.error({ err }, 'Hard restart failed (linux/tmux)')
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function handleMarveenDown(): void {
  const now = Date.now()
  if (marveenLastHardRestart && now - marveenLastHardRestart < MARVEEN_HARD_RESTART_GRACE_MS) {
    // Just hard-restarted; give the plugin time to boot before checking again.
    return
  }
  if (!marveenDownState) {
    // First tick of this outage: log, alert, try the soft fix.
    marveenDownState = { downSince: now, stage: 'soft', lastAlertAt: now, softAttempts: 0 }
    logger.warn('Marveen Telegram plugin down -- stage 1 (soft /mcp reconnect)')
    sendMarveenAlert('⚠️ Marveen Telegram plugin lecsatlakozott. Próbálok /mcp-vel reconnectálni...').catch(() => {})
    softReconnectMarveen()
    marveenDownState.softAttempts += 1
    return
  }
  if (marveenDownState.stage === 'soft') {
    // Retry soft reconnect up to 3 times total (counting both sent and
    // skipped-because-busy attempts). Previously softAttempts only incremented
    // when softReconnectMarveen() returned true, so a single "session busy"
    // result caused immediate escalation to 'save' -- triggering unnecessary
    // memory-save prompts and hard restarts while Marveen was mid-turn.
    if (marveenDownState.softAttempts < 3) {
      softReconnectMarveen()
      marveenDownState.softAttempts += 1
      marveenDownState.lastAlertAt = now
      return
    }
    // Soft didn't help; ask Marveen to persist memory before we pull the plug.
    marveenDownState.stage = 'save'
    marveenDownState.stageStartedAt = now
    marveenDownState.lastAlertAt = now
    logger.warn('Marveen Telegram plugin still down -- stage 2 (memory save)')
    sendMarveenAlert('⚠️ /mcp nem segített. Szólok Marveennek hogy mentsen memóriát hard restart előtt (~60s türelmi idő).').catch(() => {})
    triggerMarveenMemorySave()
    return
  }
  if (marveenDownState.stage === 'save') {
    // Give the memory-save prompt a real ~60s window to land a turn before
    // we hard-restart. Without this check, the next monitor tick (also 60s
    // cadence, so effectively immediate) jumps straight to 'hard' and the
    // save prompt either hasn't started or is mid-turn when we pull the plug.
    const saveStartedAt = marveenDownState.stageStartedAt ?? marveenDownState.downSince
    if (now - saveStartedAt < SAVE_WINDOW_MS) return
    marveenDownState.stage = 'hard'
    marveenDownState.stageStartedAt = now
    marveenDownState.lastAlertAt = now
    logger.warn('Marveen Telegram plugin still down -- stage 3 (hard restart)')
    sendMarveenAlert(`⚠️ Memória mentés türelmi idő lejárt. Hard restart most a ${MAIN_CHANNELS_SESSION} session-ön (új session a SQLite memóriával indul).`).catch(() => {})
    hardRestartMarveenChannels()
    return
  }
  if (marveenDownState.stage === 'hard') {
    // Hard didn't help either; give up, keep alerting.
    marveenDownState.stage = 'gave_up'
    marveenDownState.lastAlertAt = now
    logger.error('Marveen Telegram plugin still down after hard restart -- giving up auto-recovery')
    sendMarveenAlert(`🚨 Hard restart SEM segített. Kézzel kell megnézni: \`tmux attach -t ${MAIN_CHANNELS_SESSION}\` és \`launchctl list | grep ${MAIN_AGENT_ID}\`.`).catch(() => {})
    return
  }
  // gave_up -- re-alert at most every PLUGIN_ALERT_DEDUP_MS.
  if (now - marveenDownState.lastAlertAt > PLUGIN_ALERT_DEDUP_MS) {
    marveenDownState.lastAlertAt = now
    sendMarveenAlert('🚨 Marveen Telegram plugin még mindig halott. Nézd meg kézzel.').catch(() => {})
  }
}

function handleMarveenUp(): void {
  if (marveenDownState) {
    const downedFor = Math.round((Date.now() - marveenDownState.downSince) / 1000)
    const stage = marveenDownState.stage
    logger.info({ stage, downedFor }, 'Marveen Telegram plugin recovered')
    if (stage !== 'soft' && stage !== 'save') {
      // Only alert on recovery if we actually pulled the session -- the soft
      // and save stages don't destroy state, so a "recovered" message there
      // would just be noise.
      sendMarveenAlert(`✅ Marveen Telegram plugin helyreállt (${stage} után, ${downedFor}s kiesés).`).catch(() => {})
    }
    marveenDownState = null
  }
}

// Down-detection debounce. A single tick where `ps -axo` times out under
// load, or where tmux briefly fails to list a pane, used to be enough to
// flip a healthy session into the recovery flow and trigger a needless
// hard restart (which costs Marveen its in-context state). Require N
// consecutive failing ticks before escalating.
const DOWN_TICKS_REQUIRED = 2
const downTickCount: Map<string, number> = new Map()

// Boot grace window. When the dashboard itself restarts (npm run build +
// kill+respawn, or update.sh-driven self-restart), the 60s probe tick is
// missed — and the streak counter restarts on the new dashboard. If the
// underlying claude session was already mid-recovery when we went down,
// the new dashboard sees N consecutive failing ticks and immediately
// escalates, even though some of those failures are dashboard-side
// observation gaps, not plugin-side outages. During this window we only
// WARN; escalation only kicks in once Marveen has had a chance to settle.
const BOOT_GRACE_WINDOW_MS = 90_000
const monitorBootTime = Date.now()

export function startTelegramPluginMonitor(): NodeJS.Timeout {
  let checkInProgress = false
  async function check() {
    if (checkInProgress) return
    checkInProgress = true
    try {
      await checkInner()
    } finally {
      checkInProgress = false
    }
  }
  async function checkInner() {
    const inBootGrace = Date.now() - monitorBootTime < BOOT_GRACE_WINDOW_MS
    type Target = { session: string; isMarveen: boolean; agentName?: string }
    const targets: Target[] = [{ session: MAIN_CHANNELS_SESSION, isMarveen: true }]
    for (const a of listAgentNames()) {
      if (isAgentRunning(a)) targets.push({ session: agentSessionName(a), isMarveen: false, agentName: a })
    }
    for (const t of targets) {
      const claudePid = getClaudePidForSession(t.session)
      const noClaude = !claudePid
      const processAlive = !noClaude && hasTelegramPluginAlive(claudePid!, t.agentName)
      let tickIsDown = noClaude || !processAlive

      // Fix B: if process looks alive, verify it's actually polling the Telegram
      // API. A 409 Conflict means an active poller holds the token; any other
      // response (200/OK or network error) means the grammy loop silently exited
      // (return instead of process.exit(1)) -- the "silent death" pattern.
      if (!tickIsDown && !noClaude) {
        const pidDir = t.agentName
          ? join(agentDir(t.agentName), '.claude', 'channels', 'telegram')
          : join(homedir(), '.claude', 'channels', 'telegram')
        const token = readBotToken(pidDir)
        if (token) {
          const polling = await isBotPolling(token)
          if (!polling) {
            logger.warn({ session: t.session, agentName: t.agentName },
              'Telegram plugin process alive but not polling (silent death detected)')
            tickIsDown = true
          }
        }
      }

      if (!tickIsDown) {
        // Healthy tick. Clear any pending failure streak and run the
        // recovered-path side effects.
        downTickCount.delete(t.session)
        if (t.isMarveen) {
          handleMarveenUp()
        } else if (agentDownSince.has(t.session)) {
          logger.info({ session: t.session }, 'Agent Telegram plugin recovered')
          agentDownSince.delete(t.session)
        }
        continue
      }

      // Grace period: we may have just restarted this agent and the claude
      // process or its MCP child hasn't connected yet. Don't escalate until
      // boot has had a realistic chance to complete.
      if (!t.isMarveen && t.agentName) {
        const lastRestart = agentLastRestart.get(t.agentName)
        if (lastRestart && Date.now() - lastRestart < AGENT_RESTART_GRACE_MS) continue
      }

      // Debounce: require DOWN_TICKS_REQUIRED consecutive failing ticks
      // before triggering the recovery flow. Earlier ticks just count.
      // The debounce gate only protects the *initial* escalation -- once a
      // marveenDownState exists, the recovery state machine needs every
      // failing tick fed to it so it can advance soft -> save -> hard. If
      // we kept gating ticks behind the debounce after the state machine
      // was already engaged, every other tick would be lost to "streak=1"
      // and stages would only advance every other tick (5+ ticks to reach
      // hard restart). For non-Marveen agents we still apply the debounce
      // unconditionally because they restart via stop/start, no state machine.
      const streak = (downTickCount.get(t.session) ?? 0) + 1
      downTickCount.set(t.session, streak)
      const stateMachineActive = t.isMarveen && marveenDownState !== null
      if (streak < DOWN_TICKS_REQUIRED && !stateMachineActive) {
        logger.warn(
          { session: t.session, streak, claudeMissing: noClaude },
          'Telegram plugin down tick (debouncing — not yet escalating)',
        )
        continue
      }

      // Boot grace window: the streak just hit its escalation threshold,
      // but the dashboard has been running for less than the grace period.
      // Don't escalate yet — observation could be coloured by tick gaps
      // around the dashboard's own restart. Keep the streak frozen at the
      // threshold so when grace expires AND the next tick is still down,
      // we escalate immediately rather than waiting for another full
      // round of debounce.
      if (inBootGrace) {
        downTickCount.set(t.session, DOWN_TICKS_REQUIRED)
        logger.warn(
          { session: t.session, streak, msSinceBoot: Date.now() - monitorBootTime },
          'Telegram plugin down tick (in dashboard boot grace window — deferring escalation)',
        )
        continue
      }

      // Streak met and grace expired: escalate.
      downTickCount.delete(t.session)
      if (t.isMarveen) {
        handleMarveenDown()
      } else {
        if (!agentDownSince.has(t.session)) agentDownSince.set(t.session, Date.now())
        logger.warn({ agent: t.agentName }, 'Agent Telegram plugin down -- auto-restarting')
        try {
          stopAgentProcess(t.agentName!)
          execSync('sleep 2', { timeout: 4000 })
          startAgentProcess(t.agentName!)
          agentLastRestart.set(t.agentName!, Date.now())
          agentDownSince.delete(t.session)
        } catch (err) {
          logger.error({ err, agent: t.agentName }, 'Failed to auto-restart agent after telegram plugin down')
        }
      }
    }
  }
  setTimeout(check, 30000)
  return setInterval(check, 60000)
}
