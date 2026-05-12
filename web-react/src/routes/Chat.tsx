import { useState, useEffect, useRef } from 'react'
import { getUserEmail, getUserToken, clearUserSession, userApiJson } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

interface Props {
  onLogout: () => void
}

export default function ChatPage({ onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const email = getUserEmail()

  // Load history
  useEffect(() => {
    userApiJson<ChatMessage[]>('/api/user-chat/history')
      .then(setMessages)
      .catch(() => {})
  }, [])

  // SSE stream for live assistant replies
  useEffect(() => {
    const token = getUserToken()
    if (!token) return
    const es = new EventSource(`/api/user-chat/stream?_t=${Date.now()}`)
    // EventSource doesn't support custom headers natively; the backend
    // identifies the user via the Authorization header injected by a fetch.
    // We use a separate authenticated fetch to open the SSE stream below.
    es.close()

    // Authenticated SSE via fetch + ReadableStream
    let active = true
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/user-chat/stream', {
          headers: { Authorization: 'Bearer ' + token },
          signal: controller.signal,
        })
        if (!res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (active) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const msg = JSON.parse(line.slice(6)) as ChatMessage
                setMessages(prev => {
                  if (prev.find(m => m.id === msg.id)) return prev
                  return [...prev, msg]
                })
              } catch { /* skip malformed */ }
            }
          }
        }
      } catch { /* connection closed or component unmounted */ }
    })()
    return () => { active = false; controller.abort() }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    setInput('')
    // Optimistic UI: add user message immediately
    const optimistic: ChatMessage = { id: Date.now(), role: 'user', content, created_at: Math.floor(Date.now() / 1000) }
    setMessages(prev => [...prev, optimistic])
    try {
      await userApiJson('/api/user-chat/message', {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
    } catch {
      setError('Nem sikerült elküldeni az üzenetet.')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const logout = async () => {
    await userApiJson('/api/user-auth/logout', { method: 'POST' }).catch(() => {})
    clearUserSession()
    onLogout()
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">M</div>
          <span className="font-semibold">Marveen</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-[var(--color-text-muted)] sm:inline">{email}</span>
          <button
            onClick={logout}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Kilépés
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
              Írj egy üzenetet a kezdéshez.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-bold text-white">
                  M
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-bold text-white">M</div>
              <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        {error && <p className="mb-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Írj üzenetet… (Enter = küldés, Shift+Enter = sortörés)"
            className="min-h-[40px] flex-1 resize-none overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 160) + 'px'
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent)] text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
            aria-label="Küldés"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
