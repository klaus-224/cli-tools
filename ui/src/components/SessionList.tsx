import type { SessionSummary } from '../types'
import { SessionRow } from './SessionRow'

type Props = {
  sessions: SessionSummary[]
  activeSessionId: string
  loading: boolean
  error: string | null
  onSelect: (id: string) => void
}

export const SessionList = ({ sessions, activeSessionId, loading, error, onSelect }: Props) => (
  <div className="session-list">
    {loading && <div className="empty-state">Loading sessions…</div>}
    {!loading && error && <div className="error-state">{error}</div>}
    {!loading && !error && sessions.length === 0 && <div className="empty-state">No sessions found.</div>}
    {!loading && !error && sessions.map((session) => (
      <SessionRow key={session.id} session={session} active={session.id === activeSessionId} onSelect={onSelect} />
    ))}
  </div>
)
