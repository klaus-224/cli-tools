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
  <div className="divide-y divide-outline-variant/30">
    {loading && (
      <div className="p-4 text-center text-sm text-outline">Loading sessions...</div>
    )}
    {!loading && error && (
      <div className="p-4 text-center text-sm text-error">{error}</div>
    )}
    {!loading && !error && sessions.length === 0 && (
      <div className="p-4 text-center text-sm text-outline">No sessions found.</div>
    )}
    {!loading && !error && sessions.map((session) => (
      <SessionRow
        key={session.id}
        session={session}
        active={session.id === activeSessionId}
        onSelect={onSelect}
      />
    ))}
  </div>
)
