import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useSkills } from '@/hooks/useSkills'
import type { Skill } from '@/types/api'

const SOURCE_TONE: Record<string, string> = {
  global: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  builtin: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  agent: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
}

export default function SkillsPage() {
  const skills = useSkills()
  const [search, setSearch] = useState('')

  const filtered = (skills.data ?? []).filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    )
  })

  return (
    <section>
      <PageHeader
        title="Skillek"
        subtitle="Globális és ágens-specifikus skillek (~/.claude/skills/)."
      />

      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés a skillekben…"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {skills.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : skills.isError ? (
        <EmptyState tone="error">
          {skills.error instanceof Error
            ? skills.error.message
            : 'Nem sikerült betölteni a skill-eket.'}
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>Nincs találat.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((s) => (
            <SkillCard key={s.path || s.name} skill={s} />
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">
        Új skill létrehozásához használd Claude Code-on belül a /skills:create
        parancsot, vagy a skill-factory skillt a kívánt ágenssel. Az asszignáláshoz
        szerkeszd az ágens settings.json-ját (Phase 6+ polish).
      </p>
    </section>
  )
}

function SkillCard({ skill }: { skill: Skill }) {
  const tone = SOURCE_TONE[skill.source] ?? 'bg-[var(--color-input)] text-[var(--color-text-muted)]'
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">
            {skill.label}
          </h3>
          <p className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
            {skill.name}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
          {skill.source}
        </span>
      </header>
      <p className="line-clamp-3 text-[13px] leading-snug text-[var(--color-text-secondary)]">
        {skill.description}
      </p>
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-text-muted)]">
        <span className="font-mono truncate">{skill.path}</span>
        {skill.agents.length > 0 ? (
          <span>{skill.agents.length} ágens használja</span>
        ) : (
          <span>nincs hozzárendelt ágens</span>
        )}
      </div>
    </article>
  )
}
