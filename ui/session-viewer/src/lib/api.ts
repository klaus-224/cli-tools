import type { QueryState, SessionSummary, TranscriptPayload } from '../types'

type SessionsResponse = { sessions: SessionSummary[] }

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string; details?: unknown } } | null
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`)
  }
  return (await response.json()) as T
}

export const fetchSessions = async (query: QueryState): Promise<SessionSummary[]> => {
  const params = new URLSearchParams()
  if (query.session_id.trim()) params.set('session_id', query.session_id.trim())
  if (query.agent.trim()) params.set('agent', query.agent.trim())
  if (query.directory.trim()) params.set('directory', query.directory.trim())
  params.set('limit', String(query.limit))

  const response = await fetch(`/api/sessions?${params.toString()}`)
  const payload = await readJson<SessionsResponse>(response)
  return payload.sessions ?? []
}

export const fetchTranscript = async (sessionId: string): Promise<TranscriptPayload> => {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
  return readJson<TranscriptPayload>(response)
}
