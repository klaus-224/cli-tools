import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeSearch } from './normalize'
import { readSessions, readTranscript } from './sessionReaderAdapter'
import { readUrl, sendError, sendJson } from './http'

const coerceLimit = (value: string | null): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 200
  return Math.min(Math.trunc(parsed), 1000)
}

const getQuery = (req: IncomingMessage) => {
  const url = readUrl(req)
  if (!url) return null
  return url.searchParams
}

export const handleApiRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = readUrl(req)
  if (!url || !url.pathname.startsWith('/api/')) return false

  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed')
    return true
  }

  try {
    if (url.pathname === '/api/sessions') {
      const searchParams = getQuery(req)
      if (!searchParams) {
        sendError(res, 400, 'Missing query parameters')
        return true
      }

      const payload = {
        session_id: normalizeSearch(searchParams.get('session_id')),
        agent: normalizeSearch(searchParams.get('agent')),
        directory: normalizeSearch(searchParams.get('directory')),
        limit: coerceLimit(searchParams.get('limit')),
      }

      const sessions = await readSessions(payload)
      sendJson(res, 200, {
        sessions: sessions
          .slice()
          .sort((a, b) => {
            const aTime = a.time_updated ?? a.time_created ?? ''
            const bTime = b.time_updated ?? b.time_created ?? ''
            return bTime.localeCompare(aTime)
          })
          .slice(0, payload.limit),
      })
      return true
    }

    const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/)
    if (transcriptMatch) {
      const sessionId = decodeURIComponent(transcriptMatch[1])
      if (!sessionId.trim()) {
        sendError(res, 400, 'Missing session id')
        return true
      }

      const transcript = await readTranscript(sessionId.trim())
      sendJson(res, 200, transcript)
      return true
    }

    sendError(res, 404, 'Not found')
    return true
  } catch (error) {
    sendError(res, 502, error instanceof Error ? error.message : 'Adapter failure', error)
    return true
  }
}
