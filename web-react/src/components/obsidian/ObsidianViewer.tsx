import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useObsidianTree, useObsidianFile, useObsidianSearch } from '@/hooks/useObsidian'
import { EmptyState } from '@/components/common/EmptyState'
import type { ObsidianTreeNode } from '@/types/api'

// --- File tree ---

interface TreeItemProps {
  node: ObsidianTreeNode
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
}

function TreeItem({ node, selectedPath, onSelect, depth = 0 }: TreeItemProps) {
  const [open, setOpen] = useState(depth < 1)
  const isSelected = node.path === selectedPath
  const indent = depth * 14

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-[var(--color-hover)] focus:outline-none"
          style={{ paddingLeft: 8 + indent }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-[var(--color-accent)]"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="truncate font-medium text-[var(--color-text)]">{node.name}</span>
        </button>
        {open && node.children?.map(child => (
          <TreeItem
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  const isCanvas = node.name.endsWith('.canvas')
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm focus:outline-none ${
        isSelected
          ? 'bg-[var(--color-accent)] text-white'
          : 'hover:bg-[var(--color-hover)] text-[var(--color-text-muted)]'
      }`}
      style={{ paddingLeft: 8 + indent }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0"
      >
        {isCanvas ? (
          <rect x="3" y="3" width="18" height="18" rx="2" />
        ) : (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </>
        )}
      </svg>
      <span className="truncate">{node.name.replace(/\.(md|canvas)$/, '')}</span>
    </button>
  )
}

// Flatten tree to a sorted list for search result matching
function flattenTree(nodes: ObsidianTreeNode[]): ObsidianTreeNode[] {
  const result: ObsidianTreeNode[] = []
  for (const n of nodes) {
    if (n.type === 'file') result.push(n)
    else if (n.children) result.push(...flattenTree(n.children))
  }
  return result
}

// --- Main viewer ---

export function ObsidianViewer() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const tree = useObsidianTree()
  const fileQuery = useObsidianFile(selectedPath)
  const searchQuery = useObsidianSearch(debouncedSearch)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // When a search result is selected, set the path
  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path)
    setSearch('')
    setDebouncedSearch('')
  }, [])

  // Scroll content to top when switching files
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [selectedPath])

  const isSearching = debouncedSearch.trim().length >= 2
  const searchResults = (searchQuery.data?.results ?? [])
  const allFiles = tree.data ? flattenTree(tree.data.tree) : []

  // Map search result filename to tree node path
  const searchNodes = searchResults
    .map(r => allFiles.find(f => f.path === r.filename || f.name === r.filename))
    .filter((n): n is ObsidianTreeNode => n !== undefined)

  const isNotConfigured =
    tree.isError &&
    tree.error instanceof Error &&
    tree.error.message.includes('503')

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[400px] overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
      {/* Left: tree + search */}
      <div className="flex w-[260px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-alt)]">
        {/* Search bar */}
        <div className="border-b border-[var(--color-border)] p-2">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Keresés…"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] py-1.5 pl-8 pr-3 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </div>

        {/* Tree or search results */}
        <div className="flex-1 overflow-y-auto p-1">
          {isNotConfigured ? (
            <div className="p-3 text-[11px] text-[var(--color-text-muted)]">
              Az Obsidian API token nincs beállítva.<br />
              <code className="mt-1 block text-[10px] opacity-70">
                /etc/marveen/obsidian-rest.env
              </code>
            </div>
          ) : tree.isLoading ? (
            <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Betöltés…</div>
          ) : isSearching ? (
            searchQuery.isLoading ? (
              <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Keresés…</div>
            ) : searchNodes.length === 0 ? (
              <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Nincs találat.</div>
            ) : (
              searchNodes.map(node => (
                <TreeItem
                  key={node.path}
                  node={node}
                  selectedPath={selectedPath}
                  onSelect={handleSelect}
                  depth={0}
                />
              ))
            )
          ) : tree.data?.tree ? (
            tree.data.tree.map(node => (
              <TreeItem
                key={node.path}
                node={node}
                selectedPath={selectedPath}
                onSelect={handleSelect}
                depth={0}
              />
            ))
          ) : (
            <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Üres vault.</div>
          )}
        </div>
      </div>

      {/* Right: content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
        {!selectedPath ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Válassz egy fájlt a bal oldali fából.
            </p>
          </div>
        ) : fileQuery.isLoading ? (
          <EmptyState>Betöltés…</EmptyState>
        ) : fileQuery.isError ? (
          <EmptyState tone="error">
            {fileQuery.error instanceof Error
              ? fileQuery.error.message
              : 'Hiba a fájl betöltésekor.'}
          </EmptyState>
        ) : (
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <div className="mb-4 border-b border-[var(--color-border)] pb-3">
              <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                {selectedPath}
              </p>
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {fileQuery.data?.content ?? ''}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  )
}
