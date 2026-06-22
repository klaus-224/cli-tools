export type SessionQuery = {
  session_id: string
  agent: string
  directory: string
  limit: number
}

export type ApiErrorPayload = {
  error: {
    message: string
    details?: unknown
  }
}

export type SessionSummary = {
  id: string
  title: string
  agent: string | null
  directory: string | null
  time_created: string | null
  time_updated: string | null
  slug?: string | null
  model?: string | null
  cost?: string | number | null
}

export type SessionMessage = {
  id: string
  session_id: string
  type: string | null
  time_created: string | null
  time_updated: string | null
  rawData: string
  parsedData: unknown | null
  parseError: string | null
}

export type SessionTranscript = {
  session: SessionSummary | null
  session_messages: SessionMessage[]
}

export type MemoryEntry = {
  id: number
  created_at: string
  category: string
  summary: string
  detail: string | null
  tags: string | null
  plan_id: string | null
  agent: string | null
}

export type MemoryQuery = {
  category?: string
  tags?: string
  search?: string
  recent?: number
  limit?: number
}

export type MemoryStats = {
  total: number
  byCategory: Record<string, number>
  latest: string | null
  oldest: string | null
}

export type IndexRepository = {
  repo_id: string
  path: string
  indexed_at: number
}

export type IndexFile = {
  path: string
}

export type IndexModule = {
  module: string
  path: string
}

export type IndexDependency = {
  source_module: string
  dependency: string
}

export type IndexEntrypoint = {
  path: string
}

export type IndexTestId = {
  testid: string
  component: string
  filepath: string
  line: number
  context: string
}

export type IndexSearchResult = {
  path: string
  chunk_start: number
  chunk_end: number
  title: string
  description: string
  snippet: string
}

export type IndexQueryResult = {
  values: string[]
}
