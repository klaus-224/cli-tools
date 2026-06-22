import type { SessionSummary } from '../types'
import { compactText, formatRelative } from '../lib/formatters'

type Props = {
  session: SessionSummary
  active: boolean
  onSelect: (id: string) => void
}

export const SessionRow = ({ session, active, onSelect }: Props) => (
  <button type="button" className={`session-row${active ? ' session-row--active' : ''}`} onClick={() => onSelect(session.id)}>
    <div className="session-row__title">{session.title}</div>
    <div className="session-row__meta">
      <span>{session.agent ?? 'unknown agent'}</span>
      <span>{session.directory ?? 'unknown directory'}</span>
      <span>{formatRelative(session.time_updated ?? session.time_created)}</span>
    </div>
    <div className="session-row__id" title={session.id}>{compactText(session.id)}</div>
  </button>
)
