import type { IncomingMessage, ServerResponse } from 'node:http'
import { adapterErrorPayload } from './sessionReaderAdapter'

export const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export const sendError = (res: ServerResponse, statusCode: number, message: string, details?: unknown) => {
  sendJson(res, statusCode, adapterErrorPayload(message, details))
}

export const readUrl = (req: IncomingMessage): URL | null => {
  if (!req.url) return null
  return new URL(req.url, 'http://127.0.0.1')
}
