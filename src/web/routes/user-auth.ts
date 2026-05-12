import { hasAnyDashboardAdmin } from '../../db.js'
import { readBody, json } from '../http-helpers.js'
import { loginUser, logoutUser, registerUser, extractUserSessionToken, getUserFromToken } from '../user-auth.js'
import type { RouteHandler } from './types.js'

// POST /api/user-auth/setup  — first-boot admin creation (only when no admin exists)
// POST /api/user-auth/login
// POST /api/user-auth/logout
// GET  /api/user-auth/me
// GET  /api/user-auth/setup-required

export const tryHandleUserAuth: RouteHandler = async ({ req, res, path, method }) => {
  if (!path.startsWith('/api/user-auth/')) return false

  // Setup required probe — used by frontend to decide whether to show wizard
  if (path === '/api/user-auth/setup-required' && method === 'GET') {
    json(res, { setup_required: !hasAnyDashboardAdmin() })
    return true
  }

  // First-boot setup — only allowed when no admin exists
  if (path === '/api/user-auth/setup' && method === 'POST') {
    if (hasAnyDashboardAdmin()) {
      json(res, { error: 'Setup already completed.' }, 403)
      return true
    }
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 4096 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const { email, password } = body
    if (typeof email !== 'string' || !email.includes('@')) {
      json(res, { error: 'Valid email required.' }, 400)
      return true
    }
    if (typeof password !== 'string' || password.length < 8) {
      json(res, { error: 'Password must be at least 8 characters.' }, 400)
      return true
    }
    try {
      await registerUser(email, password, 'admin')
      const result = await loginUser(email, password)
      if (!result) { json(res, { error: 'Setup failed.' }, 500); return true }
      json(res, { token: result.token, role: result.user.role, email: result.user.email })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Setup failed.'
      json(res, { error: msg }, 500)
    }
    return true
  }

  // Login
  if (path === '/api/user-auth/login' && method === 'POST') {
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 4096 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const { email, password } = body
    if (typeof email !== 'string' || typeof password !== 'string') {
      json(res, { error: 'Email and password required.' }, 400)
      return true
    }
    const result = await loginUser(email, password)
    if (!result) {
      json(res, { error: 'Invalid credentials.' }, 401)
      return true
    }
    json(res, { token: result.token, role: result.user.role, email: result.user.email })
    return true
  }

  // Logout
  if (path === '/api/user-auth/logout' && method === 'POST') {
    const token = extractUserSessionToken(req.headers.authorization)
    if (token) logoutUser(token)
    json(res, { ok: true })
    return true
  }

  // Me
  if (path === '/api/user-auth/me' && method === 'GET') {
    const token = extractUserSessionToken(req.headers.authorization)
    if (!token) { json(res, { error: 'Not authenticated.' }, 401); return true }
    const user = getUserFromToken(token)
    if (!user) { json(res, { error: 'Session expired.' }, 401); return true }
    json(res, { id: user.id, email: user.email, role: user.role })
    return true
  }

  return false
}
