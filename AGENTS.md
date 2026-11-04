# Repository Guidelines

## Project Structure & Module Organization

Dida 0.2 delivers a React 19/TypeScript web UI, Tauri 2 Mac client, and Rust/Axum sync server. `src/components/` groups UI by feature; `hooks/`, `services/`, and `sync/` implement queries, domain operations, and offline state. `src-tauri/` provides desktop IPC and legacy data import. `crates/local-store/` provides transactional SQLite state persistence. `server/` contains the API; `tests/` contains sync tests; `public/` contains assets. Read nested `AGENTS.md` files before editing their directories.

## Build, Test, and Development Commands

Use Node.js 24 and Rust stable. Run from this checkout:

- `npm ci`: install locked JavaScript dependencies.
- `npm run build`: type-check and build the web UI.
- `npm run test:sync`: run Node TypeScript sync tests.
- `cargo test --locked --manifest-path crates/local-store/Cargo.toml`: test persistence and legacy initialization.
- `cargo test --locked --manifest-path server/Cargo.toml`: test API authentication and synchronization.
- `npm run dev`: start Vite on 1420; browser API routes require a same-origin development proxy.
- `npm run tauri dev`: run desktop development on a configured Mac.

The deployment host already uses port 1420 for the legacy UI. Do not stop it or start a conflicting instance. Current ARM64 downloads come from `macos-trial.yml`.

## Coding Style & Naming Conventions

Match surrounding indentation and formatting. Use PascalCase component names, `useSomething` hooks, snake_case Rust modules, and existing serialized field names. TypeScript strict checks apply; avoid `any` and ignored errors. Existing service/type barrels are supported. Keep components behind hooks/services; native IPC belongs in sync adapters. React Query manages query state; Zustand holds UI state. Browser persistence is IndexedDB, Mac persistence is SQLite; localStorage is only a legacy import source. Rust uses rusqlite, not sqlx.

## Testing Guidelines

Add `tests/*.test.ts` sync cases or Rust `#[test]`/`#[tokio::test]` cases for changed behavior. Use isolated data. Run relevant tests and the frontend build. No coverage threshold, ESLint, Prettier, or UI test framework is configured. Preserve pending changes and regression coverage against startup data loss.

## Commit & Pull Request Guidelines

Use concise `feat:`, `fix:`, `docs:`, or `ci:` subjects with optional scopes. Describe behavior, validation, relevant issues, and visible UI changes. Follow `TODO.md` and `docs/WORK-STATUS.md`; update them when scope or results change. Never commit credentials, databases, backups, or runtime artifacts. Production deployment is separate from source commits.
