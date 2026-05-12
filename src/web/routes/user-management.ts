import { listDashboardUsers, getDashboardUserById, updateDashboardUser, deleteDashboardUser } from '../../db.js'
import { hashPassword, registerUser, extractUserSessionToken, getUserFromToken } from '../user-auth.js'
import { readBody, json } from '../http-helpers.js'
import type { RouteHandler } from './types.js'

// All routes here require an admin user session.
// GET    /api/user-management/users
// POST   /api/user-management/users
// PATCH  /api/user-management/users/:id
// DELETE /api/user-management/users/:id

function requireAdmin(authHeader: string | undefined): { id: number; email: string; role: string } | null {
  const token = extractUserSessionToken(authHeader)
  if (!token) return null
  const user = getUserFromToken(token)
  if (!user || user.role !== 'admin') return null
  return user
}

export const tryHandleUserManagement: RouteHandler = async ({ req, res, path, method }) => {
  if (!path.startsWith('/api/user-management/')) return false

  const admin = requireAdmin(req.headers.authorization)
  if (!admin) {
    json(res, { error: 'Admin access required.' }, 403)
    return true
  }

  // List users
  if (path === '/api/user-management/users' && method === 'GET') {
    json(res, listDashboardUsers())
    return true
  }

  // Create user
  if (path === '/api/user-management/users' && method === 'POST') {
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 4096 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const { email, password, role } = body
    if (typeof email !== 'string' || !email.includes('@')) {
      json(res, { error: 'Valid email required.' }, 400)
      return true
    }
    if (typeof password !== 'string' || password.length < 8) {
      json(res, { error: 'Password must be at least 8 characters.' }, 400)
      return true
    }
    const r = role === 'admin' ? 'admin' : 'user'
    try {
      const user = await registerUser(email, password, r)
      json(res, { id: user.id, email: user.email, role: user.role, active: true, created_at: user.created_at }, 201)
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('UNIQUE') ? 'Email already exists.' : 'Failed to create user.'
      json(res, { error: msg }, 409)
    }
    return true
  }

  // PATCH /api/user-management/users/:id
  const patchMatch = path.match(/^\/api\/user-management\/users\/(\d+)$/)
  if (patchMatch && method === 'PATCH') {
    const id = parseInt(patchMatch[1], 10)
    const existing = getDashboardUserById(id)
    if (!existing) { json(res, { error: 'User not found.' }, 404); return true }
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 4096 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const fields: { role?: 'admin' | 'user'; active?: boolean; passwordHash?: string } = {}
    if (body.role === 'admin' || body.role === 'user') fields.role = body.role
    if (typeof body.active === 'boolean') fields.active = body.active
    if (typeof body.password === 'string' && body.password.length >= 8) {
      fields.passwordHash = await hashPassword(body.password as string)
    }
    updateDashboardUser(id, fields)
    json(res, { ok: true })
    return true
  }

  // DELETE /api/user-management/users/:id
  const deleteMatch = path.match(/^\/api\/user-management\/users\/(\d+)$/)
  if (deleteMatch && method === 'DELETE') {
    const id = parseInt(deleteMatch[1], 10)
    if (id === admin.id) {
      json(res, { error: 'Cannot delete your own account.' }, 400)
      return true
    }
    const ok = deleteDashboardUser(id)
    if (!ok) { json(res, { error: 'User not found.' }, 404); return true }
    json(res, { ok: true })
    return true
  }

  return false
}
