import type { NormalizedMessage, SessionSummary } from '../types'
import { formatTimestamp } from '../lib/formatters'
import { TranscriptMessage } from './TranscriptMessage'

type Props = {
  session: SessionSummary | null
  messages: NormalizedMessage[]
  loading: boolean
  error: string | null
}

export const TranscriptPane = ({ session, messages, loading, error }: Props) => {
  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <span className="material-symbols-outlined text-outline text-[48px]">chat_bubble_outline</span>
          <p className="text-on-surface-variant text-sm">Select a session to inspect its transcript.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Metadata Header */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-low/50 backdrop-blur-md shrink-0">
        <h1 className="text-2xl font-bold text-on-surface">{session.title}</h1>
        <div className="flex gap-4 mt-1 font-mono text-[11px] text-outline">
          {session.time_created && <span>Started: {formatTimestamp(session.time_created)}</span>}
          {session.model && <span>Model: {session.model}</span>}
          {session.agent && <span>Agent: {session.agent}</span>}
        </div>
      </div>

      {/* Chat Transcript */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {loading && (
          <div className="flex justify-center py-8">
            <span className="text-outline text-sm">Loading transcript...</span>
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-8 text-error text-sm">{error}</div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="text-center py-8 text-outline text-sm">No messages for this session.</div>
        )}
        {!loading && !error && messages.map((message) => (
          <TranscriptMessage key={message.messageId} message={message} />
        ))}
      </div>
    </div>
  )
}
