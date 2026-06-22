import { useEffect } from 'react'
import { useIndexBrowser } from '../lib/useIndexBrowser'

export const IndexView = () => {
  const {
    repositories,
    selectedRepo,
    setSelectedRepo,
    selectedRepository,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    files,
    modules,
    dependencies,
    entrypoints,
    testids,
    results,
    loading,
    error,
  } = useIndexBrowser()

  useEffect(() => {
    document.title = 'Project index'
  }, [])

  return (
    <div className="view-shell">
      <header className="view-header">
        <div>
          <div className="eyebrow">Project index</div>
          <h1>Repository database</h1>
          <p className="muted">Browse indexed files, modules, dependencies, and search chunks.</p>
        </div>
        <div className="view-header__meta">
          <span>{repositories.length} repositories</span>
          <span>{selectedRepository?.repo_id ?? 'No repository selected'}</span>
        </div>
      </header>

      <section className="view-toolbar view-toolbar--stacked">
        <select value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)}>
          {repositories.map((repo) => <option key={repo.repo_id} value={repo.repo_id}>{repo.repo_id}</option>)}
        </select>
        <div className="tab-strip">
          {(['files', 'modules', 'dependencies', 'entrypoints', 'testids', 'search'] as const).map((tab) => (
            <button key={tab} type="button" className={activeTab === tab ? 'tab-strip__tab tab-strip__tab--active' : 'tab-strip__tab'} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'search' && <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search file chunks" />}
      </section>

      <section className="view-body">
        {loading && <div className="empty-state">Loading index data…</div>}
        {!loading && error && <div className="error-state">{error}</div>}
        {!loading && !error && activeTab === 'files' && files.map((file) => <div key={file.path} className="row">{file.path}</div>)}
        {!loading && !error && activeTab === 'modules' && modules.map((module) => <div key={module.path} className="row"><strong>{module.module}</strong><span>{module.path}</span></div>)}
        {!loading && !error && activeTab === 'dependencies' && dependencies.map((dep) => <div key={`${dep.source_module}-${dep.dependency}`} className="row"><strong>{dep.source_module}</strong><span>{dep.dependency}</span></div>)}
        {!loading && !error && activeTab === 'entrypoints' && entrypoints.map((entry) => <div key={entry.path} className="row">{entry.path}</div>)}
        {!loading && !error && activeTab === 'testids' && testids.map((item) => <div key={`${item.filepath}:${item.line}:${item.testid}`} className="card"><div className="card__header"><strong>{item.testid}</strong><span className="card__pill">{item.component}</span></div><p>{item.context}</p><div className="card__meta"><span>{item.filepath}</span><span>Line {item.line}</span></div></div>)}
        {!loading && !error && activeTab === 'search' && results.map((item) => <article key={`${item.path}:${item.chunk_start}`} className="card"><div className="card__header"><strong>{item.title}</strong><span className="card__pill">{item.path}</span></div><p>{item.description}</p><pre>{item.snippet}</pre></article>)}
        {!loading && !error && ((activeTab === 'files' && files.length === 0) || (activeTab === 'modules' && modules.length === 0) || (activeTab === 'dependencies' && dependencies.length === 0) || (activeTab === 'entrypoints' && entrypoints.length === 0) || (activeTab === 'testids' && testids.length === 0) || (activeTab === 'search' && results.length === 0)) && <div className="empty-state">No records found.</div>}
      </section>
    </div>
  )
}
