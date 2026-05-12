import { execFileSync } from 'node:child_process'
import { PROJECT_ROOT } from '../config.js'

export interface UpdateCommit {
  sha: string
  short: string
  message: string
  author: string
  date: string
  files?: string[]
  components?: string[]
}

export interface UpdateStatus {
  current: string
  latest: string
  behind: number
  commits: UpdateCommit[]
  components?: string[]
  remote: string
  lastChecked: number
  error?: string
}

const COMPONENT_RULES: [RegExp, string][] = [
  [/^src\/web\/routes\//, 'API Routes'],
  [/^src\/web\//, 'Dashboard Backend'],
  [/^web-react\//, 'Dashboard UI'],
  [/^web-legacy\//, 'Legacy UI'],
  [/^scripts\//, 'Scripts'],
  [/^agents\//, 'Agent Configs'],
  [/^src\/__tests__\//, 'Tests'],
  [/^src\//, 'Core'],
  [/^package(-lock)?\.json$/, 'Dependencies'],
  [/^\.mcp\.json$/, 'MCP Config'],
]

function deriveComponents(files: string[]): string[] {
  const seen = new Set<string>()
  for (const f of files) {
    for (const [re, label] of COMPONENT_RULES) {
      if (re.test(f)) { seen.add(label); break }
    }
  }
  return [...seen]
}

function parseGitLogWithFiles(raw: string): UpdateCommit[] {
  const commits: UpdateCommit[] = []
  const entries = raw.split(/^COMMIT /m).filter(Boolean)
  for (const entry of entries) {
    const lines = entry.split('\n')
    const header = lines[0] || ''
    const pipeIdx = header.indexOf('|')
    if (pipeIdx === -1) continue
    const sha = header.slice(0, pipeIdx).trim()
    const rest = header.slice(pipeIdx + 1)
    const parts = rest.split('|')
    if (parts.length < 3) continue
    const [msg, author, date] = parts
    const files = lines.slice(1).map(l => l.trim()).filter(Boolean)
    commits.push({
      sha,
      short: sha.slice(0, 7),
      message: (msg || '').split('\n')[0],
      author: author || '',
      date: date || '',
      files,
      components: deriveComponents(files),
    })
  }
  return commits
}

let updateStatusCache: UpdateStatus = {
  current: '',
  latest: '',
  behind: 0,
  commits: [],
  remote: 'Szotasz/marveen',
  lastChecked: 0,
}

export function getUpdateStatus(): UpdateStatus {
  return updateStatusCache
}

export function currentGitHead(): string {
  try {
    return execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

export function parseGitHubRemote(): string {
  try {
    const url = execFileSync('/usr/bin/git', ['config', '--get', 'remote.origin.url'], { cwd: PROJECT_ROOT, timeout: 3000, encoding: 'utf-8' }).trim()
    // Normalize "git@github.com:Owner/Repo.git" or "https://github.com/Owner/Repo.git" to "Owner/Repo"
    const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)
    if (m) return m[1]
  } catch { /* fall through */ }
  return 'Szotasz/marveen'
}

export async function refreshUpdateStatus(): Promise<UpdateStatus> {
  const current = currentGitHead()
  const remote = parseGitHubRemote()
  const status: UpdateStatus = {
    current,
    latest: '',
    behind: 0,
    commits: [],
    remote,
    lastChecked: Date.now(),
  }
  if (!current) {
    status.error = 'Not a git checkout'
    updateStatusCache = status
    return status
  }
  try {
    // 1) find HEAD of default branch (main) via the commits endpoint
    const latestRes = await fetch(`https://api.github.com/repos/${remote}/commits/main`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
    })
    if (!latestRes.ok) throw new Error(`GitHub /commits/main -> ${latestRes.status}`)
    const latestJson = await latestRes.json() as { sha?: string }
    if (!latestJson.sha) throw new Error('No sha on commits/main response')
    status.latest = latestJson.sha

    if (status.latest === current) {
      updateStatusCache = status
      return status
    }

    // 2) list commits between current and latest via the compare endpoint
    const cmpRes = await fetch(`https://api.github.com/repos/${remote}/compare/${current}...${status.latest}`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
    })
    if (cmpRes.ok) {
      const cmp = await cmpRes.json() as {
        ahead_by?: number
        commits?: { sha: string; commit: { message: string; author: { name: string; date: string } } }[]
        files?: { filename: string }[]
      }
      status.behind = cmp.ahead_by ?? 0
      // GitHub returns commits oldest-first; flip to newest-first for the UI.
      const raw = (cmp.commits ?? []).slice().reverse()
      status.commits = raw.map(c => ({
        sha: c.sha,
        short: c.sha.slice(0, 7),
        message: (c.commit.message || '').split('\n')[0],
        author: c.commit.author?.name || '',
        date: c.commit.author?.date || '',
      }))
      if (cmp.files && cmp.files.length > 0) {
        const filenames = cmp.files.map(f => f.filename)
        status.components = deriveComponents(filenames)
      }
    } else if (cmpRes.status === 404) {
      // Local HEAD not on the remote; fall back to local git for commit list.
      try {
        execFileSync(
          '/usr/bin/git',
          ['fetch', 'origin', 'main', '--no-tags', '--quiet'],
          { cwd: PROJECT_ROOT, timeout: 30_000, encoding: 'utf-8' },
        )
        const rawLog = execFileSync(
          '/usr/bin/git',
          ['log', '--name-only', '--pretty=format:COMMIT %H|%s|%an|%aI', 'HEAD..origin/main'],
          { cwd: PROJECT_ROOT, timeout: 5_000, encoding: 'utf-8' },
        ).trim()
        const commits = parseGitLogWithFiles(rawLog)
        status.commits = commits
        status.behind = commits.length
        // Aggregate components across all pending commits
        const allFiles = commits.flatMap(c => c.files ?? [])
        if (allFiles.length > 0) status.components = deriveComponents(allFiles)
      } catch {
        status.error = 'Local HEAD not found on GitHub -- different fork or unpushed commits?'
      }
    }
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err)
  }
  updateStatusCache = status
  return status
}

// Polls the GitHub repo's main branch for new commits and compares to the
// local HEAD. Lets the dashboard show a "new version available" badge
// without anyone having to SSH in and run update.sh.
export function startUpdateChecker(): NodeJS.Timeout {
  // First check shortly after startup; then every 15 minutes.
  setTimeout(() => { refreshUpdateStatus().catch(() => {}) }, 10_000)
  return setInterval(() => { refreshUpdateStatus().catch(() => {}) }, 15 * 60_000)
}
