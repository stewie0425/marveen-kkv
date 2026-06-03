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
      // Local HEAD not on GitHub. Two cases:
      // (a) Unpushed local commits -- try git log against origin/main.
      // (b) Fork with diverged history (origin is not GitHub) -- git log
      //     returns empty because HEAD == origin/main on the non-GitHub remote.
      //     In that case fall back to the upstream (Szotasz/marveen) commit list
      //     so the dashboard shows what is new upstream rather than a misleading
      //     "0 commits behind" status.
      try {
        execFileSync(
          '/usr/bin/git',
          ['fetch', 'origin', 'main', '--no-tags', '--quiet'],
          { cwd: PROJECT_ROOT, timeout: 5_000, encoding: 'utf-8' },
        )
        const rawLog = execFileSync(
          '/usr/bin/git',
          ['log', '--name-only', '--pretty=format:COMMIT %H|%s|%an|%aI', 'HEAD..origin/main'],
          { cwd: PROJECT_ROOT, timeout: 5_000, encoding: 'utf-8' },
        ).trim()
        const commits = parseGitLogWithFiles(rawLog)
        if (commits.length > 0) {
          status.commits = commits
          status.behind = commits.length
          // Aggregate components across all pending commits
          const allFiles = commits.flatMap(c => c.files ?? [])
          if (allFiles.length > 0) status.components = deriveComponents(allFiles)
        } else {
          // origin is in sync (fork case) -- use the upstream cache populated by
          // startUpdateChecker()'s parallel refreshUpstreamStatus() call. Never
          // call refreshUpstreamStatus() inline here: that would block every
          // /api/updates/check with a live GitHub round-trip on top of the
          // already-slow git fetch, causing page-load timeouts.
          const cached = getUpstreamStatus()
          if (cached.commits.length > 0) {
            status.commits = cached.commits
            status.behind = cached.commits.length
            status.remote = UPSTREAM_REPO
          }
          // Cache empty on first boot: behind stays 0 until the parallel
          // refreshUpstreamStatus() from startUpdateChecker() completes (~10s).
        }
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
  // On startup: populate upstream cache first so refreshUpdateStatus() can
  // read it from getUpstreamStatus() without a live GitHub call.
  setTimeout(() => {
    refreshUpstreamStatus()
      .catch(() => {})
      .finally(() => { refreshUpdateStatus().catch(() => {}) })
  }, 10_000)
  // Periodic refresh every 15 minutes -- upstream cache is warm, order doesn't matter.
  return setInterval(() => { refreshUpdateStatus().catch(() => {}); refreshUpstreamStatus().catch(() => {}) }, 15 * 60_000)
}

// ---------------------------------------------------------------------------
// Upstream tracking: Szotasz/marveen (the engine repo this product is based on)
// ---------------------------------------------------------------------------

export interface UpstreamStatus {
  upstream: string
  commits: UpdateCommit[]
  lastChecked: number
  error?: string
}

const UPSTREAM_REPO = 'Szotasz/marveen'

let upstreamStatusCache: UpstreamStatus = {
  upstream: UPSTREAM_REPO,
  commits: [],
  lastChecked: 0,
}

export function getUpstreamStatus(): UpstreamStatus {
  return upstreamStatusCache
}

export async function refreshUpstreamStatus(): Promise<UpstreamStatus> {
  const status: UpstreamStatus = {
    upstream: UPSTREAM_REPO,
    commits: [],
    lastChecked: Date.now(),
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${UPSTREAM_REPO}/commits?per_page=15&sha=main`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'marveen-update-check' },
    })
    if (!res.ok) throw new Error(`GitHub /commits -> ${res.status}`)
    const raw = await res.json() as { sha: string; commit: { message: string; author: { name: string; date: string } } }[]
    status.commits = raw.map(c => ({
      sha: c.sha,
      short: c.sha.slice(0, 7),
      message: (c.commit.message || '').split('\n')[0],
      author: c.commit.author?.name || '',
      date: c.commit.author?.date || '',
    }))
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err)
  }
  upstreamStatusCache = status
  return status
}
