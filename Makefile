.PHONY: build test smoke-agent-memory install-agent-memory

build:
	cargo build --release

test:
	cargo test

smoke-agent-memory: build
	set -eu; \
	db="$${TMPDIR:-/tmp}/agent-memory-smoke-$$$$.db"; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory init; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory add --category gotcha --summary "Smoke test" --detail "Rust port works" --tags rust,cli --agent smoke-test; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory query --recent 1; \
	AGENT_MEMORY_DB_PATH="$$db" target/release/agent_memory query --category gotcha --search "Smoke"

install-agent-memory:
	cargo install --path crates/agent-memory
