import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { PROJECT_ROOT } from './config.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const TYPING_REFRESH_MS = 4000
import { logger } from './logger.js'

const AGENT_TIMEOUT_MS = Number(process.env.MARVEEN_AGENT_TIMEOUT_MS) || 20 * 60 * 1000

// The SDK auto-detects which @anthropic-ai/claude-agent-sdk-<platform> variant
// to use, but on glibc Linux it sometimes picks the musl variant whose binary
// is incompatible. Resolve the right one ourselves: prefer the gnu variant in
// node_modules, then the user-installed CLI on PATH (~/.local/bin/claude).
function resolveClaudeBinary(): string | undefined {
  const fromEnv = process.env.CLAUDE_CODE_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const candidates = [
    join(PROJECT_ROOT, 'node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude'),
    join(process.env.HOME || '/root', '.local/bin/claude'),
    '/usr/local/bin/claude',
  ]
  return candidates.find(existsSync)
}
const CLAUDE_BINARY = resolveClaudeBinary()

// When runAgent is called for pure text generation (CLAUDE.md / SOUL.md /
// skill-md / prompt expansion / memory categorization), the model must not
// Write the file itself -- otherwise it sometimes does, then returns a short
// "Kész, létrehoztam" status instead of the markdown content, silently
// corrupting the target file the caller goes on to write.
const DEFAULT_DISALLOWED_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Task']

// The bundled SDK's runtime libc detection picks the linux-x64-musl variant
// even on glibc Ubuntu/Debian/RHEL hosts, so its native binary fails to
// spawn ("ld-musl-* not found"). We pick the right subpackage ourselves and
// forward its absolute path through pathToClaudeCodeExecutable.
function detectLinuxLibc(): 'glibc' | 'musl' | 'unknown' {
  if (process.platform !== 'linux') return 'unknown'
  try {
    const out = execSync('ldd --version 2>&1', { encoding: 'utf-8' })
    return /musl/i.test(out) ? 'musl' : 'glibc'
  } catch {
    return 'unknown'
  }
}

let cachedClaudeCodeBin: string | undefined | null = null
function resolveClaudeCodeBin(): string | undefined {
  if (cachedClaudeCodeBin !== null) return cachedClaudeCodeBin
  if (process.env.CLAUDE_CODE_BIN) {
    cachedClaudeCodeBin = process.env.CLAUDE_CODE_BIN
    return cachedClaudeCodeBin
  }
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    cachedClaudeCodeBin = undefined
    return undefined
  }
  const libc = detectLinuxLibc()
  if (libc === 'unknown') {
    cachedClaudeCodeBin = undefined
    return undefined
  }
  const variant = libc === 'musl' ? 'linux-x64-musl' : 'linux-x64'
  const bin = join(
    PROJECT_ROOT, 'node_modules', '@anthropic-ai',
    `claude-agent-sdk-${variant}`, 'claude',
  )
  cachedClaudeCodeBin = existsSync(bin) ? bin : undefined
  return cachedClaudeCodeBin
}

export async function runAgent(
  message: string,
  sessionId?: string,
  onTyping?: () => void,
  allowTools = false
): Promise<{ text: string | null; newSessionId?: string }> {
  let newSessionId: string | undefined
  let resultText: string | null = null

  const typingInterval = onTyping ? setInterval(onTyping, TYPING_REFRESH_MS) : undefined
  const abortController = new AbortController()
  const timeout = setTimeout(() => {
    logger.warn({ timeoutMs: AGENT_TIMEOUT_MS }, 'Agent timeout, megszakitas...')
    abortController.abort()
  }, AGENT_TIMEOUT_MS)

  const claudeCodeBin = resolveClaudeCodeBin()

  try {
    const events = query({
      prompt: message,
      options: {
        abortController,
        cwd: PROJECT_ROOT,
        permissionMode: 'bypassPermissions',
        ...(claudeCodeBin ? { pathToClaudeCodeExecutable: claudeCodeBin } : {}),
        ...(allowTools ? {} : { disallowedTools: DEFAULT_DISALLOWED_TOOLS }),
        ...(sessionId ? { resume: sessionId } : {}),
      },
    })

    for await (const event of events) {
      if (event.type === 'system' && 'subtype' in event && (event as any).subtype === 'init') {
        newSessionId = (event as any).sessionId as string
      }
      if (event.type === 'result') {
        resultText = (event as any).result as string ?? null
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || abortController.signal.aborted) {
      logger.warn('Agent megszakitva timeout miatt')
      const mins = Math.round(AGENT_TIMEOUT_MS / 60000)
      resultText = `A feldolgozas tullepte a ${mins} perces idokorlatot. Probald rovidebben megfogalmazni, vagy bontsd tobb lepesre.`
    } else {
      logger.error({ err }, 'Agent hiba')
      throw err instanceof Error ? err : new Error(String(err))
    }
  } finally {
    clearTimeout(timeout)
    if (typingInterval) clearInterval(typingInterval)
  }

  return { text: resultText, newSessionId }
}
