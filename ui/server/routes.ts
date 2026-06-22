import type { IncomingMessage, ServerResponse } from 'node:http'
import { queryMemories, getMemoryStats } from './agentMemoryAdapter'
import { normalizeSearch } from './normalize'
import {
  listDependencies,
  listEntrypoints,
  listFiles,
  listModules,
  listRepositories,
  listTestIds,
  runRawQuery,
  searchIndex,
} from './projectIndexAdapter'
import { readSessions, readTranscript } from './sessionReaderAdapter'
import { readUrl, sendError, sendJson } from './http'

const coerceLimit = (value: string | null | undefined): number => {
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

    if (url.pathname === '/api/memory') {
      const searchParams = getQuery(req)
      if (!searchParams) {
        sendError(res, 400, 'Missing query parameters')
        return true
      }

      const memories = await queryMemories({
        category: normalizeSearch(searchParams.get('category') ?? null),
        tags: normalizeSearch(searchParams.get('tags') ?? null),
        search: normalizeSearch(searchParams.get('search') ?? null),
        recent: searchParams.get('recent') ? Number(searchParams.get('recent')) : undefined,
        limit: coerceLimit(searchParams.get('limit') ?? null),
      })
      sendJson(res, 200, { memories })
      return true
    }

    if (url.pathname === '/api/memory/stats') {
      sendJson(res, 200, await getMemoryStats())
      return true
    }

    if (url.pathname === '/api/index/repositories') {
      sendJson(res, 200, { repositories: await listRepositories() })
      return true
    }

    if (url.pathname === '/api/index/files') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      if (!repo) {
        sendError(res, 400, 'Missing repo')
        return true
      }
      sendJson(res, 200, { files: await listFiles(repo, coerceLimit(searchParams?.get('limit') ?? null)) })
      return true
    }

    if (url.pathname === '/api/index/modules') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      if (!repo) {
        sendError(res, 400, 'Missing repo')
        return true
      }
      sendJson(res, 200, { modules: await listModules(repo) })
      return true
    }

    if (url.pathname === '/api/index/dependencies') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      if (!repo) {
        sendError(res, 400, 'Missing repo')
        return true
      }
      sendJson(res, 200, { dependencies: await listDependencies(repo) })
      return true
    }

    if (url.pathname === '/api/index/entrypoints') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      if (!repo) {
        sendError(res, 400, 'Missing repo')
        return true
      }
      sendJson(res, 200, { entrypoints: await listEntrypoints(repo) })
      return true
    }

    if (url.pathname === '/api/index/testids') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      if (!repo) {
        sendError(res, 400, 'Missing repo')
        return true
      }
      sendJson(res, 200, { testids: await listTestIds(repo) })
      return true
    }

    if (url.pathname === '/api/index/search') {
      const searchParams = getQuery(req)
      const repo = normalizeSearch(searchParams?.get('repo') ?? null)
      const query = normalizeSearch(searchParams?.get('q') ?? null)
      if (!repo || !query) {
        sendError(res, 400, 'Missing repo or query')
        return true
      }
      sendJson(res, 200, {
        results: await searchIndex(repo, query, coerceLimit(searchParams?.get('limit') ?? null)),
      })
      return true
    }

    if (url.pathname === '/api/index/query') {
      const searchParams = getQuery(req)
      const sql = normalizeSearch(searchParams?.get('sql') ?? null)
      if (!sql) {
        sendError(res, 400, 'Missing SQL')
        return true
      }
      sendJson(res, 200, { rows: await runRawQuery(sql) })
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
