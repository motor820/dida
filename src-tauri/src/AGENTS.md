# Desktop Backend Guidelines

## Current Architecture

`lib.rs` registers the single-instance plugin, initializes SQLite, and registers legacy read commands plus sync IPC. Keep `main.rs` minimal. `commands/sync.rs` implements current local state persistence, native HTTP and Keychain sessions. `crates/local-store/` owns atomic `sync_local_state` persistence. Existing task/list/tag repositories support legacy data access; do not bypass the sync store for new business writes.

## Database and Models

Use rusqlite with `Arc<Mutex<Connection>>`; there is no sqlx pool. Preserve `com.akm.dida-clone` and the existing database path. TypeScript serialized fields mirror snake_case Rust fields such as `parent_id` and `due_date`. Parameterize SQL and return handled errors. Keep database writes transactional and preserve original relationship tables for explicit import.

## Security and Validation

Keep native credentials in Keychain and out of JavaScript, logs, and Git. Native requests use the fixed HTTPS service host without redirects. Retain CSP, single-instance behavior and local permissions.

Run the local-store and server Cargo tests plus relevant frontend checks. ARM64 CI packaging, Intel startup checks, and M1 user acceptance are distinct evidence. User reported M1 tests passed on 2026-11-04; detailed scenarios were not supplied. Do not claim untested background notification behavior.

`productName` and `mainBinaryName` are Dida. Preserve the bundle identifier and Keychain service. Build/install status is tracked in docs/RELEASES.md; old packages do not update themselves.
