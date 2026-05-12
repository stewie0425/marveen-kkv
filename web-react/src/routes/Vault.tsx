import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useScheduleAgents } from '@/hooks/useSchedules'
import { useVaultDocuments } from '@/hooks/useVault'
import { VaultDocCard } from '@/components/vault/VaultDocCard'
import { VaultDocModal } from '@/components/vault/VaultDocModal'
import { ObsidianViewer } from '@/components/obsidian/ObsidianViewer'
import type { VaultDocument } from '@/types/api'

type Tab = 'rag' | 'obsidian'

export default function VaultPage() {
  const [tab, setTab] = useState<Tab>('obsidian')
  const [search, setSearch] = useState('')
  const [agent, setAgent] = useState('')
  const [openDoc, setOpenDoc] = useState<VaultDocument | null>(null)

  const agents = useScheduleAgents()
  const list = useVaultDocuments({
    agent: agent || undefined,
    q: search.trim() || undefined,
    limit: 100,
  })

  const docs = list.data?.documents ?? []
  const total = list.data?.total ?? 0

  return (
    <section>
      <PageHeader
        title="Vault"
        subtitle="Obsidian tudásbázis és ügynök memória dokumentumok."
      />

      {/* Tab switcher */}
      <div className="mb-5 flex gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1 w-fit">
        <TabButton active={tab === 'obsidian'} onClick={() => setTab('obsidian')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          Obsidian vault
        </TabButton>
        <TabButton active={tab === 'rag'} onClick={() => setTab('rag')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          Memória dokumentumok
        </TabButton>
      </div>

      {tab === 'obsidian' ? (
        <ObsidianViewer />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-stretch gap-2">
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
                placeholder="Keresés a vault dokumentumokban…"
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

          {total > 0 ? (
            <div className="mb-3 text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {total} dokumentum
            </div>
          ) : null}

          {list.isLoading ? (
            <EmptyState>Betöltés…</EmptyState>
          ) : list.isError ? (
            <EmptyState tone="error">
              {list.error instanceof Error
                ? list.error.message
                : 'Hiba a vault dokumentumok betöltésekor.'}
            </EmptyState>
          ) : docs.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {docs.map((d) => (
                <VaultDocCard key={d.id} doc={d} onOpen={setOpenDoc} />
              ))}
            </div>
          ) : (
            <EmptyState>
              {search || agent
                ? 'Nincs ide passzoló vault dokumentum.'
                : 'Még üres a vault. Amint egy ügynök cold tier-re ment, itt megjelenik.'}
            </EmptyState>
          )}

          <VaultDocModal doc={openDoc} onClose={() => setOpenDoc(null)} />
        </>
      )}
    </section>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
        active
          ? 'bg-[var(--color-accent)] text-white shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  )
}
