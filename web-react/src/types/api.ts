// Shape returned by GET /api/sessions. Mirrors the contract defined in
// src/web.ts; keep these in sync if the backend payload evolves.
export type PaneState = 'idle' | 'busy' | 'typing' | 'unknown'

export type SessionRole = 'main' | 'sub'

export interface SessionInfo {
  name: string
  displayName: string
  avatar: string
  role: SessionRole
  running: boolean
  paneState: PaneState | null
  sinceMs: number | null
  busyForMs: number | null
  preview: string[]
}

export interface SessionsResponse {
  sessions: SessionInfo[]
}

// --- Overview (GET /api/overview) ---

export interface OverviewAgents {
  total: number
  running: number
}

export interface OverviewMemories {
  count: number
  categories: number
}

export interface OverviewSkills {
  count: number
  today: number
}

export interface OverviewTeamMember {
  id: string
  label: string
  role: 'main' | 'member' | string
  running: boolean
  hasAvatar: boolean
  avatarUrl: string
}

export interface OverviewActivity {
  icon: 'delegate' | 'memory' | string
  text: string
  at: number
}

export interface OverviewResponse {
  agents: OverviewAgents
  tasksToday: number
  tasksYesterday: number
  memories: OverviewMemories
  skills: OverviewSkills
  team: OverviewTeamMember[]
  activity: OverviewActivity[]
}

// --- Status (GET /api/status) ---

export type IncidentStatus =
  | 'resolved'
  | 'monitoring'
  | 'identified'
  | 'investigating'
  | string

export interface Incident {
  title: string
  description: string
  pubDate: string
  link: string
  status: IncidentStatus
}

export type OverallStatus = 'operational' | 'degraded' | 'unknown' | string

export interface StatusResponse {
  overall: OverallStatus
  incidents: Incident[]
}

// --- Agents (GET /api/agents, GET /api/agents/:name, POST/PUT/DELETE) ---

export interface AgentTeam {
  role: 'main' | 'leader' | 'member' | string
  reportsTo: string | null
  delegatesTo: string[]
  autoDelegation: boolean
  trustFrom: string[]
}

export interface AgentSummary {
  name: string
  displayName: string
  description: string
  model: string
  securityProfile: string
  team: AgentTeam
  hasTelegram: boolean
  status: string
  running: boolean
  session?: string
  hasAvatar: boolean
}

export interface AgentDetail extends AgentSummary {
  telegramBotUsername?: string
  claudeMd?: string
  soulMd?: string
  mcpJson?: string
  skills?: unknown[]
}

export interface MarveenInfo {
  name: string
  description: string
  model: string
  running: boolean
  hasTelegram: boolean
  telegramBotUsername?: string
  role: string
  personality?: string
  claudeMd?: string
  soulMd?: string
  mcpJson?: string
  readonly: boolean
}

export interface SecurityProfile {
  id: string
  label: string
  description: string
  permissionMode: string
  allowCount: number
  denyCount: number
}

// --- Team graph (GET /api/team/graph) ---

export interface TeamNode {
  id: string
  label: string
  role: 'main' | 'leader' | 'member' | string
  reportsTo: string | null
  delegatesTo: string[]
  running: boolean
  securityProfile?: string
}

export interface TeamEdge {
  from: string
  to: string
}

export interface TeamGraphResponse {
  nodes: TeamNode[]
  edges: TeamEdge[]
  mainAgentId?: string
}

// --- Kanban (GET /api/kanban, GET /api/kanban/assignees, etc.) ---

export type KanbanStatus = 'planned' | 'in_progress' | 'waiting' | 'done'
export type KanbanPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface KanbanCard {
  id: string | number
  title: string
  description?: string | null
  status: KanbanStatus
  priority: KanbanPriority
  assignee?: string | null
  due_date?: number | null
  sort_order: number
  archived?: boolean
}

export interface KanbanComment {
  id?: string | number
  author: string
  content: string
  created_at: number
}

export type AssigneeType = 'owner' | 'bot' | 'agent' | string

export interface Assignee {
  name: string
  type: AssigneeType
}

// --- Schedules (GET /api/schedules) ---

export type ScheduleType = 'task' | 'heartbeat' | string

export interface ScheduleTask {
  name: string
  description?: string
  prompt: string
  schedule: string
  agent: string
  type: ScheduleType
  enabled: boolean
  lastRun?: number | null
  nextRun?: number | null
}

