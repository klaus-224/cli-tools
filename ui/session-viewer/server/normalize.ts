import type { SessionMessage, SessionSummary } from './types'

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

const pickString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

const pickTime = (value: unknown): string | null => pickString(value)

const coerceSummary = (item: Record<string, unknown>): SessionSummary | null => {
  const id = pickString(item.id ?? item.session_id ?? item.sessionId)
  if (!id) return null

  return {
    id,
    title: pickString(item.title) ?? id,
    agent: pickString(item.agent),
    directory: pickString(item.directory),
    time_created: pickTime(item.time_created ?? item.created_at ?? item.createdAt ?? item.created),
    time_updated: pickTime(item.time_updated ?? item.updated_at ?? item.updatedAt ?? item.updated),
    slug: pickString(item.slug),
    model: pickString(item.model),
    cost: typeof item.cost === 'string' || typeof item.cost === 'number' ? item.cost : null,
  }
}

const coerceMessage = (
  item: Record<string, unknown>,
  index: number,
  sessionId: string,
): SessionMessage | null => {
  const id = pickString(item.id ?? item.message_id ?? item.messageId) ?? `${sessionId}:${index + 1}`
  const rawSource = item.data ?? item.rawData ?? item.payload
  const rawData = rawSource != null ? toText(rawSource) : toText(item)
  let parsedData: unknown | null = null
  let parseError: string | null = null

  if (rawSource != null && rawData.trim()) {
    try {
      parsedData = JSON.parse(rawData)
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'Unable to parse message data'
    }
  } else {
    parsedData = item
  }

  return {
    id,
    session_id: pickString(item.session_id ?? item.sessionId) ?? sessionId,
    type: pickString(item.type ?? item.message_type ?? item.kind),
    time_created: pickTime(item.time_created ?? item.created_at ?? item.createdAt),
    time_updated: pickTime(item.time_updated ?? item.updated_at ?? item.updatedAt),
    rawData,
    parsedData,
    parseError,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (isRecord(value)) {
    const values = [value.sessions, value.items, value.rows, value.data]
    for (const candidate of values) {
      if (Array.isArray(candidate)) return candidate
    }
  }
  return []
}

export const normalizeSessionList = (input: unknown): SessionSummary[] => {
  const values = asArray(input)
  return values
    .filter(isRecord)
    .map(coerceSummary)
    .filter((item): item is SessionSummary => Boolean(item))
}

export const normalizeTranscript = (
  input: unknown,
  sessionId: string,
): { session: SessionSummary | null; session_messages: SessionMessage[] } => {
  if (Array.isArray(input)) {
    return {
      session: null,
      session_messages: input
        .filter(isRecord)
        .map((item, index) => coerceMessage(item, index, sessionId))
        .filter((item): item is SessionMessage => Boolean(item)),
    }
  }

  if (isRecord(input)) {
    const transcript = input.transcript ?? input.session ?? input.data ?? input
    const session = isRecord(input.session) ? coerceSummary(input.session) : null
    const session_messages = asArray(transcript)
      .filter(isRecord)
      .map((item, index) => coerceMessage(item, index, sessionId))
      .filter((item): item is SessionMessage => Boolean(item))
    return { session, session_messages }
  }

  return { session: null, session_messages: [] }
}

export const normalizeSearch = (value: string | null): string => value?.trim() ?? ''

export const safeText = toText
