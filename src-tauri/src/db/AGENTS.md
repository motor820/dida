# Database Layer Guidelines

## Implementation

This directory uses rusqlite, not sqlx. `connection.rs` initializes tables and smart lists; task/list/tag repositories query legacy relationship data. Connections are shared through `Arc<Mutex<Connection>>`. Current offline business state and outbox persistence are implemented by `crates/local-store/` and called by sync IPC.

## Changes and Safety

Bind business values with rusqlite parameters. Preserve IDs, parent relationships, and original tables for explicit imports. Keep multi-record writes transactional. Never use `INSERT OR REPLACE` to recreate system lists: foreign-key cascades can delete existing tasks. Retain idempotent initialization and its regression test.

The Mac database is `~/Library/Application Support/com.akm.dida-clone/dida.db`; never delete a user's database to troubleshoot. Export or back up first. Do not test against production data.

## Validation

Run `cargo test --locked --manifest-path crates/local-store/Cargo.toml` from the checkout root. Existing tests cover persistence, failed-write safety, and repeated execution of the actual legacy initialization module. Use in-memory or temporary SQLite databases for additional tests. Coordinate serialized model changes with TypeScript types and sync behavior.
