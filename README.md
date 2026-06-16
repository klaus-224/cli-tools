# cli-tools

Rust CLI tools migrated from `/Users/klaus224/code/bin`.

## Current Inventory

| Command | Original type | Migration status |
| --- | --- | --- |
| `agent_memory` | Python/uv SQLite CLI | Ported to Rust in `crates/agent-memory` |
| `repo` | `rust-script` Rust CLI | Not migrated yet |
| `session_reader` | Python SQLite CLI | Not migrated yet |

## Build

```bash
make build
```

Release binaries are written to:

```text
target/release/<command-name>
```

## Install

Install `agent_memory` into Cargo's binary directory:

```bash
make install-agent-memory
```

That runs:

```bash
cargo install --path crates/agent-memory
```

If `~/.cargo/bin` is on your `PATH`, the command is then available as:

```bash
agent_memory --help
```

Alternatively, symlink a release binary into `~/.local/bin`:

```bash
ln -sf /Users/klaus224/code/bin/cli-tools/target/release/agent_memory ~/.local/bin/agent_memory
```

If the repository is moved to `/Users/klaus224/code/cli-tools`, update the symlink source accordingly.

## `agent_memory`

Environment variables:

- `AGENT_MEMORY_DB_PATH`: override the SQLite database path. Defaults to `~/.local/state/agent-tools/memory.db`.
- `AGENT_MEMORY_SCHEMA_PATH`: optional external SQL schema path. If unset, the Rust binary uses its embedded schema.

Examples:

```bash
agent_memory init
agent_memory add --category gotcha --summary "Short finding" --detail "Longer note" --tags rust,cli
agent_memory query --recent 5
agent_memory query --category gotcha --search "rust cli"
```
