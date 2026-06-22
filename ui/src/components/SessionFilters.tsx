import type { QueryState } from '../types'

type Props = {
  query: QueryState
  onChange: (next: Partial<QueryState>) => void
  onClear: () => void
}

export const SessionFilters = ({ query, onChange, onClear }: Props) => (
  <div className="filters">
    <label>
      <span>Session id</span>
      <input value={query.session_id} onChange={(event) => onChange({ session_id: event.target.value })} placeholder="prefix or exact id" />
    </label>
    <label>
      <span>Agent</span>
      <input value={query.agent} onChange={(event) => onChange({ agent: event.target.value })} placeholder="partial match" />
    </label>
    <label>
      <span>Directory</span>
      <input value={query.directory} onChange={(event) => onChange({ directory: event.target.value })} placeholder="partial match" />
    </label>
    <button type="button" className="ghost-button" onClick={onClear}>Clear filters</button>
  </div>
)
