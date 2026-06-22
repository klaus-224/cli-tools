use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use regex::Regex;
use rusqlite::{params, types::ValueRef, Connection};
use serde_json::json;
use walkdir::WalkDir;

const DEFAULT_SCHEMA: &str = r#"
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
"#;

const IGNORE_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".ruff-cache",
    "target",
    ".next",
    ".nuxt",
    "vendor",
    "coverage",
    ".tox",
    "playwright-tests",
    "*.egg-info",
];

const IGNORED_FILE_TYPES: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf",
    ".wasm", ".zip", ".tar", ".gz", ".tgz", ".pdf", ".mov", ".mp4", ".mp3", ".bin",
    ".exe", ".dll", ".so", ".dylib", ".lock", ".md", ".txt",
];

const MAX_FILE_SIZE: u64 = 1_000_000;

#[derive(Parser)]
#[command(name = "project_index", about = "Unified repo tool - index, query, map, and search repositories.")]
struct Cli {
    /// Show the configured database location and exit
    #[arg(long, global = true)]
    info: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Index the current repo into SQLite
    Index,
    /// Query the repo index with SQL
    Query {
        /// SQL query to execute
        sql: String,
    },
    /// Generate a local repo map (JSON + Graphviz)
    Map,
    /// Full-text search across indexed repository chunks
    Search {
        /// Search query (use keywords, not full sentences)
        query: String,
        /// Maximum number of results
        #[arg(long, default_value = "20")]
        limit: usize,
        /// Repository ID (defaults to current directory name)
        #[arg(long)]
        repo: Option<String>,
    },
    /// Launch the shared session viewer UI
    Ui {
        /// Port for the embedded UI server
        #[arg(long, default_value_t = 5175)]
        port: u16,
    },
}

struct Chunk {
    start: usize,
    end: usize,
    title: String,
    content: String,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.info {
        return cmd_info();
    }

    match cli.command {
        Some(Commands::Index) => cmd_index(),
        Some(Commands::Query { sql }) => cmd_query(&sql),
        Some(Commands::Map) => cmd_map(),
        Some(Commands::Search { query, limit, repo }) => cmd_search(&query, limit, repo.as_deref()),
        Some(Commands::Ui { port }) => cmd_ui(port),
        None => {
            use clap::CommandFactory;
            Cli::command().print_help().ok();
            println!();
            Ok(())
        }
    }
}

