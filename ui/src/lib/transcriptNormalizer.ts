import type { NormalizedMessage, NormalizedPart, TranscriptMessage } from '../types'

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

const senderFromRole = (role: string): NormalizedMessage['senderType'] => {
  const normalized = role.toLowerCase()
  if (['user', 'human', 'client'].includes(normalized)) return 'user'
  if (['assistant', 'agent', 'reviewer'].includes(normalized)) return 'assistant'
  if (['system'].includes(normalized)) return 'system'
  return 'unknown'
}

const partFromUnknown = (part: unknown): NormalizedPart => {
  if (typeof part === 'string') {
    return { type: 'text', text: part, raw: part }
  }
  if (typeof part !== 'object' || part === null) {
    return { type: 'unknown', text: asText(part), raw: part }
  }

  const record = part as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : typeof record.kind === 'string' ? record.kind : 'unknown'
  const text = typeof record.text === 'string'
    ? record.text
    : typeof record.content === 'string'
      ? record.content
      : asText(record.text ?? record.content ?? record.value ?? record.data)

  const base: NormalizedPart = { type, text, raw: part }

  if (type.includes('tool') || record.tool_name || record.toolName) {
    base.toolName = typeof record.tool_name === 'string' ? record.tool_name : typeof record.toolName === 'string' ? record.toolName : undefined
    base.arguments = record.arguments ?? record.input ?? record.payload ?? record.data
    base.status = typeof record.status === 'string' ? record.status : typeof record.state === 'string' ? record.state : undefined
    base.error = typeof record.error === 'string' ? record.error : typeof record.reason === 'string' ? record.reason : undefined
    base.structured = record
  }

  if (type === 'failure' || type === 'tool_failure') {
    base.error = base.error ?? text
    base.structured = record
  }

  return base
}

const messageRole = (message: TranscriptMessage): string => {
  const parsed = message.parsedData
  if (parsed && typeof parsed === 'object') {
    const role = (parsed as Record<string, unknown>).role
    if (typeof role === 'string') return role
    const sender = (parsed as Record<string, unknown>).sender
    if (typeof sender === 'string') return sender
  }
  return message.type ?? 'unknown'
}

export const normalizeMessages = (messages: TranscriptMessage[]): NormalizedMessage[] =>
  messages.map((message) => {
    const parsed = message.parsedData
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    const role = messageRole(message)
    const partsSource = record?.parts ?? record?.content ?? record?.messages ?? record?.items
    const parts = Array.isArray(partsSource)
      ? partsSource.map(partFromUnknown)
      : partsSource != null
        ? [partFromUnknown(partsSource)]
        : message.rawData.trim()
          ? [{ type: 'text', text: message.rawData, raw: message.rawData }]
          : []

    return {
      messageId: message.id,
      role,
      agent: typeof record?.agent === 'string' ? record.agent : null,
      senderType: senderFromRole(role),
      parts,
      timeCreated: message.time_created,
      timeUpdated: message.time_updated,
      rawData: message.rawData,
      parsedData: message.parsedData,
      parseError: message.parseError,
    }
  })
