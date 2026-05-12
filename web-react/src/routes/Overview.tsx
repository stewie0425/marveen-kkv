import { useOverview } from '@/hooks/useOverview'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { StatTile } from '@/components/overview/StatTile'
import { TeamCard } from '@/components/overview/TeamCard'
import { ActivityCard } from '@/components/overview/ActivityCard'
import { formatNumber } from '@/lib/format'

function tasksDiffSub(today: number, yesterday: number): string {
  const diff = today - yesterday
  if (diff === 0) return 'ugyanaz mint tegnap'
  if (diff > 0) return `+${diff} a tegnapihoz`
  return `${diff} a tegnapihoz`
}

export default function OverviewPage() {
  const { data, isLoading, isError, error } = useOverview()

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Áttekintés" subtitle="Aktív ágensek és napi statisztikák." />
        <EmptyState>Betöltés…</EmptyState>
      </section>
    )
  }

  if (isError || !data) {
    return (
      <section>
        <PageHeader title="Áttekintés" subtitle="Aktív ágensek és napi statisztikák." />
        <EmptyState tone="error">
          Hiba: {error instanceof Error ? error.message : 'Nem érhető el az overview adat.'}
        </EmptyState>
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        title="Áttekintés"
        subtitle="Aktív ágensek és napi statisztikák."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Aktív ügynökök"
          value={data.agents.running}
          sub={`${data.agents.total} összesen`}
        />
        <StatTile
          label="Ma futott feladat"
          value={formatNumber(data.tasksToday)}
          sub={tasksDiffSub(data.tasksToday, data.tasksYesterday)}
        />
        <StatTile
          label="Memória"
          value={formatNumber(data.memories.count)}
          sub={`bejegyzés · ${data.memories.categories} category`}
        />
        <StatTile
          label="Generált skillek"
          value={data.skills.count}
          sub={data.skills.today > 0 ? `ebbôl ${data.skills.today} ma` : null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamCard team={data.team} />
        <ActivityCard activity={data.activity} />
      </div>
    </section>
  )
}
