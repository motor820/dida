# Repository Guidelines

## Project Structure & Module Organization

This directory is a deployment workspace; Git history lives in the application checkouts.

- `app/`: legacy application checkout on `legacy/lan-web`.
- `worktrees/web-macos-sync/`: current web, macOS, and synchronization development worktree. Manage it with `git worktree`.
- Within each checkout, `src/` contains React/TypeScript components, hooks, services, stores, and types; `src-tauri/` contains the Rust desktop backend; `public/` holds static assets.
- The current worktree also contains `server/` (Rust API), `mcp/` (Node 24 stdio adapter), `integrations/` (Rona skill), and `tests/`.
- `docs/` contains deployment and recovery documentation; `ops/` contains maintenance scripts and systemd units.
- `runtime/`, `data/`, `backups/`, and `private/` contain deployed artifacts and local state.

Read the checkout's `AGENTS.md` and applicable nested guides before editing source.

## Build, Test, and Development Commands

Run application commands from `worktrees/web-macos-sync/`, unless maintaining the legacy checkout:

- `npm ci`: install locked frontend dependencies.
- `npm run dev`: start the Vite development server.
- `npm run build`: type-check TypeScript and build production web assets.
- `npm run test:tasks` and `npm run test:recurrence`: test ordering and repeated tasks.
- `npm ci --prefix mcp` and `npm run test:mcp`: install/test the MCP adapter; first build the debug API with `cargo build --manifest-path server/Cargo.toml`.
- `npm run tauri dev`: run the desktop application locally.
- `npm run tauri build`: build desktop release bundles.
- `npm run test:sync`: run TypeScript synchronization tests.
- `cargo test --manifest-path server/Cargo.toml`: run server tests.

`./ops/dida.sh status` reports service status; `./ops/dida.sh check` checks deployed endpoints. Source edits do not automatically deploy.

## Coding Style & Naming Conventions

Match surrounding code: TypeScript uses two-space indentation, single quotes, and semicolons; Rust uses four-space indentation and rustfmt. Use PascalCase component filenames, `useSomething.ts` hooks, and snake_case Rust modules. TypeScript is strict; avoid `any` and suppressed errors. Keep IPC calls in services, database access in repositories, and shared Rust/TypeScript models aligned. No ESLint or Prettier configuration is currently present.

## Testing Guidelines

Node tests cover sync, ordering and recurrence; Rust tests use the built-in harness and Tokio. MCP tests use a real isolated API, and Python Playwright scripts cover browser interactions. Add sync cases in `tests/*.test.ts` and Rust cases alongside relevant modules. No coverage threshold is configured. Run relevant tests and the frontend build; document manual UI, offline-sync, and macOS checks when applicable.

## Commit & Pull Request Guidelines

History commonly uses `feat:`, `fix:`, and `ci:` prefixes with optional scopes, such as `fix(ui): ...`. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for visible UI changes.

## Security & Configuration

Never commit credentials, databases, backups, or runtime artifacts. Use isolated test data. Consult `docs/operations.md` and `docs/backup-policy.md` before deployment or recovery; never start a second server against the production database.
