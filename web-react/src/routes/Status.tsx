import { useQueryClient } from '@tanstack/react-query'
import { useStatus } from '@/hooks/useStatus'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { OverallBanner } from '@/components/status/OverallBanner'
import { ServicesGrid } from '@/components/status/ServicesGrid'
import { IncidentList } from '@/components/status/IncidentList'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

export default function StatusPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, isFetching } = useStatus()

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['status'] })

  const refreshButton = (
    <Button
      onClick={refresh}
      disabled={isFetching}
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
        title="Státusz"
        subtitle="Claude szolgáltatások állapota."
        actions={refreshButton}
      />

      {isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : isError || !data ? (
        <EmptyState tone="error">
          {error instanceof Error
            ? error.message
            : 'Nem sikerült betölteni a státuszt.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <OverallBanner overall={data.overall} />
          <ServicesGrid incidents={data.incidents} />
          <IncidentList incidents={data.incidents} />
        </div>
      )}
    </section>
  )
}
