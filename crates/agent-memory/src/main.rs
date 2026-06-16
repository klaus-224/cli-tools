use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::Utc;
use clap::{Parser, Subcommand, ValueEnum};
use rusqlite::{params, params_from_iter, Connection, Row, ToSql};
use serde::Serialize;
use serde_json::json;

const DEFAULT_SCHEMA: &str = r#"
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
    content='agent_memory',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS agent_memory_ai AFTER INSERT ON agent_memory BEGIN
    INSERT INTO agent_memory_fts(rowid, summary, detail, tags)
    VALUES (new.id, new.summary, new.detail, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS agent_memory_ad AFTER DELETE ON agent_memory BEGIN
    INSERT INTO agent_memory_fts(agent_memory_fts, rowid, summary, detail, tags)
    VALUES('delete', old.id, old.summary, old.detail, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS agent_memory_au AFTER UPDATE ON agent_memory BEGIN
    INSERT INTO agent_memory_fts(agent_memory_fts, rowid, summary, detail, tags)
    VALUES('delete', old.id, old.summary, old.detail, old.tags);
    INSERT INTO agent_memory_fts(rowid, summary, detail, tags)
    VALUES (new.id, new.summary, new.detail, new.tags);
END;
"#;

#[derive(Parser)]
#[command(name = "agent_memory", about = "Memory store")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize the database
    Init,
    /// Query memory
    Query {
        #[arg(long, value_enum)]
        category: Option<Category>,
        /// Comma-separated tags (AND)
        #[arg(long)]
        tags: Option<String>,
        /// Full-text search
        #[arg(long)]
        search: Option<String>,
        /// Show N most recent
        #[arg(long)]
        recent: Option<i64>,
        #[arg(long, default_value_t = 20)]
        limit: i64,
    },
    /// Add a learning
    Add {
        #[arg(long, value_enum)]
        category: Category,
        #[arg(long)]
        summary: String,
        #[arg(long)]
        detail: Option<String>,
        #[arg(long)]
        tags: Option<String>,
        #[arg(long = "plan-id")]
        plan_id: Option<String>,
        #[arg(long, default_value = "regression-writer")]
        agent: String,
    },
}

#[derive(Clone, ValueEnum)]
enum Category {
    Navigation,
    #[value(name = "tool-usage")]
    ToolUsage,
    Codebase,
    Gotcha,
    Fixture,
    Selector,
    Debugging,
}

impl Category {
    fn as_str(&self) -> &'static str {
        match self {
            Category::Navigation => "navigation",
            Category::ToolUsage => "tool-usage",
            Category::Codebase => "codebase",
            Category::Gotcha => "gotcha",
            Category::Fixture => "fixture",
            Category::Selector => "selector",
            Category::Debugging => "debugging",
        }
    }
}

#[derive(Serialize)]
struct MemoryEntry {
    id: i64,
    created_at: String,
    category: String,
    summary: String,
    detail: Option<String>,
    tags: Option<String>,
    plan_id: Option<String>,
    agent: Option<String>,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init => cmd_init(),
        Commands::Query {
            category,
            tags,
            search,
            recent,
            limit,
        } => cmd_query(category, tags, search, recent, limit),
        Commands::Add {
            category,
            summary,
            detail,
            tags,
            plan_id,
            agent,
        } => cmd_add(category, summary, detail, tags, plan_id, agent),
    }
}

fn cmd_init() -> Result<()> {
    let db_path = db_path();
    init_db(&db_path)?;
    println!(
        "{}",
        serde_json::to_string(&json!({ "ok": true, "path": db_path.display().to_string() }))?
    );
    Ok(())
}

fn cmd_query(
    category: Option<Category>,
    tags: Option<String>,
    search: Option<String>,
    recent: Option<i64>,
    limit: i64,
) -> Result<()> {
    let db_path = db_path();
    let conn = init_db(&db_path)?;

    let rows = if let Some(recent) = recent {
        let mut stmt = conn.prepare("SELECT * FROM agent_memory ORDER BY created_at DESC LIMIT ?")?;
        let rows = stmt
            .query_map(params![recent], row_to_memory)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    } else {
        let mut conditions = Vec::new();
        let mut values: Vec<Box<dyn ToSql>> = Vec::new();

        if let Some(category) = category {
            conditions.push("l.category = ?".to_string());
            values.push(Box::new(category.as_str().to_string()));
        }

        if let Some(tags) = tags {
            for tag in tags.split(',').map(str::trim).filter(|tag| !tag.is_empty()) {
                conditions.push("l.tags LIKE ?".to_string());
                values.push(Box::new(format!("%{}%", tag)));
            }
        }

        if let Some(search) = search {
            let mut stmt = conn.prepare("SELECT rowid FROM agent_memory_fts WHERE agent_memory_fts MATCH ?")?;
            let ids = stmt
                .query_map(params![search], |row| row.get::<_, i64>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;

            if ids.is_empty() {
                println!("[]");
                return Ok(());
            }

            let id_list = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
            conditions.push(format!("l.id IN ({})", id_list));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT * FROM agent_memory l {} ORDER BY l.created_at DESC LIMIT ?",
            where_clause
        );
        values.push(Box::new(limit));

        let mut stmt = conn.prepare(&sql)?;
        let params = params_from_iter(values.iter().map(|value| &**value));
        let rows = stmt
            .query_map(params, row_to_memory)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };

    println!("{}", serde_json::to_string_pretty(&rows)?);
    Ok(())
}

fn cmd_add(
    category: Category,
    summary: String,
    detail: Option<String>,
    tags: Option<String>,
    plan_id: Option<String>,
    agent: String,
) -> Result<()> {
    let db_path = db_path();
    let conn = init_db(&db_path)?;

    conn.execute(
        "INSERT INTO agent_memory (created_at, category, summary, detail, tags, plan_id, agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            Utc::now().to_rfc3339(),
            category.as_str(),
            summary,
            detail,
            tags,
            plan_id,
            agent,
        ],
    )?;

    let id = conn.last_insert_rowid();
    println!("{}", serde_json::to_string(&json!({ "ok": true, "id": id }))?);
    Ok(())
}

fn init_db(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let conn = Connection::open(db_path)
        .with_context(|| format!("failed to open {}", db_path.display()))?;
    conn.execute_batch(&read_schema()?)?;
    Ok(conn)
}

fn read_schema() -> Result<String> {
    match env::var("AGENT_MEMORY_SCHEMA_PATH") {
        Ok(path) => fs::read_to_string(expand_home(&path))
            .with_context(|| format!("failed to read schema from {}", path)),
        Err(_) => Ok(DEFAULT_SCHEMA.to_string()),
    }
}

fn db_path() -> PathBuf {
    env::var("AGENT_MEMORY_DB_PATH")
        .map(|path| expand_home(&path))
        .unwrap_or_else(|_| home_dir().join(".local/state/agent-tools/memory.db"))
}

fn expand_home(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir();
    }

    if let Some(rest) = path.strip_prefix("~/") {
        return home_dir().join(rest);
    }

    PathBuf::from(path)
}

fn home_dir() -> PathBuf {
    env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

fn row_to_memory(row: &Row<'_>) -> rusqlite::Result<MemoryEntry> {
    Ok(MemoryEntry {
        id: row.get("id")?,
        created_at: row.get("created_at")?,
        category: row.get("category")?,
        summary: row.get("summary")?,
        detail: row.get("detail")?,
        tags: row.get("tags")?,
        plan_id: row.get("plan_id")?,
        agent: row.get("agent")?,
    })
}
