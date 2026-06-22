use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use anyhow::{Context, Result};
use rusqlite::{params, types::ValueRef, Connection, Row, ToSql};
use rust_embed::RustEmbed;
use serde::Serialize;
use serde_json::json;
use tiny_http::{Header, Request, Response, Server, StatusCode};
use url::Url;

#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub port: u16,
    pub session_db_path: Option<PathBuf>,
    pub memory_db_path: Option<PathBuf>,
    pub index_db_path: Option<PathBuf>,
    pub open_browser: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 5175,
            session_db_path: None,
            memory_db_path: None,
            index_db_path: None,
            open_browser: true,
        }
    }
}

#[derive(RustEmbed)]
#[folder = "../../ui/dist"]
struct Assets;

#[derive(Serialize)]
struct ErrorPayload {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<serde_json::Value>,
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

#[derive(Serialize)]
struct MemoryStats {
    total: usize,
    #[serde(rename = "byCategory")]
    by_category: BTreeMap<String, usize>,
    latest: Option<String>,
    oldest: Option<String>,
}

#[derive(Serialize)]
struct SessionSummary {
    id: String,
    title: String,
    agent: Option<String>,
    directory: Option<String>,
    time_created: Option<String>,
    time_updated: Option<String>,
    slug: Option<String>,
    model: Option<String>,
    cost: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct SessionMessage {
    id: String,
    session_id: String,
    #[serde(rename = "type")]
    message_type: Option<String>,
    time_created: Option<String>,
    time_updated: Option<String>,
    #[serde(rename = "rawData")]
    raw_data: String,
    #[serde(rename = "parsedData")]
    parsed_data: Option<serde_json::Value>,
    #[serde(rename = "parseError")]
    parse_error: Option<String>,
}

#[derive(Serialize)]
struct SessionTranscript {
    session: Option<SessionSummary>,
    session_messages: Vec<SessionMessage>,
}

#[derive(Serialize)]
struct IndexRepository {
    repo_id: String,
    path: String,
    indexed_at: i64,
}

#[derive(Serialize)]
struct IndexFile {
    path: String,
}

#[derive(Serialize)]
struct IndexModule {
    module: String,
    path: String,
}

#[derive(Serialize)]
struct IndexDependency {
    source_module: String,
    dependency: String,
}

#[derive(Serialize)]
struct IndexEntrypoint {
    path: String,
}

#[derive(Serialize)]
struct IndexTestId {
    testid: String,
    component: String,
    filepath: String,
    line: i64,
    context: String,
}

#[derive(Serialize)]
struct IndexSearchResult {
    path: String,
    chunk_start: i64,
    chunk_end: i64,
    title: String,
    description: String,
    snippet: String,
}

#[derive(Serialize)]
struct IndexQueryResult {
    values: Vec<String>,
}

pub fn start(config: ServerConfig) -> Result<()> {
    let config = Arc::new(config);
    let addr = format!("127.0.0.1:{}", config.port);
    let server = Server::http(&addr).map_err(|err| anyhow::anyhow!("failed to bind {addr}: {err}"))?;
    let url = format!("http://{addr}/");

    eprintln!("UI server listening on {url}");

    if config.open_browser {
        let _ = open::that(&url);
    }

    for request in server.incoming_requests() {
        let config = Arc::clone(&config);
        thread::spawn(move || {
            if let Err(err) = handle_request(request, config) {
                eprintln!("ui-server error: {err:#}");
            }
        });
    }

    Ok(())
}

fn handle_request(request: Request, config: Arc<ServerConfig>) -> Result<()> {
    let method = request.method().as_str();
    let url = Url::parse(&format!("http://127.0.0.1{}", request.url()))?;
    let path = url.path();

    if path.starts_with("/api/") {
        if method != "GET" {
            return send_error(request, 405, "Method not allowed", None);
        }
        return handle_api(request, &url, config);
    }

    serve_asset(request, path)
}

fn handle_api(request: Request, url: &Url, config: Arc<ServerConfig>) -> Result<()> {
    let path = url.path();
    let params: Vec<(String, String)> = url
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    let query = |name: &str| -> Option<String> {
        params.iter().find(|(k, _)| k == name).map(|(_, v)| v.clone())
    };

    match path {
        "/api/sessions" => {
            let limit = parse_limit(query("limit").as_deref(), 200, 1000)?;
            let sessions = read_sessions(&config, query("session_id"), query("agent"), query("directory"), limit)?;
            send_json(request, 200, &json!({"sessions": sessions}))
        }
        "/api/memory" => {
            let limit = parse_limit(query("limit").as_deref(), 20, 1000)?;
            let recent = query("recent").and_then(|value| value.parse::<i64>().ok());
            let memories = query_memories(
                config.memory_db_path.as_deref(),
                query("category"),
                query("tags"),
                query("search"),
                recent,
                limit,
            )?;
            send_json(request, 200, &json!({"memories": memories}))
        }
        "/api/memory/stats" => send_json(request, 200, &get_memory_stats(config.memory_db_path.as_deref())?),
        "/api/index/repositories" => send_json(request, 200, &json!({"repositories": list_repositories(config.index_db_path.as_deref())?})),
        "/api/index/files" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            let limit = parse_limit(query("limit").as_deref(), 200, 1000)?;
            send_json(request, 200, &json!({"files": list_files(config.index_db_path.as_deref(), &repo, limit)?}))
        }
        "/api/index/modules" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            send_json(request, 200, &json!({"modules": list_modules(config.index_db_path.as_deref(), &repo)?}))
        }
        "/api/index/dependencies" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            send_json(request, 200, &json!({"dependencies": list_dependencies(config.index_db_path.as_deref(), &repo)?}))
        }
        "/api/index/entrypoints" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            send_json(request, 200, &json!({"entrypoints": list_entrypoints(config.index_db_path.as_deref(), &repo)?}))
        }
        "/api/index/testids" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            send_json(request, 200, &json!({"testids": list_testids(config.index_db_path.as_deref(), &repo)?}))
        }
        "/api/index/search" => {
            let repo = require_param(query("repo"), "Missing repo")?;
            let q = require_param(query("q"), "Missing query")?;
            let limit = parse_limit(query("limit").as_deref(), 20, 1000)?;
            send_json(request, 200, &json!({"results": search_index(config.index_db_path.as_deref(), &repo, &q, limit)?}))
        }
        "/api/index/query" => {
            let sql = require_param(query("sql"), "Missing SQL")?;
            send_json(request, 200, &json!({"rows": run_raw_query(config.index_db_path.as_deref(), &sql)?}))
        }
        _ => {
            if let Some(session_id) = path.strip_prefix("/api/sessions/").and_then(|rest| rest.strip_suffix("/messages")) {
                let session_id = percent_decode(session_id)?;
                if session_id.trim().is_empty() {
                    return send_error(request, 400, "Missing session id", None);
                }
                let transcript = read_transcript(config.session_db_path.as_deref(), session_id.trim())?
                    .unwrap_or_else(|| SessionTranscript { session: None, session_messages: Vec::new() });
                return send_json(request, 200, &transcript);
            }

            send_error(request, 404, "Not found", None)
        }
    }
}

