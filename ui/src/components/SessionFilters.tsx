import type { QueryState } from '../types'

type Props = {
  query: QueryState
  onChange: (next: Partial<QueryState>) => void
  onClear: () => void
}

export const SessionFilters = ({ query, onChange, onClear }: Props) => (
  <div className="space-y-2">
    <input
      value={query.session_id}
      onChange={(event) => onChange({ session_id: event.target.value })}
      placeholder="Filter by session id..."
      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none placeholder:text-outline"
    />
    <div className="flex gap-2">
      <input
        value={query.agent}
        onChange={(event) => onChange({ agent: event.target.value })}
        placeholder="Agent"
        className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none placeholder:text-outline"
      />
      <button
        type="button"
        onClick={onClear}
        className="bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-surface-container-highest transition-all border border-outline-variant/30"
      >
        Clear
      </button>
    </div>
  </div>
)
