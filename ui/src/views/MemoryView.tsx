import { useEffect } from 'react'
import { useMemoryBrowser } from '../lib/useMemoryBrowser'

export const MemoryView = () => {
  const { query, setQuery, memories, stats, loading, error, categoryOptions } = useMemoryBrowser()

  useEffect(() => {
    document.title = 'Agent memory'
  }, [])

  return (
    <div className="view-shell">
      <header className="view-header">
        <div>
          <div className="eyebrow">Agent memory</div>
          <h1>Memory database</h1>
          <p className="muted">Read-only browse of stored learnings and notes.</p>
        </div>
        <div className="view-header__meta">
          <span>{stats?.total ?? 0} entries</span>
          <span>{Object.keys(stats?.byCategory ?? {}).length} categories</span>
        </div>
      </header>

      <section className="view-toolbar">
        <input value={query.search ?? ''} onChange={(event) => setQuery({ search: event.target.value })} placeholder="Search summaries and detail" />
        <input value={query.tags ?? ''} onChange={(event) => setQuery({ tags: event.target.value })} placeholder="Filter tags" />
        <select value={query.category ?? ''} onChange={(event) => setQuery({ category: event.target.value })}>
          <option value="">All categories</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </section>

      <section className="view-body">
        {loading && <div className="empty-state">Loading memory entries…</div>}
        {!loading && error && <div className="error-state">{error}</div>}
        {!loading && !error && memories.length === 0 && <div className="empty-state">No memory entries found.</div>}
        {!loading && !error && memories.map((entry) => (
          <article key={entry.id} className="card">
            <div className="card__header">
              <strong>{entry.summary}</strong>
              <span className="card__pill">{entry.category}</span>
            </div>
            {entry.detail && <p>{entry.detail}</p>}
            <div className="card__meta">
              <span>{entry.created_at}</span>
              <span>{entry.agent ?? 'unknown agent'}</span>
              <span>{entry.plan_id ?? 'no plan id'}</span>
            </div>
            <div className="tag-row">{(entry.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>
          </article>
        ))}
      </section>
    </div>
  )
}
