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