fn cmd_index() -> Result<()> {
    let root = env::current_dir().context("cannot determine cwd")?;
    let repo_id = root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("repo")
        .to_string();
    let dbp = db_path();
    ensure_db_dir(&dbp)?;

    let con = Connection::open(&dbp).with_context(|| format!("cannot open sqlite db {}", dbp.display()))?;
    ensure_schema(&con)?;

    con.execute(
        "DELETE FROM file_chunks_fts WHERE rowid IN (SELECT id FROM file_chunks WHERE repo_id=?)",
        params![&repo_id],
    )
    .context("failed to clear file_chunks_fts")?;

    for table in &["files", "modules", "dependencies", "entrypoints", "testids", "file_chunks"] {
        con.execute(&format!("DELETE FROM {} WHERE repo_id=?", table), params![&repo_id])
            .with_context(|| format!("failed to clear {}", table))?;
    }

    con.execute("DELETE FROM repositories WHERE repo_id=?", params![&repo_id])
        .context("failed to clear repository row")?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock before UNIX_EPOCH")?
        .as_secs() as i64;
    con.execute(
        "INSERT INTO repositories VALUES (?, ?, ?)",
        params![&repo_id, root.to_str().unwrap_or(""), now],
    )
    .context("failed to insert repository row")?;

    let import_re = Regex::new(
        r#"(?:import ([a-zA-Z0-9_.]+)|from ([a-zA-Z0-9_.]+) import|require\(['\"](.+?)['\"]\)|import .* from ['\"](.*?)['\"])"#,
    )?;
    let entrypoint_re = Regex::new(r#"(?:if __name__ == ['\"]__main__['\"]|app\.listen|FastAPI\(|main\()"#)?;
    let testid_re = Regex::new(r#"data-testid=['\"]([^'\"]+)['\"]"#)?;
    let testid_exts: HashSet<&str> = [".svelte", ".tsx", ".ts", ".jsx", ".js", ".html"].into_iter().collect();

    let mut chunk_count = 0u64;

    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() || is_ignored(path) || is_ext_ignored(path) {
            continue;
        }

        let metadata = fs::metadata(path).ok();
        if metadata.as_ref().map(|m| m.len()).unwrap_or(0) > MAX_FILE_SIZE {
            continue;
        }

        let rel_path = path.strip_prefix(&root).unwrap_or(path);
        let rel_str = rel_path.to_str().unwrap_or("");

        con.execute("INSERT INTO files VALUES (?, ?)", params![&repo_id, rel_str])
            .context("failed to insert file row")?;

        if has_null_bytes(path) {
            continue;
        }

        let text = match fs::read_to_string(path) {
            Ok(t) => t,
            Err(_) => continue,
        };

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let lang = detect_language(path);

        if matches!(ext, "py" | "ts" | "js") {
            let module = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            con.execute(
                "INSERT INTO modules VALUES (?, ?, ?)",
                params![&repo_id, &module, rel_str],
            )
            .context("failed to insert module")?;

            for cap in import_re.captures_iter(&text) {
                let dep = cap
                    .get(1)
                    .or_else(|| cap.get(2))
                    .or_else(|| cap.get(3))
                    .or_else(|| cap.get(4))
                    .map(|m| m.as_str())
                    .unwrap_or("");
                if !dep.is_empty() {
                    con.execute(
                        "INSERT INTO dependencies VALUES (?, ?, ?)",
                        params![&repo_id, &module, dep],
                    )
                    .context("failed to insert dependency")?;
                }
            }

            if entrypoint_re.is_match(&text) {
                con.execute("INSERT INTO entrypoints VALUES (?, ?)", params![&repo_id, rel_str])
                    .context("failed to insert entrypoint")?;
            }
        }

        let ext_dot = format!(".{}", ext);
        if testid_exts.contains(ext_dot.as_str()) {
            let component = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            for (i, line) in text.lines().enumerate() {
                for cap in testid_re.captures_iter(line) {
                    con.execute(
                        "INSERT INTO testids VALUES (?, ?, ?, ?, ?, ?)",
                        params![&repo_id, &cap[1], &component, rel_str, (i + 1) as i64, line.trim()],
                    )
                    .context("failed to insert testid")?;
                }
            }
        }

        let chunks = match lang {
            "markdown" => chunk_markdown(&text),
            "json" | "yaml" | "toml" | "text" => chunk_config(&text, rel_str),
            _ => chunk_code(&text, rel_str),
        };

        let kind = chunk_kind(lang);
        let pt = path_to_text(rel_str);

        for chunk in &chunks {
            let chunk_id = format!("{}::{}::{}-{}", repo_id, rel_str, chunk.start, chunk.end);
            let desc = generate_description(lang, rel_str, &chunk.title, chunk.start, chunk.end);
            let search_text = format!("{}\n{}\n{}\n{}", pt, chunk.title, desc, chunk.content);

            con.execute(
                "INSERT INTO file_chunks (chunk_id, repo_id, path, path_text, language, chunk_kind, chunk_start, chunk_end, title, description, content, search_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    &chunk_id,
                    &repo_id,
                    rel_str,
                    &pt,
                    lang,
                    kind,
                    chunk.start as i64,
                    chunk.end as i64,
                    &chunk.title,
                    &desc,
                    &chunk.content,
                    &search_text,
                ],
            )
            .context("failed to insert file chunk")?;

            let rowid = con.last_insert_rowid();
            con.execute(
                "INSERT INTO file_chunks_fts (rowid, chunk_id, repo_id, path, path_text, language, chunk_kind, chunk_start, chunk_end, title, description, content, search_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    rowid,
                    &chunk_id,
                    &repo_id,
                    rel_str,
                    &pt,
                    lang,
                    kind,
                    chunk.start as i64,
                    chunk.end as i64,
                    &chunk.title,
                    &desc,
                    &chunk.content,
                    &search_text,
                ],
            )
            .context("failed to index file chunk")?;

            chunk_count += 1;
        }
    }

    con.close().map_err(|(_, e)| e).context("failed to close sqlite connection")?;

    eprintln!("Indexed repo '{}' into {} ({} chunks)", repo_id, dbp.display(), chunk_count);
    Ok(())
}

