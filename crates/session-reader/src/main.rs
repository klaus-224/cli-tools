use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

use anyhow::{Context, Result};
use chrono::Utc;
use clap::{CommandFactory, Parser, Subcommand};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const DEFAULT_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS flagged_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    blocker_reason TEXT NOT NULL,
    flagged_at TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    notes TEXT
);
"#;

#[derive(Parser)]
#[command(name = "session_reader", about = "Extract session transcripts from an agent's SQLite session DB for review.")]
struct Cli {
    #[arg(long, alias = "setup")]
    reconfigure: bool,

    #[command(subcommand)]
    cmd: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    List {
        #[arg(long)]
        search: Option<String>,
        #[arg(long, default_value_t = 20)]
        limit: i64,
    },
    Transcript {
        session_id: String,
    },
    #[command(name = "flag-current")]
    FlagCurrent {
        #[arg(long, help = "Agent name (e.g., regression-writer)")]
        agent: String,
        #[arg(long, help = "Blocker reason")]
        reason: String,
    },
    Rename {
        session_id: String,
        #[arg(long)]
        title: String,
    },
    #[command(name = "list-flagged")]
    ListFlagged {
        #[arg(long)]
        pending_only: bool,
        #[arg(long)]
        resolved_only: bool,
    },
    Resolve {
        session_id: String,
        #[arg(long)]
        notes: Option<String>,
    },
    Ui {
        /// Port for the embedded UI server
        #[arg(long, default_value_t = 5175)]
        port: u16,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    db_path: String,
    agent: String,
}

#[derive(Debug, Serialize)]
struct SessionRow {
    id: String,
    title: Option<String>,
    created: Option<String>,
    updated: Option<String>,
}

#[derive(Debug, Serialize)]
struct FlaggedRow {
    session_id: String,
    agent_name: String,
    blocker_reason: String,
    flagged_at: String,
    resolved: bool,
    resolved_at: Option<String>,
    notes: Option<String>,
    title: Option<String>,
}

fn main() {
    if let Err(err) = run() {
        println!("{}", json!({"error": err.to_string()}));
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();

    if cli.reconfigure {
        run_setup()?;
        return Ok(());
    }

    match cli.cmd {
        Some(Commands::List { search, limit }) => list_sessions(search.as_deref(), limit),
        Some(Commands::Transcript { session_id }) => get_transcript(&session_id),
        Some(Commands::FlagCurrent { agent, reason }) => flag_current(&agent, &reason),
        Some(Commands::Rename { session_id, title }) => rename_session(&session_id, &title),
        Some(Commands::ListFlagged { pending_only, resolved_only }) => {
            list_flagged(pending_only, resolved_only)
        }
        Some(Commands::Resolve { session_id, notes }) => resolve_flagged(&session_id, notes),
        Some(Commands::Ui { port }) => ui_server::start(ui_server::ServerConfig {
            port,
            session_db_path: get_db_path().ok(),
            memory_db_path: Some(memory_db_path()),
            index_db_path: Some(project_index_db_path()),
            open_browser: true,
        }),
        None => {
            Cli::command().print_help().ok();
            println!();
            std::process::exit(1);
        }
    }
}

fn run_setup() -> Result<PathBuf> {
    let presets = presets();

    println!("\nNo session database configured. Select your agent:\n");
    for (i, p) in presets.iter().enumerate() {
        println!("  {}) {:<12} ({})", i + 1, p.label, p.path.display());
    }
    println!("  {}) Custom path  (enter your own)\n", presets.len() + 1);

    let default = 1usize;
    print!("Choice [{}]: ", default);
    io::stdout().flush().ok();

    let mut choice = String::new();
    let parsed_choice = match io::stdin().read_line(&mut choice) {
        Ok(_) => choice.trim().parse::<usize>().unwrap_or(default),
        Err(_) => default,
    };

    let (db_path, agent) = if (1..=presets.len()).contains(&parsed_choice) {
        let preset = &presets[parsed_choice - 1];
        (preset.path.clone(), preset.label.to_lowercase())
    } else if parsed_choice == presets.len() + 1 {
        print!("Enter full path to database: ");
        io::stdout().flush().ok();
        let mut raw_path = String::new();
        if io::stdin().read_line(&mut raw_path).is_err() {
            anyhow::bail!("Aborted.");
        }
        (expand_home(raw_path.trim()), String::from("custom"))
    } else {
        eprintln!("Invalid choice. Defaulting to OpenCode.");
        (presets[0].path.clone(), String::from("opencode"))
    };

    if !db_path.exists() {
        eprintln!("Warning: file not found at {} - saving anyway.", db_path.display());
    }

    let cfg = Config {
        db_path: db_path.display().to_string(),
        agent,
    };
    let config_path = config_path();
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    fs::write(&config_path, serde_json::to_string_pretty(&cfg)?)
        .with_context(|| format!("failed to write {}", config_path.display()))?;
    eprintln!("Saved config to {}\n", config_path.display());
    Ok(db_path)
}

fn get_db_path() -> Result<PathBuf> {
    let config_path = config_path();
    if config_path.exists() {
        if let Ok(text) = fs::read_to_string(&config_path) {
            if let Ok(cfg) = serde_json::from_str::<Config>(&text) {
                return Ok(expand_home(&cfg.db_path));
            }
        }
    }
    run_setup()
}

fn get_db() -> Result<Connection> {
    let db_path = get_db_path()?;
    if !db_path.exists() {
        println!("{}", json!({"error": format!("Database not found at {}", db_path.display())}));
        std::process::exit(1);
    }

    let conn = Connection::open(&db_path)
        .with_context(|| format!("failed to open {}", db_path.display()))?;
    ensure_flagged_table(&conn)?;
    Ok(conn)
}

fn ensure_flagged_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(DEFAULT_SCHEMA)
        .context("failed to ensure flagged_sessions table")?;
    Ok(())
}

fn list_sessions(search: Option<&str>, limit: i64) -> Result<()> {
    let db = get_db()?;
    let rows = match search {
        Some(term) => {
            let mut stmt = db.prepare(
                "SELECT CAST(id AS TEXT), title, time_created, time_updated\n         FROM session\n         WHERE title LIKE ?\n         ORDER BY time_created DESC\n         LIMIT ?",
            )?;
            let rows = stmt
                .query_map(params![format!("%{}%", term), limit], |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        created: row.get(2)?,
                        updated: row.get(3)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        }
        None => {
            let mut stmt = db.prepare(
                "SELECT CAST(id AS TEXT), title, time_created, time_updated\n         FROM session\n         ORDER BY time_created DESC\n         LIMIT ?",
            )?;
            let rows = stmt
                .query_map(params![limit], |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        created: row.get(2)?,
                        updated: row.get(3)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        }
    };
    println!("{}", serde_json::to_string_pretty(&rows)?);
    Ok(())
}

fn rename_session(session_id: &str, title: &str) -> Result<()> {
    let db = get_db()?;
    let updated = db.execute(
        "UPDATE session SET title = ? WHERE CAST(id AS TEXT) = ?",
        params![title, session_id],
    )?;

    if updated == 0 {
        println!("{}", json!({"error": format!("No session found with id '{}'", session_id)}));
        std::process::exit(1);
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "status": "renamed",
            "session_id": session_id,
            "title": title,
        }))?
    );
    Ok(())
}

