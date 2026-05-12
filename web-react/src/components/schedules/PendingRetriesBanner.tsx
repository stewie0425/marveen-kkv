import type { PendingRetry } from '@/types/api'
import { useCancelPendingRetry } from '@/hooks/useSchedules'
import { showToast } from '@/lib/toast'

function formatPendingAge(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'kevesebb mint 1 perce'
  if (mins < 60) return `${mins} perce`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem ? `${hours} ó ${rem} p-e` : `${hours} órája`
}

interface Props {
  retries: PendingRetry[]
}

export function PendingRetriesBanner({ retries }: Props) {
  const cancelMut = useCancelPendingRetry()
  if (!retries.length) return null

  const cancel = async (id: string) => {
    if (!confirm('Visszavonod ezt a várakozó feladatot?')) return
    try {
      await cancelMut.mutateAsync(id)
      showToast('Várakozó feladat visszavonva', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  return (
    <div className="mb-4 rounded-[var(--radius)] border border-[#b07c19]/40 bg-[rgba(217,165,32,0.12)] px-4 py-3 dark:border-[#e6c275]/40 dark:bg-[rgba(217,165,32,0.18)]">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#b07c19] dark:text-[#e6c275]">
          Függôben lévô ütemezett feladatok ({retries.length})
        </h3>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Busy cél-session, a rendszer tovább próbálkozik.
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {retries.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-3 py-2 text-sm shadow-[var(--shadow-sm)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-[var(--color-text)]">
                  {r.taskName}
                </span>
                <span className="rounded bg-[var(--color-input)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)]">
                  {r.agentName}
                </span>
                {r.alertSentAt ? (
                  <span className="rounded bg-[var(--color-danger-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-danger)]">
                    riasztás kiküldve
                  </span>
                ) : r.alertDue ? (
                  <span className="rounded bg-[var(--color-info-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-info)]">
                    riasztás esedékes
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                {formatPendingAge(r.ageMs)} vár · {r.attemptCount} próbálkozás
                {r.lastReason ? ` · ok: ${r.lastReason}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => cancel(r.id)}
              disabled={cancelMut.isPending}
              className="flex-shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] disabled:opacity-50"
            >
              Visszavonás
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
