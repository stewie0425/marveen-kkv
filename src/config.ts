import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEnvFile } from './env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const PROJECT_ROOT = join(__dirname, '..')
export const STORE_DIR = join(PROJECT_ROOT, 'store')

const env = readEnvFile()

export const TELEGRAM_BOT_TOKEN = env['TELEGRAM_BOT_TOKEN'] ?? ''
export const ALLOWED_CHAT_ID = env['ALLOWED_CHAT_ID'] ?? ''

export const OWNER_NAME = env['OWNER_NAME'] ?? 'Admin'
export const BOT_NAME = env['BOT_NAME'] ?? 'Marveen'

// Canonical identifier for the main agent in the DB, tmux sessions, plist
// labels, API routing, etc. The installer derives this from BOT_NAME
// (NFKD + ASCII + lowercase dashes). Older installs without this env var
// fall back to "marveen" so nothing breaks when upgrading in place.
export const MAIN_AGENT_ID = env['MAIN_AGENT_ID'] ?? 'marveen'

export const WEB_PORT = parseInt(env['WEB_PORT'] ?? '3420', 10)

export const WEB_HOST = env['WEB_HOST'] ?? '127.0.0.1'
export const OLLAMA_URL = env['OLLAMA_URL'] ?? 'http://localhost:11434'

// Memory backend selection. 'sqlite' keeps the in-process better-sqlite3 store
// (current default, zero external dependency). 'rag' routes hot/warm/shared
// to the marveen-rag service (PostgreSQL+pgvector) and cold to its vault
// (Obsidian + git). Switch is opt-in until the service is confirmed live.
export const MEMORY_BACKEND = (env['MARVEEN_MEMORY_BACKEND'] ?? 'sqlite').toLowerCase()
export const RAG_URL = env['MARVEEN_RAG_URL'] ?? 'http://localhost:8088'
export const RAG_TOKEN = env['MARVEEN_RAG_TOKEN'] ?? ''

// Heartbeat
export const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
export const HEARTBEAT_START_HOUR = 9
export const HEARTBEAT_END_HOUR = 23

// Outbound mail (alerts only). Marveen sends through Kevin's Gmail via SMTP
// + a 16-char Google App Password. Reads-side is not exposed here — Tracy
// owns inbox search through her own MCPs.
export const SMTP_HOST = env['SMTP_HOST'] ?? 'smtp.gmail.com'
export const SMTP_PORT = parseInt(env['SMTP_PORT'] ?? '587', 10)
export const SMTP_USER = env['SMTP_USER'] ?? ''
export const SMTP_PASSWORD = env['SMTP_PASSWORD'] ?? ''
