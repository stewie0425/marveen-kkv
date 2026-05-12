import { insertUserChatMessage, getUserChatHistory, getLatestAssistantMessage, createAgentMessage } from '../../db.js'
import { readBody, json } from '../http-helpers.js'
import { extractUserSessionToken, getUserFromToken } from '../user-auth.js'
import { MAIN_AGENT_ID } from '../../config.js'
import type { RouteHandler } from './types.js'
import type http from 'node:http'

// GET  /api/user-chat/history
// POST /api/user-chat/message
// GET  /api/user-chat/stream  (SSE — long-poll for assistant replies)

function requireUserAuth(authHeader: string | undefined) {
  const token = extractUserSessionToken(authHeader)
  if (!token) return null
  return getUserFromToken(token) ?? null
}

// SSE subscriber registry: userId → Set of response objects
const sseClients = new Map<number, Set<http.ServerResponse>>()

export function notifyUserChat(userId: number, message: { role: string; content: string; id: number; created_at: number }) {
  const clients = sseClients.get(userId)
  if (!clients || clients.size === 0) return
  const payload = `data: ${JSON.stringify(message)}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch { clients.delete(res) }
  }
}

export const tryHandleUserChat: RouteHandler = async ({ req, res, path, method }) => {
  if (!path.startsWith('/api/user-chat/')) return false

  const user = requireUserAuth(req.headers.authorization)
  if (!user) {
    json(res, { error: 'Authentication required.' }, 401)
    return true
  }

  // Chat history
  if (path === '/api/user-chat/history' && method === 'GET') {
    const history = getUserChatHistory(user.id, 100).reverse()
    json(res, history)
    return true
  }

  // Send message
  if (path === '/api/user-chat/message' && method === 'POST') {
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 32768 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const content = body.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      json(res, { error: 'Non-empty content required.' }, 400)
      return true
    }
    const msg = insertUserChatMessage(user.id, 'user', content.trim())
    // Forward to Marveen via agent_messages so the existing routing picks it up
    createAgentMessage(`web-user:${user.id}`, MAIN_AGENT_ID, content.trim())
    // Broadcast to any open SSE streams for this user
    notifyUserChat(user.id, { role: msg.role, content: msg.content, id: msg.id, created_at: msg.created_at })
    json(res, { id: msg.id, created_at: msg.created_at })
    return true
  }

  // SSE stream — client holds this open to receive assistant replies
  if (path === '/api/user-chat/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(':\n\n') // comment keeps connection alive immediately

    if (!sseClients.has(user.id)) sseClients.set(user.id, new Set())
    const clientSet = sseClients.get(user.id)!
    clientSet.add(res)

    // Heartbeat every 25s to prevent proxy timeouts
    const hb = setInterval(() => {
      try { res.write(':\n\n') } catch { clearInterval(hb) }
    }, 25_000)

    req.on('close', () => {
      clearInterval(hb)
      clientSet.delete(res)
    })

    return true
  }

  return false
}

// Called by the agent message router when Marveen sends a reply to a web user.
// from must match 'web-user:<userId>' pattern in the `to` field of the reply.
export function deliverAssistantReply(toUserId: number, content: string): void {
  const msg = insertUserChatMessage(toUserId, 'assistant', content)
  notifyUserChat(toUserId, { role: msg.role, content: msg.content, id: msg.id, created_at: msg.created_at })
}
