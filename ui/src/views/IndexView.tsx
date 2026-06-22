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
    document.title = 'Repository Database | Agent Tool UI'
  }, [])

  const tabs = ['files', 'modules', 'dependencies', 'entrypoints', 'testids', 'search'] as const

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* Repository Selector Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">Repository Database</h1>
            <div className="px-3 py-1 bg-surface-container-high border border-outline-variant rounded-full flex items-center gap-2 hover:bg-surface-container-highest transition-all">
              <span className="material-symbols-outlined text-secondary text-[18px]">database</span>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-on-surface focus:ring-0 p-0 cursor-pointer"
              >
                {repositories.map((repo) => (
                  <option key={repo.repo_id} value={repo.repo_id}>{repo.repo_id}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Main Index View */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Tabbed Interface */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="glass-panel rounded-xl overflow-hidden border border-outline-variant shadow-lg flex flex-col min-h-[600px]">
              {/* Tab Bar */}
              <div className="bg-surface-container border-b border-outline-variant px-4 flex items-center justify-between">
                <div className="flex">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-4 font-[Geist] text-xs font-semibold tracking-wider uppercase transition-colors ${
                        activeTab === tab
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {activeTab === 'search' && (
                  <div className="flex items-center gap-3">
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-full flex items-center px-3 py-1 text-sm">
                      <span className="material-symbols-outlined text-[16px] text-outline mr-2">search</span>
                      <input
                        className="bg-transparent border-none p-0 focus:ring-0 text-sm w-32 md:w-48 text-on-surface placeholder:text-outline outline-none"
                        placeholder="Search chunks..."
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading && (
                  <div className="p-8 text-center text-outline text-sm">Loading index data...</div>
                )}
                {!loading && error && (
                  <div className="p-8 text-center text-error text-sm">{error}</div>
                )}

                {/* Files Tab */}
                {!loading && !error && activeTab === 'files' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low z-10">
                      <tr className="font-[Geist] text-[11px] font-semibold tracking-wider text-outline uppercase">
                        <th className="px-6 py-3">Path & Filename</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {files.map((file) => (
                        <tr key={file.path} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-tertiary text-[18px]">description</span>
                              <span className="font-mono text-[13px] text-on-surface">{file.path}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {files.length === 0 && (
                        <tr><td className="px-6 py-8 text-center text-outline text-sm">No files found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Modules Tab */}
                {!loading && !error && activeTab === 'modules' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low z-10">
                      <tr className="font-[Geist] text-[11px] font-semibold tracking-wider text-outline uppercase">
                        <th className="px-6 py-3">Module</th>
                        <th className="px-6 py-3">Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {modules.map((mod) => (
                        <tr key={mod.path} className="hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-3 font-mono text-[13px] text-primary font-medium">{mod.module}</td>
                          <td className="px-6 py-3 font-mono text-[13px] text-on-surface-variant">{mod.path}</td>
                        </tr>
                      ))}
                      {modules.length === 0 && (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-outline text-sm">No modules found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Dependencies Tab */}
                {!loading && !error && activeTab === 'dependencies' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low z-10">
                      <tr className="font-[Geist] text-[11px] font-semibold tracking-wider text-outline uppercase">
                        <th className="px-6 py-3">Source Module</th>
                        <th className="px-6 py-3">Dependency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {dependencies.map((dep) => (
                        <tr key={`${dep.source_module}-${dep.dependency}`} className="hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-3 font-mono text-[13px] text-on-surface font-medium">{dep.source_module}</td>
                          <td className="px-6 py-3 font-mono text-[13px] text-on-surface-variant">{dep.dependency}</td>
                        </tr>
                      ))}
                      {dependencies.length === 0 && (
                        <tr><td colSpan={2} className="px-6 py-8 text-center text-outline text-sm">No dependencies found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Entrypoints Tab */}
                {!loading && !error && activeTab === 'entrypoints' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low z-10">
                      <tr className="font-[Geist] text-[11px] font-semibold tracking-wider text-outline uppercase">
                        <th className="px-6 py-3">Entrypoint Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {entrypoints.map((entry) => (
                        <tr key={entry.path} className="hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-3 font-mono text-[13px] text-on-surface">{entry.path}</td>
                        </tr>
                      ))}
                      {entrypoints.length === 0 && (
                        <tr><td className="px-6 py-8 text-center text-outline text-sm">No entrypoints found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Test IDs Tab */}
                {!loading && !error && activeTab === 'testids' && (
                  <div className="p-4 space-y-3">
                    {testids.map((item) => (
                      <div key={`${item.filepath}:${item.line}:${item.testid}`} className="glass-panel rounded-lg p-4 hover:border-primary/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-[13px] text-primary font-bold">{item.testid}</span>
                          <span className="font-[Geist] text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant uppercase">
                            {item.component}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface-variant">{item.context}</p>
                        <div className="mt-2 font-mono text-[11px] text-outline">
                          {item.filepath}:{item.line}
                        </div>
                      </div>
                    ))}
                    {testids.length === 0 && (
                      <div className="text-center py-8 text-outline text-sm">No test IDs found.</div>
                    )}
                  </div>
                )}

                {/* Search Tab */}
                {!loading && !error && activeTab === 'search' && (
                  <div className="p-4 space-y-3">
                    {results.map((item) => (
                      <article key={`${item.path}:${item.chunk_start}`} className="glass-panel rounded-lg p-4 hover:border-primary/50 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <strong className="text-on-surface text-sm">{item.title}</strong>
                          <span className="font-mono text-[11px] text-outline">{item.path}</span>
                        </div>
                        <p className="text-sm text-on-surface-variant mb-3">{item.description}</p>
                        <pre className="bg-surface-container-lowest p-3 rounded border border-outline-variant font-mono text-[13px] text-secondary overflow-x-auto whitespace-pre-wrap">
                          {item.snippet}
                        </pre>
                      </article>
                    ))}
                    {results.length === 0 && (
                      <div className="text-center py-8 text-outline text-sm">No results found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer metadata */}
              <div className="bg-surface-container-low border-t border-outline-variant p-3 flex justify-between items-center px-6 shrink-0">
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {activeTab === 'files' && `${files.length} files`}
                  {activeTab === 'modules' && `${modules.length} modules`}
                  {activeTab === 'dependencies' && `${dependencies.length} dependencies`}
                  {activeTab === 'entrypoints' && `${entrypoints.length} entrypoints`}
                  {activeTab === 'testids' && `${testids.length} test IDs`}
                  {activeTab === 'search' && `${results.length} results`}
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar - Repository Info */}
          <div className="lg:col-span-4 space-y-4">
            {/* Repository Info Card */}
            {selectedRepository && (
              <div className="glass-panel rounded-xl overflow-hidden border border-outline-variant flex flex-col">
                <div className="p-4 space-y-4">
                  <span className="font-[Geist] text-xs font-semibold tracking-wider text-outline uppercase">Repository Info</span>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Repo ID</span>
                      <span className="font-mono text-[13px] text-on-surface truncate ml-2 max-w-[160px]">{selectedRepository.repo_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Path</span>
                      <span className="font-mono text-[13px] text-on-surface truncate ml-2 max-w-[160px]" title={selectedRepository.path}>{selectedRepository.path}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Indexed</span>
                      <span className="font-mono text-[13px] text-on-surface">{new Date(selectedRepository.indexed_at * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Index counts */}
            <div className="glass-panel rounded-xl border border-outline-variant p-4 space-y-4">
              <h4 className="font-[Geist] text-xs font-semibold tracking-wider text-outline border-b border-outline-variant pb-2 uppercase">Index Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  <div className="flex-1 flex justify-between">
                    <span className="text-sm font-medium text-on-surface">Files</span>
                    <span className="font-mono text-[13px] text-on-surface-variant">{files.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 flex justify-between">
                    <span className="text-sm font-medium text-on-surface">Modules</span>
                    <span className="font-mono text-[13px] text-on-surface-variant">{modules.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-tertiary" />
                  <div className="flex-1 flex justify-between">
                    <span className="text-sm font-medium text-on-surface">Dependencies</span>
                    <span className="font-mono text-[13px] text-on-surface-variant">{dependencies.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