fn cmd_info() -> Result<()> {
    let dbp = db_path();
    let metadata = fs::metadata(&dbp).ok();
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "db_path": dbp.display().to_string(),
            "exists": dbp.exists(),
            "size_bytes": metadata.as_ref().map(|m| m.len()).unwrap_or(0),
        }))?
    );
    Ok(())
}

fn cmd_query(sql: &str) -> Result<()> {
    let dbp = db_path();
    if !dbp.exists() {
        anyhow::bail!("Database not found: {}", dbp.display());
    }

    let con = Connection::open(&dbp).with_context(|| format!("cannot open sqlite db {}", dbp.display()))?;
    let mut stmt = con.prepare(sql).context("invalid SQL")?;
    let col_count = stmt.column_count();
    let rows = stmt
        .query_map([], |row| {
            let mut vals = Vec::new();
            for i in 0..col_count {
                let v = match row.get_ref(i)? {
                    ValueRef::Null => String::new(),
                    ValueRef::Integer(n) => n.to_string(),
                    ValueRef::Real(f) => f.to_string(),
                    ValueRef::Text(t) => String::from_utf8_lossy(t).into_owned(),
                    ValueRef::Blob(_) => String::from("[blob]"),
                };
                vals.push(v);
            }
            Ok(vals)
        })
        .context("query failed")?;

    for row in rows {
        if let Ok(vals) = row {
            println!("{}", vals.join("\t"));
        }
    }

    Ok(())
}

fn cmd_search(query: &str, limit: usize, repo: Option<&str>) -> Result<()> {
    let dbp = db_path();
    if !dbp.exists() {
        anyhow::bail!("Database not found: {}. Run `project_index index` first.", dbp.display());
    }

    let con = Connection::open(&dbp).with_context(|| format!("cannot open sqlite db {}", dbp.display()))?;
    let repo_id = match repo {
        Some(r) => r.to_string(),
        None => env::current_dir()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_str().unwrap_or("").to_string()))
            .unwrap_or_default(),
    };

    let cleaned = extract_keywords(query)?;
    let search_query = format!("{} {}", query, cleaned).trim().to_string();

    let sql = r#"
        SELECT f.path, f.chunk_start, f.chunk_end, f.title, f.description, substr(f.content, 1, 500) AS snippet, bm25(file_chunks_fts) AS score
        FROM file_chunks_fts
        JOIN file_chunks f ON file_chunks_fts.rowid = f.id
        WHERE file_chunks_fts MATCH ? AND f.repo_id = ?
        ORDER BY score ASC
        LIMIT ?
    "#;

    let mut stmt = con.prepare(sql).context("FTS query failed")?;
    let rows = stmt
        .query_map(params![&search_query, &repo_id, limit as i64], |row| {
            let path: String = row.get(0)?;
            let start: i64 = row.get(1)?;
            let end: i64 = row.get(2)?;
            let title: String = row.get(3)?;
            let desc: String = row.get(4)?;
            let snippet: String = row.get(5)?;
            let score: f64 = row.get(6)?;
            Ok((path, start, end, title, desc, snippet, score))
        })
        .context("search failed")?;

    let mut found = false;
    for row in rows {
        if let Ok((path, start, end, _title, desc, snippet, score)) = row {
            found = true;
            println!("{}:{}-{}", path, start, end);
            println!("score: {:.2}", score);
            println!("{}", desc);
            println!();
            let preview: String = snippet.lines().take(5).collect::<Vec<_>>().join("\n");
            println!("{}", preview);
            println!("---");
        }
    }

    if !found {
        println!("No results found for: {}", query);
    }

    Ok(())
}

