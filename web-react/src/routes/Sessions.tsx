import { useSessions } from '@/hooks/useSessions'
import { SessionCard } from '@/components/sessions/SessionCard'

export default function SessionsPage() {
  const { data, isLoading, isError, error } = useSessions()
  const sessions = data?.sessions ?? []

  const runningCount = sessions.filter((s) => s.running).length
  const busyCount = sessions.filter((s) => s.paneState === 'busy').length

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Ágensek élő állapota és aktuális pane-jük. 3 mp-enként frissül.
          </p>
        </div>
        {sessions.length ? (
          <div className="text-sm tabular-nums text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text-secondary)]">
              {runningCount} / {sessions.length}
            </span>{' '}
            fut
            <span className="mx-2 text-[var(--color-border)]">·</span>
            <span className="font-medium text-[var(--color-text-secondary)]">
              {busyCount}
            </span>{' '}
            aktív
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : isError ? (
        <EmptyState tone="error">
          Hiba: {error instanceof Error ? error.message : String(error)}
        </EmptyState>
      ) : sessions.length === 0 ? (
        <EmptyState>Nincs ágens.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {sessions.map((s) => (
            <SessionCard key={s.name} session={s} />
          ))}
        </div>
      )}
    </section>
  )
}

interface EmptyStateProps {
  children: React.ReactNode
  tone?: 'default' | 'error'
}

function EmptyState({ children, tone = 'default' }: EmptyStateProps) {
  const toneClass =
    tone === 'error'
      ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
  return (
    <div
      className={`rounded-[var(--radius)] border p-10 text-center text-sm ${toneClass}`}
    >
      {children}
    </div>
  )
}
