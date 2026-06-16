import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSessions, fetchTranscript } from './api'
import { normalizeMessages } from './transcriptNormalizer'
import type { QueryState, SessionSummary, TranscriptMessage } from '../types'
import { formatRelative } from './formatters'

const DEFAULT_QUERY: QueryState = {
  session_id: '',
  agent: '',
  directory: '',
  limit: 200,
}

const readQueryFromLocation = (): Partial<QueryState> => {
  const params = new URLSearchParams(window.location.search)
  return {
    session_id: params.get('session_id') ?? '',
    agent: params.get('agent') ?? '',
    directory: params.get('directory') ?? '',
  }
}

export const useSessionBrowser = () => {
  const [query, setQueryState] = useState<QueryState>({ ...DEFAULT_QUERY, ...readQueryFromLocation() })
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => new URLSearchParams(window.location.search).get('sessionId') ?? '')
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const firstLoadRef = useRef(true)

  const setQuery = (next: Partial<QueryState>) => {
    setQueryState((current) => ({ ...current, ...next }))
  }

  const clearFilters = () => {
    setQueryState(DEFAULT_QUERY)
    const params = new URLSearchParams(window.location.search)
    params.delete('session_id')
    params.delete('agent')
    params.delete('directory')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`.replace(/\?$/, ''))
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      if (query.session_id) params.set('session_id', query.session_id)
      else params.delete('session_id')
      if (query.agent) params.set('agent', query.agent)
      else params.delete('agent')
      if (query.directory) params.set('directory', query.directory)
      else params.delete('directory')
      if (selectedSessionId) params.set('sessionId', selectedSessionId)
      else params.delete('sessionId')
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`.replace(/\?$/, ''))

      setLoadingSessions(true)
      fetchSessions(query)
        .then((nextSessions) => {
          setSessions(nextSessions)
          setSessionsError(null)
          if (!selectedSessionId && nextSessions[0]?.id) {
            setSelectedSessionId(nextSessions[0].id)
          }
        })
        .catch((error) => setSessionsError(error instanceof Error ? error.message : 'Failed to load sessions'))
        .finally(() => setLoadingSessions(false))
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    if (!firstLoadRef.current) return
    firstLoadRef.current = false
    const params = new URLSearchParams(window.location.search)
    if (selectedSessionId) params.set('sessionId', selectedSessionId)
    else params.delete('sessionId')
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`.replace(/\?$/, ''))
  }, [selectedSessionId])

  useEffect(() => {
    if (!selectedSessionId) return
    setLoadingTranscript(true)
    setTranscriptError(null)
      fetchTranscript(selectedSessionId)
        .then((payload) => {
          setMessages(payload.session_messages ?? [])
          if (payload.session?.id && payload.session.id !== selectedSessionId) {
            setSelectedSessionId(payload.session.id)
          }
        })
      .catch((error) => {
        setMessages([])
        setTranscriptError(error instanceof Error ? error.message : 'Failed to load transcript')
      })
      .finally(() => setLoadingTranscript(false))
  }, [selectedSessionId])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  )

  const stats = useMemo(() => ({
    sessionCount: sessions.length,
    filteredCount: sessions.length,
    latestLabel: sessions[0] ? `Latest ${formatRelative(sessions[0].time_updated ?? sessions[0].time_created)}` : 'No sessions',
    lastErrorLabel: sessionsError ? 'Adapter error' : 'Adapter ready',
  }), [sessions, sessionsError])

  return {
    query,
    setQuery,
    sessions,
    selectedSessionId,
    selectedSession,
    messages: normalizeMessages(messages),
    loadingSessions,
    loadingTranscript,
    sessionsError,
    transcriptError,
    stats,
    selectSession: setSelectedSessionId,
    clearFilters,
  }
}
