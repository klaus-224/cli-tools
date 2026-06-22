.PHONY: build build-ui build-with-ui test smoke-agent-memory install-agent-memory smoke-project-index install-project-index smoke-session-reader install-session-reader

build:
	cargo build --release

build-ui:
	pnpm --dir ui/session-viewer build

build-with-ui: build-ui
	cargo build --release

test:
	cargo test

install-agent-memory:
	cargo install --path crates/agent-memory

install-project-index:
	cargo install --path crates/project-index

install-session-reader:
	cargo install --path crates/session-reader

smoke-project-index: build
	set -eu; \
	db="$${TMPDIR:-/tmp}/project-index-smoke-$$$$.db"; \
	PROJECT_INDEX_DB="$$db" target/release/project_index index; \
	PROJECT_INDEX_DB="$$db" target/release/project_index query "SELECT COUNT(*) FROM repositories"
	
smoke-agent-memory: build
	set -eu; \
	db="$${TMPDIR:-/tmp}/agent-memory-smoke-$$$$.db"; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory init; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory add --category gotcha --summary "Smoke test" --detail "Rust port works" --tags rust,cli --agent smoke-test; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory query --recent 1; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory query --category gotcha --search "Smoke"

smoke-session-reader: build
	target/release/session_reader --help
