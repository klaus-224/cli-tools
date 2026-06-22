import type {
  IndexDependency,
  IndexEntrypoint,
  IndexFile,
  IndexModule,
  IndexRepository,
  IndexSearchResult,
  IndexTestId,
} from '../types'

type RepositoriesResponse = { repositories: IndexRepository[] }
type FilesResponse = { files: IndexFile[] }
type ModulesResponse = { modules: IndexModule[] }
type DependenciesResponse = { dependencies: IndexDependency[] }
type EntrypointsResponse = { entrypoints: IndexEntrypoint[] }
type TestIdsResponse = { testids: IndexTestId[] }
type SearchResponse = { results: IndexSearchResult[] }

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`)
  }
  return (await response.json()) as T
}

export const fetchRepositories = async (): Promise<IndexRepository[]> => {
  const response = await fetch('/api/index/repositories')
  const payload = await readJson<RepositoriesResponse>(response)
  return payload.repositories ?? []
}

export const fetchFiles = async (repo: string, limit = 200): Promise<IndexFile[]> => {
  const params = new URLSearchParams({ repo, limit: String(limit) })
  const response = await fetch(`/api/index/files?${params.toString()}`)
  const payload = await readJson<FilesResponse>(response)
  return payload.files ?? []
}

export const fetchModules = async (repo: string): Promise<IndexModule[]> => {
  const response = await fetch(`/api/index/modules?repo=${encodeURIComponent(repo)}`)
  const payload = await readJson<ModulesResponse>(response)
  return payload.modules ?? []
}

export const fetchDependencies = async (repo: string): Promise<IndexDependency[]> => {
  const response = await fetch(`/api/index/dependencies?repo=${encodeURIComponent(repo)}`)
  const payload = await readJson<DependenciesResponse>(response)
  return payload.dependencies ?? []
}

export const fetchEntrypoints = async (repo: string): Promise<IndexEntrypoint[]> => {
  const response = await fetch(`/api/index/entrypoints?repo=${encodeURIComponent(repo)}`)
  const payload = await readJson<EntrypointsResponse>(response)
  return payload.entrypoints ?? []
}

export const fetchTestIds = async (repo: string): Promise<IndexTestId[]> => {
  const response = await fetch(`/api/index/testids?repo=${encodeURIComponent(repo)}`)
  const payload = await readJson<TestIdsResponse>(response)
  return payload.testids ?? []
}

export const fetchSearchResults = async (repo: string, q: string, limit = 20): Promise<IndexSearchResult[]> => {
  const params = new URLSearchParams({ repo, q, limit: String(limit) })
  const response = await fetch(`/api/index/search?${params.toString()}`)
  const payload = await readJson<SearchResponse>(response)
  return payload.results ?? []
}