fn cmd_ui(port: u16) -> Result<()> {
    ui_server::start(ui_server::ServerConfig {
        port,
        session_db_path: Some(session_db_path()),
        memory_db_path: Some(memory_db_path()),
        index_db_path: Some(db_path()),
        open_browser: true,
    })
}

fn cmd_map() -> Result<()> {
    let root = env::current_dir().context("cannot determine cwd")?;
    let out = root.join(".repo-map");
    fs::create_dir_all(&out).context("failed to create .repo-map")?;

    let import_re = Regex::new(
        r#"(?:import ([a-zA-Z0-9_.]+)|from ([a-zA-Z0-9_.]+) import|require\(['\"](.+?)['\"]\)|import .* from ['\"](.*?)['\"])"#,
    )?;
    let entrypoint_re = Regex::new(r#"(?:if __name__ == ['\"]__main__['\"]|app\.listen|FastAPI\(|main\()"#)?;

    let mut all_files = Vec::new();
    let mut modules = Vec::new();
    let mut deps = Vec::new();
    let mut entrypoints = Vec::new();
    let mut languages = HashSet::new();
    let mut frameworks = HashSet::new();

    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() || is_ignored(path) {
            continue;
        }

        let rel = path.strip_prefix(&root).unwrap_or(path);
        let rel_str = rel.to_str().unwrap_or("").to_string();
        all_files.push(rel_str.clone());

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        match ext {
            "py" => {
                languages.insert("python");
            }
            "js" | "ts" => {
                languages.insert("javascript");
            }
            _ => {}
        }
        if path.file_name().map(|n| n == "package.json").unwrap_or(false) {
            frameworks.insert("node");
        }
        if path.file_name().map(|n| n == "pyproject.toml").unwrap_or(false) {
            frameworks.insert("python-project");
        }

        if !matches!(ext, "py" | "ts" | "js") {
            continue;
        }

        let module = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        modules.push(json!({"name": module, "path": rel_str}));

        let text = match fs::read_to_string(path) {
            Ok(t) => t,
            Err(_) => continue,
        };

        for cap in import_re.captures_iter(&text) {
            let dep = cap
                .get(1)
                .or_else(|| cap.get(2))
                .or_else(|| cap.get(3))
                .or_else(|| cap.get(4))
                .map(|m| m.as_str())
                .unwrap_or("");
            if !dep.is_empty() {
                deps.push(json!({"from": module, "to": dep}));
            }
        }

        if entrypoint_re.is_match(&text) {
            entrypoints.push(rel_str);
        }
    }

    let stack = json!({
        "languages": languages.into_iter().collect::<Vec<_>>(),
        "frameworks": frameworks.into_iter().collect::<Vec<_>>(),
    });

    fs::write(out.join("files.json"), serde_json::to_string_pretty(&all_files)?)
        .context("failed to write files.json")?;
    fs::write(out.join("modules.json"), serde_json::to_string_pretty(&modules)?)
        .context("failed to write modules.json")?;
    fs::write(out.join("entrypoints.json"), serde_json::to_string_pretty(&entrypoints)?)
        .context("failed to write entrypoints.json")?;
    fs::write(
        out.join("graph.json"),
        serde_json::to_string_pretty(&json!({"modules": &modules, "dependencies": &deps}))?,
    )
    .context("failed to write graph.json")?;
    fs::write(out.join("stack.json"), serde_json::to_string_pretty(&stack)?)
        .context("failed to write stack.json")?;

    let mut dot = String::from("digraph repo {\n  rankdir=LR;\n  node [shape=box];\n");
    for m in &modules {
        dot.push_str(&format!("  \"{}\";\n", m["name"].as_str().unwrap_or("")));
    }
    for d in &deps {
        let from = d["from"].as_str().unwrap_or("");
        let to = d["to"].as_str().unwrap_or("");
        if !from.is_empty() && !to.is_empty() {
            dot.push_str(&format!("  \"{}\" -> \"{}\";\n", from, to));
        }
    }
    dot.push_str("}\n");
    fs::write(out.join("dependency-graph.dot"), dot).context("failed to write dependency graph")?;

    eprintln!("Repo map generated in .repo-map/");
    Ok(())
}

