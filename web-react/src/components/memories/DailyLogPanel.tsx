import { useEffect, useState } from 'react'
import {
  useAddDailyLog,
  useDailyLogDates,
  useDailyLogEntries,
} from '@/hooks/useDailyLog'
import { Button } from '@/components/common/Button'
import { showToast } from '@/lib/toast'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

interface Props {
  agent: string | null
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatLogDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

export function DailyLogPanel({ agent }: Props) {
  const [date, setDate] = useState<string>(todayIso())
  const [composer, setComposer] = useState('')
  const dates = useDailyLogDates(agent)
  const entries = useDailyLogEntries(agent, date)
  const addMut = useAddDailyLog()

  // Reset to today whenever the agent filter changes so we don't surface
  // a date that has no entries for the new agent.
  useEffect(() => {
    setDate(todayIso())
  }, [agent])

  const submit = async () => {
    if (!agent) return
    const c = composer.trim()
    if (!c) return
    try {
      await addMut.mutateAsync({ agent_id: agent, content: c })
      setComposer('')
      showToast('Naplóbejegyzés mentve', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  if (!agent) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
        Válassz ágenst a felsô szûrôben.
      </div>
    )
  }

  const datesSet = new Set(dates.data ?? [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)]">
        <button
          type="button"
          onClick={() => setDate(shiftIso(date, -1))}
          aria-label="Elôzô nap"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 text-center text-sm font-medium">
          {formatLogDate(date)}
          {datesSet.has(date) ? null : (
            <span className="ml-2 text-[11px] italic text-[var(--color-text-muted)]">
              (üres nap)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDate(shiftIso(date, 1))}
          aria-label="Következô nap"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {entries.isLoading ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Betöltés…
        </div>
      ) : entries.data && entries.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {entries.data.map((e) => {
            const time = new Date(e.created_at * 1000).toLocaleTimeString('hu-HU', {
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <li
                key={e.id}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)]"
              >
                <div className="text-[11px] font-mono tabular-nums text-[var(--color-text-muted)]">
                  {time}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {e.content}
                </p>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Nincs naplóbejegyzés ezen a napon.
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          rows={3}
          placeholder="## HH:MM -- Téma\nMi történt, mi az eredmény"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={!composer.trim() || addMut.isPending}
          >
            {addMut.isPending ? 'Mentés…' : 'Bejegyzés hozzáadása'}
          </Button>
        </div>
      </div>
    </div>
  )
}
