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
    return <div className="pane-state">Select a session to inspect its transcript.</div>
  }

  return (
    <div className="transcript-pane">
      <header className="transcript-header">
        <div>
          <div className="eyebrow">Selected session</div>
          <h2>{session.title}</h2>
        </div>
        <div className="transcript-header__meta">
          <div>{session.id}</div>
          <div>{session.agent ?? 'unknown agent'}</div>
          <div>{session.directory ?? 'unknown directory'}</div>
          <div>{formatTimestamp(session.time_created)}</div>
          <div>{formatTimestamp(session.time_updated)}</div>
        </div>
      </header>

      <div className="transcript-body">
        {loading && <div className="pane-state">Loading transcript…</div>}
        {!loading && error && <div className="error-state">{error}</div>}
        {!loading && !error && messages.length === 0 && <div className="empty-state">No messages for this session.</div>}
        {!loading && !error && messages.map((message) => <TranscriptMessage key={message.messageId} message={message} />)}
      </div>
    </div>
  )
}
