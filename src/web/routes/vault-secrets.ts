import { listVaultSecrets, getVaultSecret, upsertVaultSecret, deleteVaultSecret } from '../../db.js'
import { encrypt, decrypt } from '../vault-crypto.js'
import { readBody, json } from '../http-helpers.js'
import { checkBearerToken } from '../dashboard-auth.js'
import type { RouteHandler } from './types.js'

// Admin-bearer-token protected vault secrets store.
// GET    /api/vault-secrets          — list (no values, only metadata)
// GET    /api/vault-secrets/:key     — get decrypted value
// POST   /api/vault-secrets          — create/update { key, value, description? }
// DELETE /api/vault-secrets/:key     — delete

// The DASHBOARD_TOKEN is passed in from web.ts via the routeCtx extension.
// We re-derive it here the same way the main auth gate does.
import { loadOrCreateDashboardToken } from '../dashboard-auth.js'
const DASHBOARD_TOKEN = loadOrCreateDashboardToken()

function isAdmin(authHeader: string | undefined): boolean {
  return checkBearerToken(authHeader, DASHBOARD_TOKEN)
}

function validateKey(k: string): boolean {
  return /^[a-zA-Z0-9_.\-/]{1,128}$/.test(k)
}

export const tryHandleVaultSecrets: RouteHandler = async ({ req, res, path, method }) => {
  if (!path.startsWith('/api/vault-secrets')) return false

  if (!isAdmin(req.headers.authorization)) {
    json(res, { error: 'Unauthorized.' }, 401)
    return true
  }

  // List
  if (path === '/api/vault-secrets' && method === 'GET') {
    json(res, listVaultSecrets())
    return true
  }

  // Get single (decrypted)
  const keyMatch = path.match(/^\/api\/vault-secrets\/(.+)$/)

  if (keyMatch && method === 'GET') {
    const keyName = decodeURIComponent(keyMatch[1])
    const row = getVaultSecret(keyName)
    if (!row) { json(res, { error: 'Not found.' }, 404); return true }
    try {
      const value = decrypt(row.encrypted_value, row.iv, row.tag)
      json(res, {
        key: row.key_name,
        value,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
    } catch {
      json(res, { error: 'Decryption failed.' }, 500)
    }
    return true
  }

  // Create / update
  if (path === '/api/vault-secrets' && method === 'POST') {
    let body: Record<string, unknown>
    try {
      const raw = await readBody(req, { maxBytes: 65536 })
      body = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON.' }, 400)
      return true
    }
    const { key, value, description } = body
    if (typeof key !== 'string' || !validateKey(key)) {
      json(res, { error: 'Invalid key. Use letters, digits, _, ., -, / (max 128 chars).' }, 400)
      return true
    }
    if (typeof value !== 'string') {
      json(res, { error: 'Value must be a string.' }, 400)
      return true
    }
    const { ciphertext, iv, tag } = encrypt(value)
    upsertVaultSecret(key, ciphertext, iv, tag, typeof description === 'string' ? description : null)
    json(res, { ok: true, key })
    return true
  }

  // Delete
  if (keyMatch && method === 'DELETE') {
    const keyName = decodeURIComponent(keyMatch[1])
    const ok = deleteVaultSecret(keyName)
    if (!ok) { json(res, { error: 'Not found.' }, 404); return true }
    json(res, { ok: true })
    return true
  }

  return false
}