fn ensure_schema(con: &Connection) -> Result<()> {
    con.execute_batch(DEFAULT_SCHEMA)
        .context("failed to initialize schema")?;
    Ok(())
}

fn db_path() -> PathBuf {
    if let Ok(p) = env::var("PROJECT_INDEX_DB") {
        PathBuf::from(p)
    } else if let Ok(p) = env::var("AGENT_REPO_IDX_DB") {
        PathBuf::from(p)
    } else {
        let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".local/state/opencode-custom-tools/repos.sqlite")
    }
}

fn ensure_db_dir(p: &Path) -> Result<()> {
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    Ok(())
}

fn session_db_path() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".claude/projects/sessions.db")
}

fn memory_db_path() -> PathBuf {
    env::var("AGENT_MEMORY_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(".local/state/agent-tools/memory.db")
        })
}

fn is_ignored(path: &Path) -> bool {
    path.components().any(|c| {
        if let std::path::Component::Normal(s) = c {
            IGNORE_DIRS.contains(&s.to_str().unwrap_or(""))
        } else {
            false
        }
    })
}

fn is_ext_ignored(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let ext = format!(".{}", e.to_lowercase());
            IGNORED_FILE_TYPES.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

fn has_null_bytes(path: &Path) -> bool {
    fs::read(path)
        .map(|bytes| bytes.iter().take(512).any(|&b| b == 0))
        .unwrap_or(true)
}

fn detect_language(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("py") => "python",
        Some("lua") => "lua",
        Some("ts" | "tsx") => "typescript",
        Some("js" | "jsx") => "javascript",
        Some("rs") => "rust",
        Some("zsh" | "sh" | "bash") => "shell",
        Some("md") => "markdown",
        Some("json") => "json",
        Some("yml" | "yaml") => "yaml",
        Some("toml") => "toml",
        Some("sql") => "sql",
        Some("html" | "htm") => "html",
        Some("css" | "scss") => "css",
        Some("svelte") => "svelte",
        _ => "text",
    }
}

fn chunk_kind(lang: &str) -> &'static str {
    match lang {
        "markdown" => "markdown",
        "json" | "yaml" | "toml" => "config",
        "sql" => "sql",
        "text" => "text",
        _ => "code",
    }
}

fn path_to_text(path: &str) -> String {
    path.replace('/', " ")
        .replace('.', " ")
        .replace('-', " ")
        .replace('_', " ")
}

fn stop_words() -> HashSet<&'static str> {
    [
        "the", "a", "an", "that", "which", "how", "does", "do", "is", "are", "for", "to", "in",
        "of", "where", "what", "find", "show", "me", "function", "file", "code", "this", "it",
        "and", "or", "but", "not", "with", "from", "by", "on", "at", "be", "has", "have", "was",
        "were", "been", "will", "would", "could", "should", "can",
    ]
    .into_iter()
    .collect()
}

fn extract_keywords(query: &str) -> Result<String> {
    let stops = stop_words();
    let re = Regex::new(r"[a-zA-Z_][a-zA-Z0-9_]*")?;
    let cleaned: Vec<&str> = re
        .find_iter(query)
        .map(|m| m.as_str())
        .filter(|w| !stops.contains(&w.to_lowercase().as_str()))
        .collect();

    Ok(if cleaned.is_empty() { query.to_string() } else { cleaned.join(" ") })
}

