import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useScheduleAgents } from '@/hooks/useSchedules'
import {
  useDeleteMemory,
  useMemories,
  useMemoryStats,
} from '@/hooks/useMemories'
import { MemoryStatsBar } from '@/components/memories/MemoryStatsBar'
import { MemoryItem } from '@/components/memories/MemoryItem'
import { MemoryEditorModal } from '@/components/memories/MemoryEditorModal'
import { DailyLogPanel } from '@/components/memories/DailyLogPanel'
import { showToast } from '@/lib/toast'
import type { Memory, MemoryTier } from '@/types/api'

type MemoryTab = MemoryTier | 'log'

const TABS: Array<{ key: MemoryTab; label: string }> = [
  { key: 'hot', label: '🔥 Hot' },
  { key: 'warm', label: '🫖 Warm' },
  { key: 'cold', label: '❄️ Cold' },
  { key: 'shared', label: '🔗 Shared' },
  { key: 'log', label: '📋 Napló' },
]

export default function MemoriesPage() {
  const [tab, setTab] = useState<MemoryTab>('hot')
  const [search, setSearch] = useState('')
  const [agent, setAgent] = useState('')
  const [editing, setEditing] = useState<Memory | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const agents = useScheduleAgents()
  const stats = useMemoryStats()
  const memories = useMemories({
    agent: agent || undefined,
    category: tab === 'log' ? undefined : tab,
    q: search.trim() || undefined,
    searchMode: 'hybrid',
  })
  const deleteMut = useDeleteMemory()

  const onDelete = async (m: Memory) => {
    if (!confirm('Töröljem ezt az emléket?')) return
    try {
      await deleteMut.mutateAsync(m.id)
      showToast('Emlék törölve', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const newButton = (
    <Button
      variant="primary"
      onClick={() => setCreateOpen(true)}
      leftIcon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      }
    >
      Új emlék
    </Button>
  )

  return (
    <section>
      <PageHeader
        title="Memória"
        subtitle="Hot / warm / cold tier-ek és napi napló."
        actions={newButton}
      />

      <MemoryStatsBar stats={stats.data} />

      <div className="mb-3 flex flex-wrap items-stretch gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés az emlékekben…"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] py-2 pl-9 pr-3 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
        >
          <option value="">Minden ügynök</option>
          {(agents.data ?? []).map((a) => (
            <option key={a.name} value={a.name}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={[
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'log' ? (
        <DailyLogPanel agent={agent || agents.data?.[0]?.name || null} />
      ) : memories.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : memories.isError ? (
        <EmptyState tone="error">
          {memories.error instanceof Error
            ? memories.error.message
            : 'Hiba a memóriák betöltésekor.'}
        </EmptyState>
      ) : memories.data && memories.data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {memories.data.map((m) => (
            <MemoryItem
              key={m.id}
              memory={m}
              onEdit={setEditing}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState>
          Nincs emlék ebben a kategóriában{search ? ' a kereséssel' : ''}.
        </EmptyState>
      )}

      <MemoryEditorModal
        open={createOpen || editing !== null}
        onClose={() => {
          setCreateOpen(false)
          setEditing(null)
        }}
        memory={editing}
        defaultAgentId={agent || agents.data?.[0]?.name}
        agents={agents.data ?? []}
      />
    </section>
  )
}
