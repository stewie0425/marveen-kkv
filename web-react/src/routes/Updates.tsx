import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useApplyUpdate, useCheckUpdate, useUpdates, useUpstreamStatus, useSyncUpstreamRequest } from '@/hooks/useUpdates'
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
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      source === 'KKV'
        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
    }`}>
      {source}
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

export default function UpdatesPage() {
  const updates = useUpdates()
  const checkMut = useCheckUpdate()
  const applyMut = useApplyUpdate()
  const upstream = useUpstreamStatus()
  const syncMut = useSyncUpstreamRequest()
  const [applyStarted, setApplyStarted] = useState(false)

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
    try {
      await applyMut.mutateAsync()
      setApplyStarted(true)
      showToast('Frissítés elindult, a dashboard újratöltôdik…', 'success')
      setTimeout(() => window.location.reload(), 30_000)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onSyncRequest = async () => {
    try {
      await syncMut.mutateAsync()
      showToast('Upstream sync kérés elküldve Marveennek', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const isLoading = updates.isLoading || upstream.isLoading
  const status = updates.data
  const upstreamData = upstream.data

  const merged = mergeCommits(status?.commits, upstreamData?.commits)

  const cur = (status?.current || '').slice(0, 7) || '—'
  const lat = (status?.latest || '').slice(0, 7) || '—'
  const isError = !!status?.error
  const hasNewer = !!(status?.latest && status?.current && status.latest !== status.current)
  const upToDate = !isError && !hasNewer && status?.behind === 0
  const showApply = !upToDate && (status?.behind ?? 0) > 0
  const kkvBehind = status?.behind ?? 0
  const upstreamBehind = upstreamData?.behind ?? 0

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
      ) : (
        <div className="flex flex-col gap-4">
          {/* KKV status banner */}
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
                <strong>A legfrissebb verzión vagy</strong>{' '}
                (<code className="font-mono">{cur}</code>). Nincs teendô.
              </>
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
                <Button variant="primary" onClick={onApply} disabled={applyMut.isPending || applyStarted}>
                  {applyMut.isPending || applyStarted ? 'Folyamatban…' : 'Frissítés letöltése és alkalmazása'}
                </Button>
              </div>
            )}
          </div>

          {/* Upstream banner (only if there's something to report) */}
          {upstreamBehind > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm">
              <span className="text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text)]">{upstreamBehind} upstream commit</strong>
                {upstreamData?.remote && (
                  <> a <code className="font-mono text-xs">{upstreamData.remote}</code>-n.</>
                )}
              </span>
              <Button
                onClick={onSyncRequest}
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
              <span className="text-[var(--color-text-secondary)] text-xs font-medium">Érintett komponensek:</span>
              {status.components.map(c => <ComponentBadge key={c} label={c} />)}
            </div>
          )}

          {/* Merged commit list */}
          {merged.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              <header className="border-b border-[var(--color-border)] px-4 py-3">
                <h3 className="text-sm font-semibold tracking-tight">Commitok</h3>
              </header>
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {merged.map((c) => (
                  <li
                    key={`${c.source}-${c.sha}`}
                    className="flex flex-col gap-1 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <SourceBadge source={c.source} />
                      <code className="rounded bg-[var(--color-input)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {c.short}
                      </code>
                      <span className="flex-1 text-[var(--color-text)]">
                        {c.message.split('\n')[0]}
                      </span>
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
