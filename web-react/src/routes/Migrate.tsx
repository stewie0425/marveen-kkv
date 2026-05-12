import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useScheduleAgents } from '@/hooks/useSchedules'
import { useMigrateRun, useMigrateScan } from '@/hooks/useMigrate'
import { showToast } from '@/lib/toast'
import { formatNumber } from '@/lib/format'
import type { MigrateFinding, MigrateScanResponse } from '@/types/api'

const TYPE_LABEL: Record<string, string> = {
  personality: 'Személyiség',
  profile: 'Felhasználói profil',
  memory: 'Memória',
  'memory-hot': 'Hot memória',
  'memory-warm': 'Warm memória',
  'memory-cold': 'Cold memória',
  heartbeat: 'Heartbeat konfig',
  config: 'Konfiguráció',
  'daily-log': 'Napi napló',
  schedule: 'Ütemezés',
}

const TYPE_ICON: Record<string, string> = {
  personality: '🎭',
  profile: '👤',
  memory: '🧠',
  'memory-hot': '🔥',
  'memory-warm': '🫖',
  'memory-cold': '❄️',
  heartbeat: '💓',
  config: '⚙️',
  'daily-log': '📋',
  schedule: '⏰',
}

type Step = 'input' | 'preview' | 'result'

export default function MigratePage() {
  const agents = useScheduleAgents()
  const scanMut = useMigrateScan()
  const runMut = useMigrateRun()
  const [step, setStep] = useState<Step>('input')
  const [path, setPath] = useState('')
  const [type, setType] = useState('directory')
  const [agent, setAgent] = useState('')
  const [scanResult, setScanResult] = useState<MigrateScanResponse | null>(null)
  const [runResult, setRunResult] = useState<{
    imported: number
    stats: { hot: number; warm: number; cold: number; shared: number }
    details?: string[]
  } | null>(null)

  const onScan = async () => {
    if (!path.trim()) {
      showToast('Add meg a forrás útvonalat', 'error')
      return
    }
    try {
      const data = await scanMut.mutateAsync({ sourcePath: path, sourceType: type })
      setScanResult(data)
      setAgent(agents.data?.[0]?.name ?? '')
      setStep('preview')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Scan hiba', 'error')
    }
  }

  const onRun = async () => {
    if (!scanResult || !agent) return
    try {
      const data = await runMut.mutateAsync({
        findings: scanResult.findings,
        agentId: agent,
      })
      setRunResult(data)
      setStep('result')
      showToast('Költöztetés kész', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Run hiba', 'error')
    }
  }

  const reset = () => {
    setPath('')
    setScanResult(null)
    setRunResult(null)
    setStep('input')
  }

  return (
    <section>
      <PageHeader
        title="Költöztetés"
        subtitle="Adatok importálása régebbi telepítésbôl egy ágens memóriájába."
      />

      {step === 'input' ? (
        <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
          <Field label="Forrás útvonal" hint="abszolút filesystem path">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/opt/old-marveen vagy /home/user/.claude"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </Field>
          <Field label="Forrás típus">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="directory">Mappa (régi telepítés)</option>
              <option value="claude-config">Claude konfig (~/.claude)</option>
              <option value="memory-export">Memória export</option>
            </select>
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onScan} disabled={scanMut.isPending}>
              {scanMut.isPending ? 'Scan…' : 'Beolvasás'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'preview' && scanResult ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Összesen" value={scanResult.summary.total} />
            <SummaryTile label="Memória" value={scanResult.summary.memory} />
            <SummaryTile
              label="Profil"
              value={scanResult.summary.personality + scanResult.summary.profile}
            />
            <SummaryTile
              label="Konfig"
              value={scanResult.summary.config + scanResult.summary.heartbeat}
            />
          </div>

          {scanResult.findings.length === 0 ? (
            <EmptyState>Nem található migrálható tartalom.</EmptyState>
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              <header className="border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold">
                {scanResult.findings.length} talált elem
              </header>
              <ul className="max-h-[420px] overflow-y-auto divide-y divide-[var(--color-border)]">
                {scanResult.findings.map((f, i) => (
                  <FindingRow key={i} finding={f} />
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <Field label="Cél ágens" className="flex-1 min-w-[200px]">
              <select
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                {(agents.data ?? []).map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-center gap-2">
              <Button onClick={() => setStep('input')}>Vissza</Button>
              <Button
                variant="primary"
                onClick={onRun}
                disabled={
                  runMut.isPending ||
                  !agent ||
                  scanResult.findings.length === 0
                }
              >
                {runMut.isPending ? 'Költöztetés…' : 'Költöztetés indítása'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'result' && runResult ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius)] border border-[var(--color-success)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success)]">
            <strong>Költöztetés kész!</strong> {runResult.imported} elem importálva.
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Hot" value={runResult.stats.hot} tone="text-[#dc3c3c]" />
            <SummaryTile label="Warm" value={runResult.stats.warm} tone="text-[var(--color-accent)]" />
            <SummaryTile label="Cold" value={runResult.stats.cold} tone="text-[var(--color-info)]" />
            <SummaryTile
              label="Shared"
              value={runResult.stats.shared}
              tone="text-[#9a8a30] dark:text-[#d8c87a]"
            />
          </div>
          {runResult.details && runResult.details.length > 0 ? (
            <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="mb-2 text-sm font-semibold">Részletek</h3>
              <ul className="flex flex-col gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                {runResult.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button variant="primary" onClick={reset}>
              Új költöztetés
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function FindingRow({ finding }: { finding: MigrateFinding }) {
  const sizeKB = Math.round((finding.size / 1024) * 10) / 10
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <span className="text-base">{TYPE_ICON[finding.type] ?? '📄'}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[var(--color-text)]">{finding.name}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {TYPE_LABEL[finding.type] ?? finding.type}
        </div>
      </div>
      <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {sizeKB} KB
      </span>
    </li>
  )
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={`text-xl font-semibold tabular-nums ${tone ?? 'text-[var(--color-text)]'}`}
      >
        {formatNumber(value)}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        {hint ? (
          <span className="text-[11px] italic text-[var(--color-text-muted)]">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}
