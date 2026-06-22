import { spawn } from 'node:child_process'
import type { MemoryEntry, MemoryQuery, MemoryStats } from './types'

const AGENT_MEMORY_BIN = process.env.AGENT_MEMORY_BIN ?? 'agent_memory'

type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

const runCommand = (args: string[]): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(AGENT_MEMORY_BIN, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 })
    })
  })

const runVariants = async (variants: string[][]): Promise<CommandResult> => {
  let lastResult: CommandResult | null = null

  for (const args of variants) {
    const result = await runCommand(args)
    lastResult = result
    if (result.exitCode === 0) return result
  }

  if (!lastResult) {
    throw new Error('Failed to run agent_memory')
  }

  throw new Error(lastResult.stderr.trim() || `agent_memory exited with code ${lastResult.exitCode}`)
}

const maybeJson = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

const categoryWhere = (category?: string) => (category ? ['--category', category] : [])
const tagsWhere = (tags?: string) => (tags ? ['--tags', tags] : [])
const searchWhere = (search?: string) => (search ? ['--search', search] : [])

export const queryMemories = async (query: MemoryQuery): Promise<MemoryEntry[]> => {
  const args = [
    'query',
    ...categoryWhere(query.category),
    ...tagsWhere(query.tags),
    ...searchWhere(query.search),
  ]

  if (typeof query.recent === 'number') args.push('--recent', String(query.recent))
  args.push('--limit', String(query.limit ?? 20))

  const result = await runVariants([args, ['query', '--limit', String(query.limit ?? 20)]])
  const payload = maybeJson(result.stdout)
  return Array.isArray(payload) ? (payload as MemoryEntry[]) : []
}

export const getMemoryStats = async (): Promise<MemoryStats> => {
  const memories = await queryMemories({ recent: 1000, limit: 1000 })
  const byCategory = memories.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + 1
    return acc
  }, {})

  return {
    total: memories.length,
    byCategory,
    latest: memories[0]?.created_at ?? null,
    oldest: memories.at(-1)?.created_at ?? null,
  }
}
