import { useEffect, useMemo } from 'react'
import { SessionFilters } from '../components/SessionFilters'
import { SessionList } from '../components/SessionList'
import { TranscriptPane } from '../components/TranscriptPane'
import { useSessionBrowser } from '../lib/useSessionBrowser'

export const SessionsView = () => {
  const {
    query,
    setQuery,
    sessions,
    selectedSessionId,
    selectedSession,
    messages,
    loadingSessions,
    loadingTranscript,
    sessionsError,
    transcriptError,
    stats,
    selectSession,
    clearFilters,
  } = useSessionBrowser()

  const selectedSessionTitle = useMemo(() => selectedSession?.title ?? 'No session selected', [selectedSession])

  useEffect(() => {
    document.title = selectedSessionTitle
  }, [selectedSessionTitle])

  return (
    <div className="app-shell app-shell--sessions">
      <aside className="sidebar">
        <div className="sidebar__top">
          <div>
            <div className="eyebrow">Session Reviewer</div>
            <h1>Agent sessions</h1>
            <p className="muted">{stats.sessionCount} sessions, {stats.filteredCount} shown</p>
          </div>
          <div className="sidebar__stats">
            <span>{stats.latestLabel}</span>
            <span>{stats.lastErrorLabel}</span>
          </div>
        </div>

        <SessionFilters query={query} onChange={setQuery} onClear={clearFilters} />

        <SessionList sessions={sessions} activeSessionId={selectedSessionId} loading={loadingSessions} error={sessionsError} onSelect={selectSession} />
      </aside>

      <main className="transcript-shell">
        <TranscriptPane session={selectedSession} messages={messages} loading={loadingTranscript} error={transcriptError} />
      </main>
    </div>
  )
}
