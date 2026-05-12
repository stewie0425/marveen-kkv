import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useAgents, useMarveen } from '@/hooks/useAgents'
import { AgentCard } from '@/components/agents/AgentCard'
import { MarveenCard } from '@/components/agents/MarveenCard'
import { AgentDetailModal } from '@/components/agents/AgentDetailModal'
import { CreateAgentModal } from '@/components/agents/CreateAgentModal'

export default function AgentsPage() {
  const agents = useAgents()
  const marveen = useMarveen()
  const [selected, setSelected] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

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
      Új ágens
    </Button>
  )

  return (
    <section>
      <PageHeader
        title="Ügynökök"
        subtitle="AI csapattagok kezelése"
        actions={newButton}
      />

      {agents.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : agents.isError ? (
        <EmptyState tone="error">
          {agents.error instanceof Error
            ? agents.error.message
            : 'Nem sikerült betölteni az ágenseket.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {marveen.data ? (
            <MarveenCard
              marveen={marveen.data}
              onSelect={() => {
                /* Marveen detail modal — read-only edit deferred to Phase 6.
                 * For now we surface a notice on the Sessions page already
                 * showing live state. */
              }}
            />
          ) : null}
          {(agents.data ?? []).map((a) => (
            <AgentCard key={a.name} agent={a} onSelect={setSelected} />
          ))}
        </div>
      )}

      <AgentDetailModal name={selected} onClose={() => setSelected(null)} />
      <CreateAgentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          setCreateOpen(false)
          setSelected(name)
        }}
      />
    </section>
  )
}
