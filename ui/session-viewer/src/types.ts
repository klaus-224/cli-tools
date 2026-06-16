export type QueryState = {
  session_id: string
  agent: string
  directory: string
  limit: number
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

export type TranscriptMessage = {
  id: string
  session_id: string
  type: string | null
  time_created: string | null
  time_updated: string | null
  rawData: string
  parsedData: unknown | null
  parseError: string | null
}

export type TranscriptPayload = {
  session: SessionSummary | null
  session_messages: TranscriptMessage[]
}

export type NormalizedPart = {
  type: string
  text: string
  raw: unknown
  toolName?: string
  arguments?: unknown
  status?: string
  error?: string
  structured?: unknown
}

export type NormalizedMessage = {
  messageId: string
  role: string
  agent: string | null
  senderType: 'user' | 'assistant' | 'system' | 'unknown'
  parts: NormalizedPart[]
  timeCreated: string | null
  timeUpdated: string | null
  rawData: string
  parsedData: unknown | null
  parseError: string | null
}