fn get_transcript(session_id: &str) -> Result<()> {
    let db = get_db()?;
    let mut parts_stmt = db.prepare(
        "SELECT p.message_id, p.data\n         FROM part p\n         WHERE p.session_id = ?\n         ORDER BY p.time_created ASC",
    )?;
    let mut parts_by_msg: HashMap<String, Vec<Value>> = HashMap::new();
    for row in parts_stmt.query_map(params![session_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (msg_id, data_str) = row?;
        if let Ok(data) = serde_json::from_str::<Value>(&data_str) {
            parts_by_msg.entry(msg_id).or_default().push(data);
        }
    }

    let mut msg_stmt = db.prepare(
        "SELECT CAST(id AS TEXT), data\n         FROM message m\n         WHERE m.session_id = ?\n         ORDER BY m.time_created ASC",
    )?;

    let mut transcript: Vec<Value> = Vec::new();
    for row in msg_stmt.query_map(params![session_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })? {
        let (msg_id, data_str) = row?;
        let data: Value = match serde_json::from_str(&data_str) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let mut entry = serde_json::Map::new();
        entry.insert("role".into(), data.get("role").cloned().unwrap_or(Value::Null));
        entry.insert("agent".into(), data.get("agent").cloned().unwrap_or(Value::Null));

        let mut content_parts = Vec::new();
        for p in parts_by_msg.get(&msg_id).cloned().unwrap_or_default() {
            match p.get("type").and_then(Value::as_str) {
                Some("text") => {
                    content_parts.push(json!({"type":"text","text": p.get("text").and_then(Value::as_str).unwrap_or("").chars().take(2000).collect::<String>()}));
                }
                Some("tool") => {
                    let state = p.get("state").cloned().unwrap_or(Value::Object(Default::default()));
                    content_parts.push(json!({
                        "type": "tool-call",
                        "tool": p.get("tool").and_then(Value::as_str).unwrap_or("?"),
                        "status": state.get("status").and_then(Value::as_str).unwrap_or("?"),
                        "args_preview": state.get("input").map(|v| v.to_string()).unwrap_or_default().chars().take(200).collect::<String>(),
                        "result_preview": state.get("output").map(|v| v.to_string()).unwrap_or_default().chars().take(300).collect::<String>(),
                    }));
                }
                Some("reasoning") => {
                    content_parts.push(json!({"type":"reasoning","text": p.get("text").and_then(Value::as_str).unwrap_or("").chars().take(2000).collect::<String>()}));
                }
                _ => {}
            }
        }

        entry.insert("parts".into(), Value::Array(content_parts));
        if let Some(finish) = data.get("finish") {
            entry.insert("finish".into(), finish.clone());
        }
        transcript.push(Value::Object(entry));
    }

    let mut output = serde_json::to_string_pretty(&transcript)?;
    if output.len() > 100000 {
        while output.len() > 100000 && transcript.len() > 10 {
            transcript.remove(0);
            output = serde_json::to_string_pretty(&transcript)?;
        }
    }

    println!("{}", output);
    Ok(())
}

fn flag_current(agent: &str, reason: &str) -> Result<()> {
    let db = get_db()?;
    let mut stmt = db.prepare(
        "SELECT CAST(id AS TEXT), title\n         FROM session\n         WHERE title LIKE ?\n         ORDER BY time_created DESC\n         LIMIT 1",
    )?;
    let row = stmt.query_row(params![format!("%{}%", agent)], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
    });

    let (session_id, title) = match row {
        Ok(v) => v,
        Err(_) => {
            println!("{}", json!({"error": format!("No sessions found for agent '{}'", agent)}));
            std::process::exit(1);
        }
    };

    let now = Utc::now().to_rfc3339();
    let existing = db
        .query_row(
            "SELECT id FROM flagged_sessions WHERE session_id = ? AND resolved = 0",
            params![&session_id],
            |row| row.get::<_, i64>(0),
        )
        .ok();

    if let Some(id) = existing {
        db.execute(
            "UPDATE flagged_sessions SET blocker_reason = ?, flagged_at = ? WHERE id = ?",
            params![reason, &now, id],
        )?;
    } else {
        db.execute(
            "INSERT INTO flagged_sessions (session_id, agent_name, blocker_reason, flagged_at) VALUES (?, ?, ?, ?)",
            params![&session_id, agent, reason, &now],
        )?;
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "status": "flagged",
            "session_id": session_id,
            "title": title,
            "agent": agent,
            "reason": reason,
            "flagged_at": now,
        }))?
    );
    Ok(())
}

