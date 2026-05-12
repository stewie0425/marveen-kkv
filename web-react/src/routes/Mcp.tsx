import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import {
  useConnectors,
  useDeleteConnector,
  useInstallCatalogItem,
  useMcpCatalog,
  useRefreshConnectors,
  useUninstallCatalogItem,
} from '@/hooks/useConnectors'
import { showToast } from '@/lib/toast'
import type { CatalogItem, Connector } from '@/types/api'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

type Tab = 'installed' | 'catalog'

export default function McpPage() {
  const [tab, setTab] = useState<Tab>('installed')
  const connectors = useConnectors()
  const catalog = useMcpCatalog()
  const refreshMut = useRefreshConnectors()
  const installMut = useInstallCatalogItem()
  const uninstallMut = useUninstallCatalogItem()
  const deleteMut = useDeleteConnector()

  const onRefresh = async () => {
    try {
      await refreshMut.mutateAsync()
      showToast('Connectorok frissítve', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onInstall = async (id: string) => {
    try {
      await installMut.mutateAsync({ id })
      showToast('Telepítés kész', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Telepítés hiba', 'error')
    }
  }

  const onUninstall = async (item: CatalogItem) => {
    if (!confirm(`Eltávolítod a(z) "${item.label}" connectort?`)) return
    try {
      await uninstallMut.mutateAsync(item.id)
      showToast('Eltávolítva', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onDelete = async (c: Connector) => {
    if (!confirm(`Törlöd a(z) "${c.name}" connectort?`)) return
    try {
      await deleteMut.mutateAsync(c.name)
      showToast('Connector törölve', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const refreshButton = (
    <Button
      onClick={onRefresh}
      disabled={refreshMut.isPending}
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
        title="MCP"
        subtitle="MCP szerverek és katalógus."
        actions={refreshButton}
      />

      <div role="tablist" className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
        <TabButton active={tab === 'installed'} onClick={() => setTab('installed')}>
          Telepítve ({connectors.data?.length ?? 0})
        </TabButton>
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          Katalógus ({catalog.data?.length ?? 0})
        </TabButton>
      </div>

      {tab === 'installed' ? (
        connectors.isLoading ? (
          <EmptyState>Betöltés…</EmptyState>
        ) : connectors.isError ? (
          <EmptyState tone="error">
            {connectors.error instanceof Error
              ? connectors.error.message
              : 'Nem sikerült betölteni a connectorokat.'}
          </EmptyState>
        ) : connectors.data && connectors.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {connectors.data.map((c) => (
              <ConnectorCard
                key={c.name}
                connector={c}
                onDelete={() => onDelete(c)}
                isPending={deleteMut.isPending}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nincs telepített MCP szerver.</EmptyState>
        )
      ) : catalog.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : catalog.isError ? (
        <EmptyState tone="error">
          {catalog.error instanceof Error
            ? catalog.error.message
            : 'Nem sikerült betölteni a katalógust.'}
        </EmptyState>
      ) : catalog.data && catalog.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {catalog.data.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              onInstall={() => onInstall(item.id)}
              onUninstall={() => onUninstall(item)}
              isPending={installMut.isPending || uninstallMut.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState>Üres katalógus.</EmptyState>
      )}

      <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">
        Egyedi MCP szerver hozzáadását (parancs + env) a Claude Code CLI-vel végezd:
        <code className="font-mono"> claude mcp add &lt;name&gt; ...</code>. Listázáshoz jelen oldal
        Frissítés gombja vagy <code className="font-mono">claude mcp list</code>.
      </p>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-[var(--color-accent)] text-[var(--color-text)]'
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ConnectorCard({
  connector,
  onDelete,
  isPending,
}: {
  connector: Connector
  onDelete: () => void
  isPending: boolean
}) {
  const ok = connector.status === 'ok' || connector.status === 'connected'
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">
            {connector.name}
          </h3>
          <p className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
            {connector.endpoint}
          </p>
        </div>
        <span
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            ok
              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
              : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
          ].join(' ')}
        >
          {connector.status}
        </span>
      </header>
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-text-muted)]">
        <span>
          {connector.type} · forrás: {connector.source}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] disabled:opacity-50"
        >
          Törlés
        </button>
      </div>
    </article>
  )
}

function CatalogCard({
  item,
  onInstall,
  onUninstall,
  isPending,
}: {
  item: CatalogItem
  onInstall: () => void
  onUninstall: () => void
  isPending: boolean
}) {
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">
            {item.label}
          </h3>
          {item.category ? (
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">
              {item.category}
            </p>
          ) : null}
        </div>
        {item.installed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-success)]">
            telepítve
          </span>
        ) : null}
      </header>
      {item.description ? (
        <p className="line-clamp-3 text-[13px] leading-snug text-[var(--color-text-secondary)]">
          {item.description}
        </p>
      ) : null}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-[11px]">
        {item.homepage ? (
          <a
            href={item.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[var(--color-info)] hover:text-[var(--color-accent)]"
          >
            {item.homepage}
          </a>
        ) : (
          <span className="text-[var(--color-text-muted)]">{item.source ?? ''}</span>
        )}
        {item.installed ? (
          <Button size="sm" onClick={onUninstall} disabled={isPending}>
            Eltávolítás
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={onInstall} disabled={isPending}>
            Telepítés
          </Button>
        )}
      </div>
    </article>
  )
}
