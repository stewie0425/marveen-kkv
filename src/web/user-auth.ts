import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  createDashboardUser,
  getDashboardUserByEmail,
  getUserBySession,
  createUserSession,
  deleteUserSession,
  type DashboardUser,
} from '../db.js'

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function registerUser(
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user',
): Promise<DashboardUser> {
  const hash = await hashPassword(password)
  return createDashboardUser(email, hash, role)
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: DashboardUser; token: string } | null> {
  const user = getDashboardUserByEmail(email)
  if (!user) return null
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return null
  const token = randomBytes(32).toString('hex')
  createUserSession(user.id, token)
  return { user, token }
}

export function getUserFromToken(token: string): DashboardUser | undefined {
  return getUserBySession(token)
}

export function logoutUser(token: string): void {
  deleteUserSession(token)
}

export function extractUserSessionToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const m = /^Bearer\s+(.+)$/.exec(authHeader)
  return m ? m[1].trim() : null
}
