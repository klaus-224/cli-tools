import { spawn } from 'node:child_process'
import type {
  IndexDependency,
  IndexEntrypoint,
  IndexFile,
  IndexModule,
  IndexRepository,
  IndexSearchResult,
  IndexTestId,
  IndexQueryResult,
} from './types'

const PROJECT_INDEX_BIN = process.env.PROJECT_INDEX_BIN ?? 'project_index'

const MAX_LIMIT = 1000

type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

const runCommand = (args: string[]): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(PROJECT_INDEX_BIN, args, {
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

const parseTsv = (output: string): string[][] =>
  output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'))

const clampLimit = (value: number): number => {
  if (!Number.isFinite(value)) return 20
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT)
}

const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")

const quoted = (value: string): string => `'${escapeSqlLiteral(value)}'`

const safeText = (value: string, label: string): string => {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Missing ${label}`)
  if (/\u0000/.test(trimmed)) throw new Error(`Invalid ${label}`)
  return trimmed
}

const safeRepoId = (repoId: string): string => {
  const trimmed = repoId.trim()
  if (!trimmed) throw new Error('Missing repo id')
  if (/\u0000/.test(trimmed)) throw new Error('Invalid repo id')
  return trimmed
}

const safeFtsQuery = (query: string): string => {
  const trimmed = safeText(query, 'search query')
  if (/[;]/.test(trimmed)) throw new Error('Invalid search query')
  return trimmed
}

const queryRows = async (sql: string): Promise<string[][]> => {
  const result = await runCommand(['query', sql])
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `project_index exited with code ${result.exitCode}`)
  }
  return parseTsv(result.stdout)
}

const rowsToObjects = <T>(rows: string[][], mapper: (row: string[]) => T): T[] => rows.map(mapper)

export const listRepositories = async (): Promise<IndexRepository[]> => {
  const rows = await queryRows('SELECT repo_id, path, indexed_at FROM repositories ORDER BY indexed_at DESC')
  return rowsToObjects(rows, (row) => ({ repo_id: row[0] ?? '', path: row[1] ?? '', indexed_at: Number(row[2] ?? 0) }))
}

export const listFiles = async (repoId: string, limit = 200): Promise<IndexFile[]> => {
  const rows = await queryRows(`SELECT path FROM files WHERE repo_id = ${quoted(safeRepoId(repoId))} ORDER BY path LIMIT ${clampLimit(limit)}`)
  return rowsToObjects(rows, (row) => ({ path: row[0] ?? '' }))
}

export const listModules = async (repoId: string): Promise<IndexModule[]> => {
  const rows = await queryRows(`SELECT module, path FROM modules WHERE repo_id = ${quoted(safeRepoId(repoId))} ORDER BY module`)
  return rowsToObjects(rows, (row) => ({ module: row[0] ?? '', path: row[1] ?? '' }))
}

export const listDependencies = async (repoId: string): Promise<IndexDependency[]> => {
  const rows = await queryRows(`SELECT source_module, dependency FROM dependencies WHERE repo_id = ${quoted(safeRepoId(repoId))} ORDER BY source_module, dependency`)
  return rowsToObjects(rows, (row) => ({ source_module: row[0] ?? '', dependency: row[1] ?? '' }))
}

export const listEntrypoints = async (repoId: string): Promise<IndexEntrypoint[]> => {
  const rows = await queryRows(`SELECT path FROM entrypoints WHERE repo_id = ${quoted(safeRepoId(repoId))} ORDER BY path`)
  return rowsToObjects(rows, (row) => ({ path: row[0] ?? '' }))
}

export const listTestIds = async (repoId: string): Promise<IndexTestId[]> => {
  const rows = await queryRows(`SELECT testid, component, filepath, line, context FROM testids WHERE repo_id = ${quoted(safeRepoId(repoId))} ORDER BY filepath, line`)
  return rowsToObjects(rows, (row) => ({
    testid: row[0] ?? '',
    component: row[1] ?? '',
    filepath: row[2] ?? '',
    line: Number(row[3] ?? 0),
    context: row[4] ?? '',
  }))
}

export const searchIndex = async (repoId: string, query: string, limit = 20): Promise<IndexSearchResult[]> => {
  const rows = await queryRows(`SELECT f.path, f.chunk_start, f.chunk_end, f.title, f.description, substr(f.content, 1, 500) AS snippet FROM file_chunks_fts JOIN file_chunks f ON file_chunks_fts.rowid = f.id WHERE file_chunks_fts MATCH ${quoted(safeFtsQuery(query))} AND f.repo_id = ${quoted(safeRepoId(repoId))} ORDER BY bm25(file_chunks_fts) ASC LIMIT ${clampLimit(limit)}`)
  return rowsToObjects(rows, (row) => ({
    path: row[0] ?? '',
    chunk_start: Number(row[1] ?? 0),
    chunk_end: Number(row[2] ?? 0),
    title: row[3] ?? '',
    description: row[4] ?? '',
    snippet: row[5] ?? '',
  }))
}

export const runRawQuery = async (sql: string): Promise<IndexQueryResult[]> => {
  const trimmed = sql.trim()
  if (!/^(SELECT|WITH)\b/i.test(trimmed) || /;/.test(trimmed)) {
    throw new Error('Refusing to execute non-read-only SQL')
  }
  const rows = await queryRows(sql)
  return rows.map((row) => ({ values: row }))
}
