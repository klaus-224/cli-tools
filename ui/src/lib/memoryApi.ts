import type { MemoryEntry, MemoryQuery, MemoryStats } from '../types'

type MemoryResponse = { memories: MemoryEntry[] }

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`)
  }
  return (await response.json()) as T
}

export const fetchMemories = async (query: MemoryQuery): Promise<MemoryEntry[]> => {
  const params = new URLSearchParams()
  if (query.category?.trim()) params.set('category', query.category.trim())
  if (query.tags?.trim()) params.set('tags', query.tags.trim())
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (typeof query.recent === 'number') params.set('recent', String(query.recent))
  params.set('limit', String(query.limit ?? 50))

  const response = await fetch(`/api/memory?${params.toString()}`)
  const payload = await readJson<MemoryResponse>(response)
  return payload.memories ?? []
}

export const fetchMemoryStats = async (): Promise<MemoryStats> => {
  const response = await fetch('/api/memory/stats')
  return readJson<MemoryStats>(response)
}
