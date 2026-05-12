import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useApplyUpdate, useCheckUpdate, useUpdates } from '@/hooks/useUpdates'
import { apiFetch } from '@/lib/api'
import { showToast } from '@/lib/toast'

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

const APPLY_TIMEOUT_MS = 120_000

export default function UpdatesPage() {
  const updates = useUpdates()
  const checkMut = useCheckUpdate()
  const applyMut = useApplyUpdate()

  const [applyStarted, setApplyStarted] = useState(false)
  const [applyElapsed, setApplyElapsed] = useState(0)
  const [applyError, setApplyError] = useState<string | null>(null)
  const originalShaRef = useRef<string | null>(null)

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
        // ignore transient errors while server is restarting
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

  const status = updates.data
  const cur = (status?.current || '').slice(0, 7) || '—'
  const lat = (status?.latest || '').slice(0, 7) || '—'
  const isError = !!status?.error
  const hasNewer = !!(status?.latest && status?.current && status.latest !== status.current)
  const upToDate = !isError && !hasNewer && status?.behind === 0
  const showApply = !upToDate && (status?.behind ?? 0) > 0

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

      {updates.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : updates.isError || !status ? (
        <EmptyState tone="error">
          {updates.error instanceof Error ? updates.error.message : 'Nem sikerült lekérni a frissítés-státuszt.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Status banner */}
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
                <strong>Naprakész</strong>{' '}
                (<code className="font-mono">{cur}</code>).
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
                  <strong>{status.behind} új commit elérhetô</strong>
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

          {/* Component summary */}
          {status.components && status.components.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm">
              <span className="text-[var(--color-text-secondary)] text-xs font-medium">Érintett komponensek:</span>
              {status.components.map(c => <ComponentBadge key={c} label={c} />)}
            </div>
          )}

          {/* Commit list */}
          {status.commits && status.commits.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              <header className="border-b border-[var(--color-border)] px-4 py-3">
                <h3 className="text-sm font-semibold tracking-tight">Új commitok</h3>
              </header>
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {status.commits.map((c) => (
                  <li key={c.sha} className="flex flex-col gap-1 px-4 py-2.5 text-sm">
                    <div className="flex items-baseline gap-2">
                      <code className="rounded bg-[var(--color-input)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {c.short}
                      </code>
                      <span className="flex-1 text-[var(--color-text)]">
                        {c.message.split('\n')[0]}
                      </span>
                    </div>
                    {c.components && c.components.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-12">
                        {c.components.map(comp => <ComponentBadge key={comp} label={comp} />)}
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