fn serve_asset(request: Request, path: &str) -> Result<()> {
    let normalized = if path == "/" { "index.html" } else { path.trim_start_matches('/') };
    let asset = Assets::get(normalized).or_else(|| Assets::get("index.html"));

    if let Some(content) = asset {
        let mime = content_type(normalized);
        let mut response = Response::from_data(content.data.into_owned());
        response.add_header(Header::from_bytes("Content-Type", mime).expect("valid header"));
        return request.respond(response).context("failed to serve asset");
    }

    send_error(request, 404, "Not found", None)
}

fn send_json<T: Serialize>(request: Request, status: u16, payload: &T) -> Result<()> {
    let body = serde_json::to_vec(payload)?;
    let mut response = Response::from_data(body);
    response = response.with_status_code(StatusCode(status));
    response.add_header(Header::from_bytes(
        "Content-Type",
        "application/json; charset=utf-8",
    )
    .expect("valid header"));
    request.respond(response).context("failed to send json")?;
    Ok(())
}

fn send_error(request: Request, status: u16, message: &str, details: Option<serde_json::Value>) -> Result<()> {
    let payload = ErrorPayload {
        error: ErrorDetail {
            message: message.to_string(),
            details,
        },
    };
    send_json(request, status, &payload)
}

fn require_param(value: Option<String>, message: &str) -> Result<String> {
    let value = value.ok_or_else(|| anyhow::anyhow!("{}", message.to_string()))?;
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        anyhow::bail!("{}", message);
    }
    Ok(trimmed.to_string())
}

