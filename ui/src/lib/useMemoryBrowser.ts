import { useEffect, useMemo, useState } from 'react'
import type { MemoryEntry, MemoryQuery, MemoryStats } from '../types'
import { fetchMemories, fetchMemoryStats } from './memoryApi'

const DEFAULT_QUERY: MemoryQuery = {
  category: '',
  tags: '',
  search: '',
  limit: 50,
}

export const useMemoryBrowser = () => {
  const [query, setQueryState] = useState<MemoryQuery>(DEFAULT_QUERY)
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setQuery = (next: Partial<MemoryQuery>) => {
    setQueryState((current) => ({ ...current, ...next }))
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true)
      Promise.all([fetchMemories(query), fetchMemoryStats()])
        .then(([nextMemories, nextStats]) => {
          setMemories(nextMemories)
          setStats(nextStats)
          setError(null)
        })
        .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Failed to load memory'))
        .finally(() => setLoading(false))
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [query])

  const categoryOptions = useMemo(() => Object.keys(stats?.byCategory ?? {}).sort(), [stats])

  return { query, setQuery, memories, stats, loading, error, categoryOptions }
}
