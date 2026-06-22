import { useEffect, useMemo, useState } from 'react'
import type {
  IndexDependency,
  IndexEntrypoint,
  IndexFile,
  IndexModule,
  IndexRepository,
  IndexSearchResult,
  IndexTestId,
} from '../types'
import {
  fetchDependencies,
  fetchEntrypoints,
  fetchFiles,
  fetchModules,
  fetchRepositories,
  fetchSearchResults,
  fetchTestIds,
} from './indexApi'

export type IndexTab = 'files' | 'modules' | 'dependencies' | 'entrypoints' | 'testids' | 'search'

export const useIndexBrowser = () => {
  const [repositories, setRepositories] = useState<IndexRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [activeTab, setActiveTab] = useState<IndexTab>('files')
  const [search, setSearch] = useState('')
  const [files, setFiles] = useState<IndexFile[]>([])
  const [modules, setModules] = useState<IndexModule[]>([])
  const [dependencies, setDependencies] = useState<IndexDependency[]>([])
  const [entrypoints, setEntrypoints] = useState<IndexEntrypoint[]>([])
  const [testids, setTestIds] = useState<IndexTestId[]>([])
  const [results, setResults] = useState<IndexSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRepositories()
      .then((nextRepositories) => {
        setRepositories(nextRepositories)
        setSelectedRepo((current) => current || nextRepositories[0]?.repo_id || '')
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Failed to load repositories'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedRepo) return
    setLoading(true)
    setError(null)

    const loaders: Record<IndexTab, Promise<unknown>> = {
      files: fetchFiles(selectedRepo),
      modules: fetchModules(selectedRepo),
      dependencies: fetchDependencies(selectedRepo),
      entrypoints: fetchEntrypoints(selectedRepo),
      testids: fetchTestIds(selectedRepo),
      search: search.trim() ? fetchSearchResults(selectedRepo, search.trim()) : Promise.resolve([]),
    }

    loaders[activeTab]
      .then((payload) => {
        if (activeTab === 'files') setFiles(payload as IndexFile[])
        if (activeTab === 'modules') setModules(payload as IndexModule[])
        if (activeTab === 'dependencies') setDependencies(payload as IndexDependency[])
        if (activeTab === 'entrypoints') setEntrypoints(payload as IndexEntrypoint[])
        if (activeTab === 'testids') setTestIds(payload as IndexTestId[])
        if (activeTab === 'search') setResults(payload as IndexSearchResult[])
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Failed to load index data'))
      .finally(() => setLoading(false))
  }, [activeTab, selectedRepo, search])

  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.repo_id === selectedRepo) ?? null,
    [repositories, selectedRepo],
  )

  return {
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
  }
}
