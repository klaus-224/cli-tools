CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT,
    tags TEXT,
    plan_id TEXT,
    agent TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS agent_memory_fts USING fts5(
    summary,
    detail,
    tags,
    content = 'agent_memory',
    content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS agent_memory_ai
AFTER
INSERT
    ON agent_memory
BEGIN
INSERT INTO
    agent_memory_fts(rowid, summary, detail, tags)
VALUES
    (new.id, new.summary, new.detail, new.tags);

END;

CREATE TRIGGER IF NOT EXISTS agent_memory_ad
AFTER
    DELETE ON agent_memory
BEGIN
INSERT INTO
    agent_memory_fts(agent_memory_fts, rowid, summary, detail, tags)
VALUES
    (
        'delete',
        old.id,
        old.summary,
        old.detail,
        old.tags
    );

END;

CREATE TRIGGER IF NOT EXISTS agent_memory_au
AFTER
UPDATE
    ON agent_memory
BEGIN
INSERT INTO
    agent_memory_fts(agent_memory_fts, rowid, summary, detail, tags)
VALUES
    (
        'delete',
        old.id,
        old.summary,
        old.detail,
        old.tags
    );

INSERT INTO
    agent_memory_fts(rowid, summary, detail, tags)
VALUES
    (new.id, new.summary, new.detail, new.tags);

END;
