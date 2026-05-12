import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { loadOrCreateDashboardToken } from './dashboard-auth.js'

// Derive a 32-byte AES key from the dashboard token (or VAULT_ENCRYPTION_KEY
// env var). scrypt adds cost so brute-forcing the DB ciphertext is expensive
// even if an attacker gets the raw DB file without the key material.
let _key: Buffer | null = null
function getKey(): Buffer {
  if (_key) return _key
  const raw = process.env['VAULT_ENCRYPTION_KEY']?.trim() || loadOrCreateDashboardToken()
  _key = scryptSync(raw, 'marveen-vault-v1', 32)
  return _key
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()])
  return dec.toString('utf8')
}
