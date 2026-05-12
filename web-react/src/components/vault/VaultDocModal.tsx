import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { useVaultDocument } from '@/hooks/useVault'
import { showToast } from '@/lib/toast'
import type { VaultDocument } from '@/types/api'

interface Props {
  doc: VaultDocument | null
  onClose: () => void
}

export function VaultDocModal({ doc, onClose }: Props) {
  const detail = useVaultDocument(doc?.id ?? null)
  const open = doc !== null

  const onCopy = async () => {
    const content = detail.data?.content
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      showToast('Markdown vágólapra másolva', 'success')
    } catch {
      showToast('Másolás sikertelen', 'error')
    }
  }

  const title = doc?.title || doc?.vault_path || doc?.id || 'Vault dokumentum'
  const created = doc ? new Date(doc.created_at * 1000).toLocaleString('hu-HU') : ''
  const content = detail.data?.content ?? doc?.snippet ?? ''

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] text-[var(--color-text-muted)]">
        {doc?.agent_id ? `${doc.agent_id} · ${created}` : created}
        {doc?.vault_path ? ` · ${doc.vault_path}` : ''}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onCopy} disabled={!content}>
          Másolás
        </Button>
        <Button variant="primary" onClick={onClose}>
          Bezárás
        </Button>
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" footer={footer}>
      {detail.isLoading ? (
        <div className="text-sm text-[var(--color-text-muted)]">Betöltés…</div>
      ) : detail.isError ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
          {detail.error instanceof Error
            ? detail.error.message
            : 'Hiba a dokumentum betöltésekor.'}
        </div>
      ) : (
        <article className="vault-prose text-sm leading-relaxed text-[var(--color-text)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || '*Üres dokumentum.*'}
          </ReactMarkdown>
        </article>
      )}
    </Modal>
  )
}
