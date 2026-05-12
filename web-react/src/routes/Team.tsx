import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useTeamGraph } from '@/hooks/useTeamGraph'
import { ForceGraph } from '@/components/team/ForceGraph'
import { AgentDetailModal } from '@/components/agents/AgentDetailModal'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

export default function TeamPage() {
  const qc = useQueryClient()
  const graph = useTeamGraph()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 480 })
  const [selected, setSelected] = useState<string | null>(null)

  // Re-measure the graph container so the simulation knows its drawing
  // surface. Resize observer keeps the graph centred on layout shifts.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(320, rect.width),
        height: Math.max(360, Math.min(640, rect.width * 0.55)),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const refreshButton = (
    <Button
      onClick={() => qc.invalidateQueries({ queryKey: ['team-graph'] })}
      disabled={graph.isFetching}
      leftIcon={
        <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      }
    >
      Frissítés
    </Button>
  )

  return (
    <section>
      <PageHeader
        title="Csapat"
        subtitle="Ki kinek jelent és ki kinek delegál"
        actions={refreshButton}
      />

      <div
        ref={containerRef}
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-sm)]"
      >
        {graph.isLoading ? (
          <div className="flex h-[360px] items-center justify-center text-sm text-[var(--color-text-muted)]">
            Betöltés…
          </div>
        ) : graph.isError || !graph.data ? (
          <EmptyState tone="error" className="m-2">
            {graph.error instanceof Error
              ? graph.error.message
              : 'Nem sikerült betölteni a csapatgráfot.'}
          </EmptyState>
        ) : graph.data.nodes.length <= 1 ? (
          <div className="flex h-[360px] items-center justify-center text-sm text-[var(--color-text-muted)]">
            Nincs sub-agent létrehozva.
          </div>
        ) : (
          <ForceGraph
            graph={graph.data}
            width={size.width}
            height={size.height}
            onSelect={setSelected}
          />
        )}
      </div>

      <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
        Az ügynököket áthúzhatod, kattintásra megnyílik a részletek modális.
      </p>

      <AgentDetailModal name={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
