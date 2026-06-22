import { useEffect } from 'react'
import { useMemoryBrowser } from '../lib/useMemoryBrowser'

export const MemoryView = () => {
  const { query, setQuery, memories, stats, loading, error, categoryOptions } = useMemoryBrowser()

  useEffect(() => {
    document.title = 'Memory Database | Agent Tool UI'
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-dim">
        <div className="max-w-[1200px] mx-auto p-8 space-y-4">
          {/* Header & Search */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-outline-variant">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Memory Database</h1>
            <div className="relative min-w-[280px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none placeholder:text-outline"
                placeholder="Search memories..."
                type="text"
                value={query.search ?? ''}
                onChange={(e) => setQuery({ search: e.target.value })}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <button
              className={`px-4 py-1 rounded-full font-[Geist] text-xs font-semibold tracking-wider whitespace-nowrap transition-all ${
                !query.category
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant'
              }`}
              onClick={() => setQuery({ category: '' })}
            >
              All
            </button>
            {categoryOptions.map((category) => (
              <button
                key={category}
                className={`px-4 py-1 rounded-full font-[Geist] text-xs font-semibold tracking-wider whitespace-nowrap transition-all ${
                  query.category === category
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant'
                }`}
                onClick={() => setQuery({ category })}
              >
                {category}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                value={query.tags ?? ''}
                onChange={(e) => setQuery({ tags: e.target.value })}
                placeholder="Filter tags..."
                className="bg-transparent border border-outline-variant rounded-lg px-3 py-1 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none placeholder:text-outline w-40"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading && (
              <div className="md:col-span-2 text-center py-12 text-outline text-sm">Loading memory entries...</div>
            )}
            {!loading && error && (
              <div className="md:col-span-2 text-center py-12 text-error text-sm">{error}</div>
            )}
            {!loading && !error && memories.length === 0 && (
              <div className="md:col-span-2 text-center py-12 text-outline text-sm">No memory entries found.</div>
            )}
            {!loading && !error && memories.map((entry) => (
              <div
                key={entry.id}
                className="glass-panel rounded-xl p-6 hover:border-primary/50 transition-all group flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="font-[Geist] text-xs font-semibold tracking-wider bg-secondary-container/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded uppercase">
                    {entry.category}
                  </span>
                  <span className="font-mono text-[11px] text-outline">#{entry.id}</span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-2 group-hover:text-primary transition-colors">
                  {entry.summary}
                </h3>
                {entry.detail && (
                  <p className="text-sm text-on-surface-variant mb-6 line-clamp-3">{entry.detail}</p>
                )}
                {entry.tags && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {entry.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                      <span
                        key={tag}
                        className="font-[Geist] text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-6 border-t border-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-sm">schedule</span>
                    <span className="font-mono text-[13px] text-outline">{entry.created_at}</span>
                  </div>
                  <span className="font-mono text-[13px] text-on-surface-variant">{entry.agent ?? 'unknown'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Database Metadata */}
      <aside className="hidden xl:flex flex-col w-80 bg-surface-container-lowest border-l border-outline-variant p-6 gap-6 overflow-y-auto custom-scrollbar shrink-0">
        <h2 className="font-[Geist] text-xs font-semibold tracking-wider text-primary border-b border-outline-variant pb-2 uppercase">
          Database Info
        </h2>
        {stats && (
          <div className="space-y-4">
            <div className="bg-surface-dim border border-outline-variant p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center font-mono text-[13px]">
                <span className="text-outline">Records</span>
                <span className="text-on-surface">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center font-mono text-[13px]">
                <span className="text-outline">Categories</span>
                <span className="text-on-surface">{Object.keys(stats.byCategory).length}</span>
              </div>
              {stats.latest && (
                <div className="flex justify-between items-center font-mono text-[13px]">
                  <span className="text-outline">Latest</span>
                  <span className="text-on-surface">{stats.latest}</span>
                </div>
              )}
              {stats.oldest && (
                <div className="flex justify-between items-center font-mono text-[13px]">
                  <span className="text-outline">Oldest</span>
                  <span className="text-on-surface">{stats.oldest}</span>
                </div>
              )}
            </div>
            {Object.keys(stats.byCategory).length > 0 && (
              <div className="space-y-3">
                <p className="font-[Geist] text-xs font-semibold tracking-wider text-outline uppercase">By Category</p>
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between font-mono text-[11px]">
                    <span className="text-on-surface-variant">{cat}</span>
                    <span className="text-secondary">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