export interface ScheduleAgent {
  name: string
  label: string
  avatar: string
}

export interface PendingRetry {
  id: string
  taskName: string
  agentName: string
  ageMs: number
  attemptCount: number
  lastReason?: string
  alertSentAt?: number | null
  alertDue?: boolean
}

// --- Memories (GET /api/memories, /api/memories/stats) ---

export type MemoryTier = 'hot' | 'warm' | 'cold' | 'shared'

export interface Memory {
  id: number | string
  agent_id: string
  content: string
  category: MemoryTier | string
  keywords?: string
  auto_generated?: boolean
  created_at: number
  accessed_at?: number
  topic_key?: string
  sector?: string
  salience?: number
  created_label?: string
  accessed_label?: string
}

export interface MemoryStats {
  total: number
  byAgent: Record<string, number>
  byTier: Record<string, number>
  withEmbedding?: number
}

// --- Daily Log (GET /api/daily-log) ---

export interface DailyLogEntry {
  id: number | string
  content: string
  created_at: number
}

// --- Vault / RAG documents (GET /api/vault/documents) ---
//
// Backend route owned by Steve; this is the contract David and Steve agreed
// on. The list endpoint returns { documents, total, limit, offset } where
// each row carries metadata + a short snippet, and the detail endpoint
// returns the full markdown body.

export interface VaultDocument {
  id: string
  agent_id: string
  title: string
  vault_path?: string | null
  keywords?: string[] | null
  snippet?: string
  created_at: number
  updated_at?: number
}

export interface VaultDocumentDetail extends VaultDocument {
  content: string
}

export interface VaultListResponse {
  documents: VaultDocument[]
  total: number
  limit: number
  offset: number
}

// --- Updates (GET /api/updates) ---

export interface UpdateCommit {
  sha: string
  short: string
  message: string
  author: string
  date: string
  files?: string[]
  components?: string[]
}

export interface UpdateStatus {
  current?: string
  latest?: string
  behind?: number
  remote?: string
  commits?: UpdateCommit[]
  components?: string[]
  error?: string
}

// --- Skills (GET /api/skills) ---

export interface Skill {
  name: string
  label: string
  description: string
  agents: string[]
  path: string
  source: string
}

// --- Connectors / MCP (GET /api/connectors, /api/mcp-catalog) ---

export interface Connector {
  name: string
  status: string
  endpoint: string
  type: string
  source: string
}

export interface ConnectorsStatus {
  claudeAvailable?: boolean
  ok?: boolean
  message?: string
}

export interface CatalogItem {
  id: string
  label: string
  description?: string
  installed?: boolean
  category?: string
  endpoint?: string
  homepage?: string
  source?: string
}

// --- Migrate (POST /api/migrate/scan, /api/migrate/run) ---

export interface MigrateFinding {
  type: string
  name: string
  size: number
  preview?: string
}

export interface MigrateScanResponse {
  findings: MigrateFinding[]
  summary: {
    total: number
    memory: number
    personality: number
    profile: number
    config: number
    heartbeat: number
  }
}

export interface MigrateRunResponse {
  imported: number
  stats: { hot: number; warm: number; cold: number; shared: number }
  details?: string[]
}

// --- Secrets registry (GET/POST/DELETE /api/secrets) ---
//
// The list endpoint never returns the value — only metadata. POST writes a
// new (or rotates an existing) secret to a target env file.

export interface SecretListItem {
  name: string
  target_env_path: string
  last_modified: number
  size: number
}

export interface SecretWriteRequest {
  name: string
  value: string
  target_env_path: string
}

export interface SecretWriteResponse {
  ok: boolean
  target: string
  size: number
}

// --- Obsidian Local REST API proxy (GET /api/obsidian/*) ---

export interface ObsidianTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: ObsidianTreeNode[]
}

export interface ObsidianTreeResponse {
  tree: ObsidianTreeNode[]
}

export interface ObsidianFileResponse {
  path: string
  content: string
  stat: { ctime: number; mtime: number; size: number } | null
}

export interface ObsidianSearchResult {
  filename: string
  score?: number
  matches?: unknown[]
}

export interface ObsidianSearchResponse {
  results: ObsidianSearchResult[]
}