fn parse_limit(value: Option<&str>, default: i64, max: i64) -> Result<i64> {
    let parsed = value.and_then(|raw| raw.parse::<i64>().ok()).unwrap_or(default);
    if parsed <= 0 {
        return Ok(default);
    }
    Ok(parsed.min(max))
}

fn percent_decode(value: &str) -> Result<String> {
    urlencoding::decode(value)
        .map(|decoded| decoded.into_owned())
        .map_err(|err| anyhow::anyhow!("invalid path segment: {err}"))
}

fn content_type(path: &str) -> &'static str {
    match Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn open_db(path: Option<&Path>) -> Result<Connection> {
    let path = path.ok_or_else(|| anyhow::anyhow!("database path not configured"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    }
    Connection::open(path).with_context(|| format!("failed to open {}", path.display()))
}

fn table_exists(db: &Connection, table: &str) -> Result<bool> {
    let exists = db.query_row(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        params![table],
        |_| Ok(true),
    );
    match exists {
        Ok(true) => Ok(true),
        Ok(false) => Ok(false),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(err) => Err(err.into()),
    }
}

fn read_sessions(
    config: &ServerConfig,
    session_id: Option<String>,
    agent: Option<String>,
    directory: Option<String>,
    limit: i64,
) -> Result<Vec<SessionSummary>> {
    let db = open_db(config.session_db_path.as_deref())?;
    let mut conditions = Vec::new();
    let mut values: Vec<String> = Vec::new();

    if let Some(value) = session_id {
        let value = value.trim();
        if !value.is_empty() {
            conditions.push("CAST(id AS TEXT) LIKE ?".to_string());
            values.push(format!("%{}%", value));
        }
    }
    if let Some(value) = agent {
        let value = value.trim();
        if !value.is_empty() {
            conditions.push("agent LIKE ?".to_string());
            values.push(format!("%{}%", value));
        }
    }
    if let Some(value) = directory {
        let value = value.trim();
        if !value.is_empty() {
            conditions.push("directory LIKE ?".to_string());
            values.push(format!("%{}%", value));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT CAST(id AS TEXT), title, agent, directory, time_created, time_updated, slug, model, cost FROM session {} ORDER BY time_created DESC LIMIT ?",
        where_clause
    );
    let mut stmt = db.prepare(&sql)?;
    let mut params: Vec<&dyn ToSql> = values.iter().map(|v| v as &dyn ToSql).collect();
    params.push(&limit);
    let rows = stmt.query_map(params.as_slice(), session_summary_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn session_summary_row(row: &Row<'_>) -> rusqlite::Result<SessionSummary> {
    Ok(SessionSummary {
        id: row.get(0)?,
        title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        agent: row.get(2)?,
        directory: row.get(3)?,
        time_created: timestamp_to_string(row.get_ref(4)?),
        time_updated: timestamp_to_string(row.get_ref(5)?),
        slug: row.get(6)?,
        model: row.get(7)?,
        cost: match row.get_ref(8)? {
            ValueRef::Null => None,
            ValueRef::Integer(n) => Some(json!(n)),
            ValueRef::Real(f) => Some(json!(f)),
            ValueRef::Text(t) => Some(json!(String::from_utf8_lossy(t).to_string())),
            ValueRef::Blob(_) => None,
        },
    })
}

fn timestamp_to_string(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Integer(n) => Some(n.to_string()),
        ValueRef::Real(n) => Some(n.to_string()),
        ValueRef::Text(t) => Some(String::from_utf8_lossy(t).to_string()),
        ValueRef::Blob(_) => None,
    }
}

fn read_transcript(db_path: Option<&Path>, session_id: &str) -> Result<Option<SessionTranscript>> {
    let db_path = db_path.map(Path::to_path_buf).or_else(discover_session_db_path);
    let db_path = match db_path {
        Some(path) => path,
        None => return Ok(None),
    };
    let db = open_db(Some(db_path.as_path()))?;
    let session = db
        .query_row(
            "SELECT CAST(id AS TEXT), title, agent, directory, time_created, time_updated, slug, model, cost FROM session WHERE CAST(id AS TEXT) = ?",
            params![session_id],
            session_summary_row,
        )
        .ok();
    let mut parts_stmt = db.prepare(
        "SELECT p.message_id, p.data FROM part p WHERE p.session_id = ? ORDER BY p.time_created ASC",
    )?;
    let mut parts_by_msg: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
    for row in parts_stmt.query_map(params![session_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (msg_id, data_str) = row?;
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&data_str) {
            parts_by_msg.entry(msg_id).or_default().push(data);
        }
    }

    let mut msg_stmt = db.prepare(
        "SELECT CAST(id AS TEXT), data, time_created, time_updated FROM message m WHERE m.session_id = ? ORDER BY m.time_created ASC",
    )?;

    let mut transcript = Vec::new();
    for row in msg_stmt.query_map(params![session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            timestamp_to_string(row.get_ref(2)?),
            timestamp_to_string(row.get_ref(3)?),
        ))
    })? {
        let (msg_id, data_str, time_created, time_updated) = row?;
        let data: serde_json::Value = match serde_json::from_str(&data_str) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let mut entry = serde_json::Map::new();
        entry.insert("role".into(), data.get("role").cloned().unwrap_or(serde_json::Value::Null));
        entry.insert("agent".into(), data.get("agent").cloned().unwrap_or(serde_json::Value::Null));
        let mut content_parts = Vec::new();

        for part in parts_by_msg.get(&msg_id).cloned().unwrap_or_default() {
            match part.get("type").and_then(serde_json::Value::as_str) {
                Some("text") => {
                    content_parts.push(json!({
                        "type": "text",
                        "text": part.get("text").and_then(serde_json::Value::as_str).unwrap_or("").chars().take(2000).collect::<String>()
                    }));
                }
                Some("tool") => {
                    let state = part.get("state").cloned().unwrap_or(serde_json::Value::Object(Default::default()));
                    content_parts.push(json!({
                        "type": "tool-call",
                        "tool": part.get("tool").and_then(serde_json::Value::as_str).unwrap_or("?"),
                        "status": state.get("status").and_then(serde_json::Value::as_str).unwrap_or("?"),
                        "args_preview": state.get("input").map(|v| v.to_string()).unwrap_or_default().chars().take(200).collect::<String>(),
                        "result_preview": state.get("output").map(|v| v.to_string()).unwrap_or_default().chars().take(300).collect::<String>(),
                    }));
                }
                Some("reasoning") => {
                    content_parts.push(json!({
                        "type": "reasoning",
                        "text": part.get("text").and_then(serde_json::Value::as_str).unwrap_or("").chars().take(2000).collect::<String>()
                    }));
                }
                _ => {}
            }
        }

        entry.insert("parts".into(), serde_json::Value::Array(content_parts));
        if let Some(finish) = data.get("finish") {
            entry.insert("finish".into(), finish.clone());
        }

        let raw_data = serde_json::Value::Object(entry.clone()).to_string();
        transcript.push(SessionMessage {
            id: format!("{}:{}", session_id, transcript.len() + 1),
            session_id: session_id.to_string(),
            message_type: entry.get("role").and_then(serde_json::Value::as_str).map(str::to_string),
            time_created,
            time_updated,
            raw_data,
            parsed_data: Some(serde_json::Value::Object(entry)),
            parse_error: None,
        });
    }

    Ok(Some(SessionTranscript {
        session,
        session_messages: transcript,
    }))
}

fn discover_session_db_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let config = home.join(".config/session_reader/config.json");
    if let Ok(text) = fs::read_to_string(&config) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(path) = value.get("db_path").and_then(serde_json::Value::as_str) {
                let path = expand_home(path);
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    let presets = [
        home.join(".local/share/opencode/opencode.db"),
        home.join("Library/Application Support/Cursor/User/globalStorage/state.vscdb"),
        home.join(".config/Cursor/User/globalStorage/state.vscdb"),
        home.join("Library/Application Support/Windsurf/User/globalStorage/state.vscdb"),
        home.join(".config/Windsurf/User/globalStorage/state.vscdb"),
    ];

    presets.into_iter().find(|path| path.exists())
}

fn expand_home(path: &str) -> PathBuf {
    let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    if path == "~" {
        return home;
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return home.join(rest);
    }
    PathBuf::from(path)
}

fn query_memories(
    db_path: Option<&Path>,
    category: Option<String>,
    tags: Option<String>,
    search: Option<String>,
    recent: Option<i64>,
    limit: i64,
) -> Result<Vec<MemoryEntry>> {
    let db = open_db(db_path)?;

    if let Some(recent) = recent {
        let mut stmt = db.prepare("SELECT * FROM agent_memory ORDER BY created_at DESC LIMIT ?")?;
        let rows = stmt.query_map(params![recent], memory_row)?;
        return Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?);
    }

    let mut conditions = Vec::new();
    let mut values: Vec<String> = Vec::new();

    if let Some(category) = category {
        let category = category.trim();
        if !category.is_empty() {
            conditions.push("l.category = ?".to_string());
            values.push(category.to_string());
        }
    }

    if let Some(tags) = tags {
        for tag in tags.split(',').map(str::trim).filter(|tag| !tag.is_empty()) {
            conditions.push("l.tags LIKE ?".to_string());
            values.push(format!("%{}%", tag));
        }
    }

    if let Some(search) = search {
        let mut stmt = db.prepare("SELECT rowid FROM agent_memory_fts WHERE agent_memory_fts MATCH ?")?;
        let ids = stmt
            .query_map(params![search], |row| row.get::<_, i64>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let id_list = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
        conditions.push(format!("l.id IN ({id_list})"));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!("SELECT * FROM agent_memory l {} ORDER BY l.created_at DESC LIMIT ?", where_clause);
    let mut stmt = db.prepare(&sql)?;
    let mut values_refs: Vec<&dyn ToSql> = values.iter().map(|v| v as &dyn ToSql).collect();
    values_refs.push(&limit);
    let rows = stmt.query_map(values_refs.as_slice(), memory_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn memory_row(row: &Row<'_>) -> rusqlite::Result<MemoryEntry> {
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

fn get_memory_stats(db_path: Option<&Path>) -> Result<MemoryStats> {
    let memories = query_memories(db_path, None, None, None, Some(1000), 1000)?;
    let mut by_category = BTreeMap::new();
    for entry in &memories {
        *by_category.entry(entry.category.clone()).or_insert(0) += 1;
    }
    Ok(MemoryStats {
        total: memories.len(),
        by_category,
        latest: memories.first().map(|m| m.created_at.clone()),
        oldest: memories.last().map(|m| m.created_at.clone()),
    })
}

fn list_repositories(db_path: Option<&Path>) -> Result<Vec<IndexRepository>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "repositories")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT repo_id, path, indexed_at FROM repositories ORDER BY indexed_at DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(IndexRepository {
            repo_id: row.get(0)?,
            path: row.get(1)?,
            indexed_at: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_files(db_path: Option<&Path>, repo_id: &str, limit: i64) -> Result<Vec<IndexFile>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "files")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT path FROM files WHERE repo_id = ? ORDER BY path LIMIT ?")?;
    let rows = stmt.query_map(params![repo_id, limit], |row| Ok(IndexFile { path: row.get(0)? }))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_modules(db_path: Option<&Path>, repo_id: &str) -> Result<Vec<IndexModule>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "modules")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT module, path FROM modules WHERE repo_id = ? ORDER BY module")?;
    let rows = stmt.query_map(params![repo_id], |row| {
        Ok(IndexModule {
            module: row.get(0)?,
            path: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_dependencies(db_path: Option<&Path>, repo_id: &str) -> Result<Vec<IndexDependency>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "dependencies")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT source_module, dependency FROM dependencies WHERE repo_id = ? ORDER BY source_module, dependency")?;
    let rows = stmt.query_map(params![repo_id], |row| {
        Ok(IndexDependency {
            source_module: row.get(0)?,
            dependency: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_entrypoints(db_path: Option<&Path>, repo_id: &str) -> Result<Vec<IndexEntrypoint>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "entrypoints")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT path FROM entrypoints WHERE repo_id = ? ORDER BY path")?;
    let rows = stmt.query_map(params![repo_id], |row| Ok(IndexEntrypoint { path: row.get(0)? }))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_testids(db_path: Option<&Path>, repo_id: &str) -> Result<Vec<IndexTestId>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "testids")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare("SELECT testid, component, filepath, line, context FROM testids WHERE repo_id = ? ORDER BY filepath, line")?;
    let rows = stmt.query_map(params![repo_id], |row| {
        Ok(IndexTestId {
            testid: row.get(0)?,
            component: row.get(1)?,
            filepath: row.get(2)?,
            line: row.get(3)?,
            context: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn search_index(db_path: Option<&Path>, repo_id: &str, query: &str, limit: i64) -> Result<Vec<IndexSearchResult>> {
    let db = open_db(db_path)?;
    if !table_exists(&db, "file_chunks_fts")? || !table_exists(&db, "file_chunks")? {
        return Ok(Vec::new());
    }
    let mut stmt = db.prepare(
        "SELECT f.path, f.chunk_start, f.chunk_end, f.title, f.description, substr(f.content, 1, 500) AS snippet FROM file_chunks_fts JOIN file_chunks f ON file_chunks_fts.rowid = f.id WHERE file_chunks_fts MATCH ? AND f.repo_id = ? ORDER BY bm25(file_chunks_fts) ASC LIMIT ?",
    )?;
    let rows = stmt.query_map(params![query, repo_id, limit], |row| {
        Ok(IndexSearchResult {
            path: row.get(0)?,
            chunk_start: row.get(1)?,
            chunk_end: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            snippet: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn run_raw_query(db_path: Option<&Path>, sql: &str) -> Result<Vec<IndexQueryResult>> {
    let trimmed = sql.trim();
    if !trimmed.starts_with("SELECT") && !trimmed.starts_with("WITH") {
        anyhow::bail!("Refusing to execute non-read-only SQL");
    }
    if trimmed.contains(';') {
        anyhow::bail!("Refusing to execute non-read-only SQL");
    }
    let db = open_db(db_path)?;
    let mut stmt = db.prepare(trimmed)?;
    let col_count = stmt.column_count();
    let rows = stmt.query_map([], move |row| {
        let mut values = Vec::new();
        for i in 0..col_count {
            let value = match row.get_ref(i)? {
                ValueRef::Null => String::new(),
                ValueRef::Integer(n) => n.to_string(),
                ValueRef::Real(n) => n.to_string(),
                ValueRef::Text(bytes) => String::from_utf8_lossy(bytes).into_owned(),
                ValueRef::Blob(_) => String::from("[blob]"),
            };
            values.push(value);
        }
        Ok(IndexQueryResult { values })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}