fn generate_description(lang: &str, path: &str, title: &str, start: usize, end: usize) -> String {
    match lang {
        "markdown" => {
            if title.is_empty() {
                format!("Markdown chunk in {} around lines {}-{}", path, start, end)
            } else {
                format!("Markdown section \"{}\" in {}", title, path)
            }
        }
        "json" | "yaml" | "toml" => format!("{} config chunk in {} around lines {}-{}", lang, path, start, end),
        _ => {
            if title.is_empty()
                || title == Path::new(path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
            {
                format!("{} code chunk in {} around lines {}-{}", lang, path, start, end)
            } else {
                format!("{} function {} in {} around lines {}-{}", lang, title, path, start, end)
            }
        }
    }
}

fn chunk_markdown(text: &str) -> Vec<Chunk> {
    let lines: Vec<&str> = text.lines().collect();
    let mut chunks = Vec::new();
    let mut current_start = 0usize;
    let mut current_title = String::new();
    let mut current_lines: Vec<&str> = Vec::new();

    for (i, line) in lines.iter().enumerate() {
        if line.starts_with('#') && !current_lines.is_empty() {
            chunks.push(Chunk {
                start: current_start + 1,
                end: i,
                title: current_title.clone(),
                content: current_lines.join("\n"),
            });
            current_lines.clear();
            current_start = i;
            current_title = line.trim_start_matches('#').trim().to_string();
        } else if line.starts_with('#') && current_lines.is_empty() {
            current_start = i;
            current_title = line.trim_start_matches('#').trim().to_string();
        }
        current_lines.push(line);
    }

    if !current_lines.is_empty() {
        chunks.push(Chunk {
            start: current_start + 1,
            end: lines.len(),
            title: current_title,
            content: current_lines.join("\n"),
        });
    }

    chunks
}

fn chunk_code(text: &str, path: &str) -> Vec<Chunk> {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let target = 80;
    let overlap = 10;
    let mut chunks = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        let mut end = (i + target).min(lines.len());

        if end < lines.len() {
            let search_start = if end > 10 { end - 10 } else { i };
            for j in (search_start..end).rev() {
                if lines[j].trim().is_empty() {
                    end = j + 1;
                    break;
                }
            }
        }

        let chunk_lines = &lines[i..end];
        let content = chunk_lines.join("\n");
        let title = extract_title_from_code(chunk_lines).unwrap_or_else(|| {
            Path::new(path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string()
        });

        chunks.push(Chunk {
            start: i + 1,
            end,
            title,
            content,
        });

        if end >= lines.len() {
            break;
        }
        i = if end > overlap { end - overlap } else { end };
    }

    chunks
}

fn extract_title_from_code(lines: &[&str]) -> Option<String> {
    let fn_re = Regex::new(
        r"(?:def|fn|func|function|async function|export function|export default function|export const|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    )
    .ok()?;
    let class_re = Regex::new(r"(?:class|struct|enum|trait|impl)\s+([a-zA-Z_][a-zA-Z0-9_]*)").ok()?;

    for line in lines.iter().take(20) {
        if let Some(cap) = class_re.captures(line) {
            return Some(cap[1].to_string());
        }
        if let Some(cap) = fn_re.captures(line) {
            return Some(cap[1].to_string());
        }
    }

    None
}

fn chunk_config(text: &str, path: &str) -> Vec<Chunk> {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let target = 60;
    let mut chunks = Vec::new();
    let mut i = 0;
    let filename = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    while i < lines.len() {
        let end = (i + target).min(lines.len());
        let chunk_lines = &lines[i..end];
        chunks.push(Chunk {
            start: i + 1,
            end,
            title: filename.clone(),
            content: chunk_lines.join("\n"),
        });
        i = end;
    }

    chunks
}
