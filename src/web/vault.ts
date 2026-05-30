import { getVaultSecret } from '../db.js'
import { decrypt } from './vault-crypto.js'

export function getSecret(keyName: string): string | null {
  const row = getVaultSecret(keyName)
  if (!row) return null
  try {
    return decrypt(row.encrypted_value, row.iv, row.tag)
  } catch {
    return null
  }
}
