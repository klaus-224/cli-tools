import type { SessionSummary } from '../types'
import { compactText, formatRelative } from '../lib/formatters'

type Props = {
  session: SessionSummary
  active: boolean
  onSelect: (id: string) => void
}

export const SessionRow = ({ session, active, onSelect }: Props) => (
  <button
    type="button"
    className={`w-full text-left p-4 cursor-pointer transition-all ${
      active
        ? 'border-l-4 border-l-primary bg-primary/5'
        : 'border-l-4 border-l-transparent hover:bg-surface-container-low'
    }`}
    onClick={() => onSelect(session.id)}
  >
    <div className="flex justify-between items-start mb-1">
      <span className={`font-mono text-[13px] font-bold ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
        {compactText(session.id)}
      </span>
      <span className="font-mono text-[11px] text-outline">
        {formatRelative(session.time_updated ?? session.time_created)}
      </span>
    </div>
    <p className="text-sm text-on-surface truncate">{session.title}</p>
    <div className="mt-2 flex gap-2 flex-wrap">
      {session.agent && (
        <span className="font-[Geist] text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase">
          {session.agent}
        </span>
      )}
      {active && (
        <span className="font-[Geist] text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container uppercase">
          Active
        </span>
      )}
    </div>
  </button>
)
