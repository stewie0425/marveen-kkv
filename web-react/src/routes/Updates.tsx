import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useApplyUpdate, useCheckUpdate, useUpdates, useUpstreamStatus, useSyncUpstreamRequest } from '@/hooks/useUpdates'
import { apiFetch } from '@/lib/api'
import { showToast } from '@/lib/toast'
import type { UpdateCommit } from '@/types/api'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

const COMPONENT_COLORS: Record<string, string> = {
  'Dashboard Backend': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Dashboard UI': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'API Routes': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Legacy UI': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  'Scripts': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Agent Configs': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Tests': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Core': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'Dependencies': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'MCP Config': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

function ComponentBadge({ label }: { label: string }) {
  const cls = COMPONENT_COLORS[label] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function SourceBadge({ source }: { source: 'KKV' | 'Upstream' }) {
  return (
    <span
      title={source === 'Upstream' ? 'Ez Szotasz/marveen upstream fejlesztés. KKV-ba Sandornak kell integrálni az overrides miatt.' : undefined}
      className={`inline-flex cursor-default items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        source === 'KKV'
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      }`}
    >
      {source}
    </span>
  )
}

type IntegrationCategory = 'safe' | 'review'

function getIntegrationCategory(components: string[] | undefined): IntegrationCategory {
  const safe = new Set(['Core', 'Scripts', 'Tests', 'Agent Configs'])
  const review = new Set(['API Routes', 'Dashboard Backend', 'Dependencies', 'MCP Config'])
  if (!components || components.length === 0) return 'review'
  if (components.some(c => review.has(c))) return 'review'
  if (components.some(c => safe.has(c))) return 'safe'
  return 'review'
}

function IntegrationBadge({ category }: { category: IntegrationCategory }) {
  return category === 'safe' ? (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      Integrálható
    </span>
  ) : (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
      Review szükséges
    </span>
  )
}

interface MergedCommit extends UpdateCommit {
  source: 'KKV' | 'Upstream'
}

function mergeCommits(
  kkv: UpdateCommit[] | undefined,
  upstream: UpdateCommit[] | undefined,
): MergedCommit[] {
  const result: MergedCommit[] = [
    ...(kkv ?? []).map(c => ({ ...c, source: 'KKV' as const })),
    ...(upstream ?? [])
      .filter(c => !c.components?.includes('Dashboard UI'))
      .map(c => ({ ...c, source: 'Upstream' as const })),
  ]
  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return result
}

const APPLY_TIMEOUT_MS = 120_000

export default function UpdatesPage() {
  const updates = useUpdates()
  const checkMut = useCheckUpdate()
  const applyMut = useApplyUpdate()
  const upstream = useUpstreamStatus()
  const syncMut = useSyncUpstreamRequest()

  const [applyStarted, setApplyStarted] = useState(false)
  const [applyElapsed, setApplyElapsed] = useState(0)
  const [applyError, setApplyError] = useState<string | null>(null)
  const originalShaRef = useRef<string | null>(null)

  // Poll for version change after apply
  useEffect(() => {
    if (!applyStarted) return
    const startedAt = Date.now()

    const ticker = setInterval(() => {
      setApplyElapsed(Math.round((Date.now() - startedAt) / 1000))
    }, 1000)

    const poller = setInterval(async () => {
      if (Date.now() - startedAt > APPLY_TIMEOUT_MS) {
        clearInterval(poller)
        clearInterval(ticker)
        setApplyStarted(false)
        setApplyError('Timeout: a frissítés 120 másodpercen belül nem fejeződött be.')
        return
      }
      try {
        const res = await apiFetch('/api/updates')
        if (!res.ok) return
        const data = await res.json()
        if (data.current && originalShaRef.current && data.current !== originalShaRef.current) {
          clearInterval(poller)
          clearInterval(ticker)
          window.location.reload()
        }
      } catch {
        // ignore transient fetch errors while server is restarting
      }
    }, 3000)

    return () => {
      clearInterval(ticker)
      clearInterval(poller)
    }
  }, [applyStarted])

  const onCheck = async () => {
    try {
      await checkMut.mutateAsync()
      showToast('Frissítés-ellenôrzés kész', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onApply = async () => {
    if (!confirm('Tényleg alkalmazod a frissítést? A dashboard újraindul, ~30 mp-ig elérhetetlen lesz.')) return
    originalShaRef.current = updates.data?.current ?? null
    setApplyError(null)
    setApplyElapsed(0)
    try {
      await applyMut.mutateAsync()
      setApplyStarted(true)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onSyncRequest = async (commits: string[]) => {
    try {
      await syncMut.mutateAsync({ commits })
      showToast('Integráció kérés elküldve Marveennek', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const isLoading = updates.isLoading || upstream.isLoading
  const status = updates.data
  const upstreamData = upstream.data

  const merged = mergeCommits(status?.commits, upstreamData?.commits)
  const hasUpstreamCommits = merged.some(c => c.source === 'Upstream')

  const cur = (status?.current || '').slice(0, 7) || '—'
  const lat = (status?.latest || '').slice(0, 7) || '—'
  const isError = !!status?.error
  const hasNewer = !!(status?.latest && status?.current && status.latest !== status.current)
  const upToDate = !isError && !hasNewer && status?.behind === 0
  const showApply = !upToDate && (status?.behind ?? 0) > 0
  const kkvBehind = status?.behind ?? 0
  const upstreamBehind = upstreamData?.behind ?? 0
  const totallyEmpty = upToDate && merged.length === 0

  const checkButton = (
    <Button
      onClick={onCheck}
      disabled={checkMut.isPending}
      leftIcon={
        <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      }
    >
      Ellenôrzés
    </Button>
  )

  return (
    <section>
      <PageHeader
        title="Frissítések"
        subtitle="Új commitok és kódváltozások."
        actions={checkButton}
      />

      {isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : updates.isError || !status ? (
        <EmptyState tone="error">
          {updates.error instanceof Error ? updates.error.message : 'Nem sikerült lekérni a frissítés-státuszt.'}
        </EmptyState>
      ) : totallyEmpty ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-success)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]">
          <strong>Minden naprakész.</strong>{' '}
          <span className="opacity-70">(<code className="font-mono">{cur}</code>)</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* KKV status / apply banner */}
          <div className={[
            'rounded-[var(--radius)] border px-4 py-3 text-sm',
            isError && !showApply
              ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
              : upToDate
                ? 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]'
                : 'border-[#b07c19]/40 bg-[rgba(217,165,32,0.12)] text-[#b07c19] dark:text-[#e6c275]',
          ].join(' ')}>
            {isError && !showApply ? (
              <>
                <strong>Nem sikerült ellenôrizni:</strong> {status.error}
                <br />
                Jelenlegi: <code className="font-mono">{cur}</code>
              </>
            ) : upToDate ? (
              <>
                <strong>KKV naprakész</strong>{' '}
                (<code className="font-mono">{cur}</code>)
                {upstreamBehind > 0 && (
                  <span className="ml-2 opacity-70">— upstream commitok integrálásra várnak</span>
                )}
              </>
            ) : applyStarted ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" {...stroke}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <strong>Frissítés folyamatban…</strong>
                  <span className="opacity-70">{applyElapsed}s</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-current/20">
                  <div
                    className="h-full rounded-full bg-current/60 transition-all duration-1000"
                    style={{ width: `${Math.min((applyElapsed / 120) * 100, 95)}%` }}
                  />
                </div>
                <span className="text-xs opacity-60">Verzióváltozásra várok, a dashboard újratölt ha kész…</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{kkvBehind} új KKV commit elérhetô</strong>
                  {status.remote && (
                    <> a <code className="font-mono">{status.remote}</code> repón.</>
                  )}
                  <br />
                  Jelenlegi: <code className="font-mono">{cur}</code> →{' '}
                  Legfrissebb: <code className="font-mono">{lat}</code>
                </div>
                <Button variant="primary" onClick={onApply} disabled={applyMut.isPending}>
                  {applyMut.isPending ? 'Folyamatban…' : 'Frissítés letöltése és alkalmazása'}
                </Button>
              </div>
            )}
          </div>

          {/* Apply timeout error */}
          {applyError && (
            <div className="rounded-[var(--radius)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {applyError}
            </div>
          )}

          {/* Upstream summary banner */}
          {upstreamBehind > 0 && !applyStarted && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm">
              <span className="text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text)]">{upstreamBehind} upstream commit</strong>
                {upstreamData?.remote && (
                  <> a <code className="font-mono text-xs">{upstreamData.remote}</code>-n</>
                )}
                {upstreamData?.last_synced && (
                  <span className="ml-2 text-xs">· utolsó szinkron: {new Date(upstreamData.last_synced).toLocaleString('hu-HU')}</span>
                )}
              </span>
              <Button
                onClick={() => onSyncRequest(merged.filter(c => c.source === 'Upstream').map(c => c.sha))}
                disabled={syncMut.isPending}
                leftIcon={
                  <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                }
              >
                {syncMut.isPending ? 'Küldés…' : 'Upstream sync kérése'}
              </Button>
            </div>
          )}

          {/* Component summary for KKV */}
          {status.components && status.components.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm">
              <span className="text-[var(--color-text-secondary)] text-xs font-medium">Érintett KKV komponensek:</span>
              {status.components.map(c => <ComponentBadge key={c} label={c} />)}
            </div>
          )}

          {/* Merged commit list */}
          {merged.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              <header className="border-b border-[var(--color-border)] px-4 py-3">
                <h3 className="text-sm font-semibold tracking-tight">Commitok</h3>
                {hasUpstreamCommits && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Upstream commitok — integrálás szükséges a közvetlen alkalmazás előtt
                  </p>
                )}
              </header>
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {merged.map((c) => (
                  <li
                    key={`${c.source}-${c.sha}`}
                    className="flex flex-col gap-1 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <SourceBadge source={c.source} />
                      {c.source === 'Upstream' && (
                        <IntegrationBadge category={getIntegrationCategory(c.components)} />
                      )}
                      <code className="rounded bg-[var(--color-input)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {c.short}
                      </code>
                      <span className="flex-1 text-[var(--color-text)]">
                        {c.message.split('\n')[0]}
                      </span>
                      {c.source === 'Upstream' && (() => {
                        const cat = getIntegrationCategory(c.components)
                        const label = cat === 'safe' ? 'Integráció kérése' : 'Review + integráció kérése'
                        return (
                          <button
                            onClick={() => onSyncRequest([c.sha])}
                            disabled={syncMut.isPending}
                            className="shrink-0 rounded border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
                          >
                            {syncMut.isPending ? 'Küldés…' : label}
                          </button>
                        )
                      })()}
                    </div>
                    {c.components && c.components.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.components.map(comp => (
                          <ComponentBadge key={comp} label={comp} />
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      {c.author} · {new Date(c.date).toLocaleString('hu-HU')}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
