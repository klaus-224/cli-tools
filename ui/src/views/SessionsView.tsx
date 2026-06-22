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
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Session List Sidebar */}
      <div className="w-80 border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">Recent Sessions</h2>
          <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            {stats.sessionCount} TOTAL
          </span>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-outline-variant">
          <SessionFilters query={query} onChange={setQuery} onClear={clearFilters} />
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <SessionList
            sessions={sessions}
            activeSessionId={selectedSessionId}
            loading={loadingSessions}
            error={sessionsError}
            onSelect={selectSession}
          />
        </div>
      </div>

      {/* Transcript / Chat Area */}
      <div className="flex-1 flex flex-col relative bg-surface-dim overflow-hidden">
        <TranscriptPane
          session={selectedSession}
          messages={messages}
          loading={loadingTranscript}
          error={transcriptError}
        />
      </div>

      {/* Inspector Panel (Right) */}
      {selectedSession && (
        <aside className="w-72 border-l border-outline-variant bg-surface-container-low shrink-0 hidden xl:flex flex-col p-4 overflow-y-auto custom-scrollbar">
          <h3 className="font-[Geist] text-xs font-semibold tracking-wider text-outline mb-4 uppercase">
            Inspector: Session State
          </h3>
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-bold text-on-surface mb-2">Session Info</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center font-mono text-[13px]">
                  <span className="text-outline">Agent</span>
                  <span className="text-on-surface">{selectedSession.agent ?? 'unknown'}</span>
                </div>
                <div className="flex justify-between items-center font-mono text-[13px]">
                  <span className="text-outline">Model</span>
                  <span className="text-on-surface">{selectedSession.model ?? 'unknown'}</span>
                </div>
                <div className="flex justify-between items-center font-mono text-[13px]">
                  <span className="text-outline">Directory</span>
                  <span className="text-on-surface truncate ml-2 max-w-[140px]" title={selectedSession.directory ?? ''}>
                    {selectedSession.directory ?? 'unknown'}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-bold text-on-surface mb-2">Statistics</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-lowest p-2 rounded border border-outline-variant/20">
                  <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-outline uppercase">Messages</div>
                  <div className="font-mono text-[13px] text-primary">{messages.length}</div>
                </div>
                <div className="bg-surface-container-lowest p-2 rounded border border-outline-variant/20">
                  <div className="font-[Geist] text-[10px] font-semibold tracking-wider text-outline uppercase">Cost</div>
                  <div className="font-mono text-[13px] text-secondary">
                    {selectedSession.cost ? `$${selectedSession.cost}` : '--'}
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-outline-variant/30 pt-4">
              <h4 className="text-sm font-bold text-on-surface mb-3">Session Meta</h4>
              <div className="space-y-2 text-[11px] font-mono text-outline">
                <div className="bg-surface-container-lowest px-2 py-1.5 rounded break-all">
                  ID: {selectedSession.id}
                </div>
                {selectedSession.time_created && (
                  <div>Created: {selectedSession.time_created}</div>
                )}
                {selectedSession.time_updated && (
                  <div>Updated: {selectedSession.time_updated}</div>
                )}
              </div>
            </section>
          </div>
        </aside>
      )}
    </div>
  )
}
