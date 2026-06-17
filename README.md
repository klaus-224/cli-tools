# cli-tools

## Binary Catalog
 - `agent_memory` - `crates/agent-memory` 
 - `project_index` - `crates/project-index`  (in progress)
 - `session_reader` - `crates/session-reader` (in progress)

## Build

```bash
make build
```

Release binaries are written to:

```text
target/release/<command-name>
```

## Installation

Install `agent_memory` into Cargo's binary directory:

```bash
make install-agent-memory
make install-
```

That runs:

```bash
cargo install --path crates/agent-memory
```

If `~/.cargo/bin` is on your `PATH`, the command is then available as:

```bash
agent_memory --help
```


