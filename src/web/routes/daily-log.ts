import { getMemoryBackend } from '../../memory/backend.js'
import { MAIN_AGENT_ID } from '../../config.js'
import { readBody, json } from '../http-helpers.js'
import type { RouteContext } from './types.js'

export async function tryHandleDailyLog(ctx: RouteContext): Promise<boolean> {
  const { req, res, path, method, url } = ctx

  if (path === '/api/daily-log' && method === 'POST') {
    const body = await readBody(req)
    const data = JSON.parse(body.toString()) as { agent_id?: string; content: string }
    if (!data.content?.trim()) { json(res, { error: 'Content required' }, 400); return true }
    const backend = await getMemoryBackend()
    await backend.appendDailyLog(data.agent_id || MAIN_AGENT_ID, data.content.trim())
    json(res, { ok: true })
    return true
  }

  if (path === '/api/daily-log' && method === 'GET') {
    const agent = url.searchParams.get('agent') || MAIN_AGENT_ID
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]
    const backend = await getMemoryBackend()
    json(res, await backend.getDailyLog(agent, date))
    return true
  }

  if (path === '/api/daily-log/dates' && method === 'GET') {
    const agent = url.searchParams.get('agent') || MAIN_AGENT_ID
    const backend = await getMemoryBackend()
    json(res, await backend.getDailyLogDates(agent))
    return true
  }

  return false
}