fn list_flagged(pending_only: bool, resolved_only: bool) -> Result<()> {
    let db = get_db()?;
    let where_clause = if pending_only {
        "WHERE f.resolved = 0"
    } else if resolved_only {
        "WHERE f.resolved = 1"
    } else {
        ""
    };

    let sql = format!(
        "SELECT CAST(f.session_id AS TEXT), f.agent_name, f.blocker_reason, f.flagged_at,\n                 f.resolved, f.resolved_at, f.notes, s.title\n         FROM flagged_sessions f\n         LEFT JOIN session s ON CAST(s.id AS TEXT) = CAST(f.session_id AS TEXT)\n         {}\n         ORDER BY f.flagged_at DESC",
        where_clause
    );

    let mut stmt = db.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FlaggedRow {
                session_id: row.get(0)?,
                agent_name: row.get(1)?,
                blocker_reason: row.get(2)?,
                flagged_at: row.get(3)?,
                resolved: row.get::<_, i64>(4)? != 0,
                resolved_at: row.get(5)?,
                notes: row.get(6)?,
                title: row.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    println!("{}", serde_json::to_string_pretty(&rows)?);
    Ok(())
}

fn resolve_flagged(session_id: &str, notes: Option<String>) -> Result<()> {
    let db = get_db()?;
    let now = Utc::now().to_rfc3339();
    let cur = db.execute(
        "UPDATE flagged_sessions SET resolved = 1, resolved_at = ?, notes = ? WHERE session_id = ? AND resolved = 0",
        params![&now, notes, session_id],
    )?;

    if cur == 0 {
        println!("{}", json!({"error": format!("No pending flag found for session '{}'", session_id)}));
        std::process::exit(1);
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({"status": "resolved", "session_id": session_id, "resolved_at": now}))?
    );
    Ok(())
}

fn config_path() -> PathBuf {
    home_dir().join(".config/session_reader/config.json")
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

struct Preset {
    label: &'static str,
    path: PathBuf,
}

fn presets() -> Vec<Preset> {
    let mac = cfg!(target_os = "macos");
    vec![
        Preset {
            label: "OpenCode",
            path: home_dir().join(".local/share/opencode/opencode.db"),
        },
        Preset {
            label: "Cursor",
            path: if mac {
                home_dir()
                    .join("Library/Application Support/Cursor/User/globalStorage/state.vscdb")
            } else {
                home_dir().join(".config/Cursor/User/globalStorage/state.vscdb")
            },
        },
        Preset {
            label: "Windsurf",
            path: if mac {
                home_dir()
                    .join("Library/Application Support/Windsurf/User/globalStorage/state.vscdb")
            } else {
                home_dir().join(".config/Windsurf/User/globalStorage/state.vscdb")
            },
        },
    ]
}

fn memory_db_path() -> PathBuf {
    env::var("AGENT_MEMORY_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home_dir().join(".local/state/agent-tools/memory.db"))
}

fn project_index_db_path() -> PathBuf {
    env::var("PROJECT_INDEX_DB")
        .map(PathBuf::from)
        .or_else(|_| env::var("AGENT_REPO_IDX_DB").map(PathBuf::from))
        .unwrap_or_else(|_| home_dir().join(".local/state/opencode-custom-tools/repos.sqlite"))
}
