CREATE TABLE IF NOT EXISTS repositories (
    repo_id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    indexed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    repo_id TEXT NOT NULL,
    path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
    repo_id TEXT NOT NULL,
    module TEXT NOT NULL,
    path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dependencies (
    repo_id TEXT NOT NULL,
    source_module TEXT NOT NULL,
    dependency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entrypoints (
    repo_id TEXT NOT NULL,
    path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS testids (
    repo_id TEXT NOT NULL,
    testid TEXT NOT NULL,
    component TEXT NOT NULL,
    filepath TEXT NOT NULL,
    line INTEGER NOT NULL,
    context TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id TEXT NOT NULL UNIQUE,
    repo_id TEXT NOT NULL,
    path TEXT NOT NULL,
    path_text TEXT NOT NULL,
    language TEXT NOT NULL,
    chunk_kind TEXT NOT NULL,
    chunk_start INTEGER NOT NULL,
    chunk_end INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    search_text TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS file_chunks_fts USING fts5(
    chunk_id,
    repo_id,
    path,
    path_text,
    language,
    chunk_kind,
    chunk_start,
    chunk_end,
    title,
    description,
    content,
    search_text
);
