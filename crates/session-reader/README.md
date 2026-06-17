## `session_reader`

Config file:

- `~/.config/session_reader/config.json`: stores the selected session database path and agent name.

Setup and examples:

```bash
session_reader --setup
session_reader list                          # last 20 sessions
session_reader list --search foo             # filter by title
session_reader list --search foo --limit 5   # filter + limit
session_reader transcript 12345
session_reader rename 12345 --title "new session name"
session_reader flag-current --agent regression-writer --reason "stuck on DB schema"
session_reader list-flagged --pending-only
session_reader resolve 12345 --notes "fixed in follow-up"
```

## Renaming Sessions (instructions for agents)

When you start a new session or want to label a session for future reference,
rename it using `session_reader rename`. This makes sessions discoverable later.

```
To rename the current session:
1. Run `session_reader list --limit 1` to get your current session ID.
2. Run `session_reader rename <session_id> --title "<descriptive title>"`

Naming conventions:
- Use a short, descriptive title summarizing the task (e.g., "fix auth token refresh bug")
- Prefix with the agent name if multiple agents share the DB (e.g., "regression-writer: schema migration tests")
- Keep titles under 80 characters
```

## Table Schema
```sql
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
```
