# Frontend Guidelines

## Data Flow

React components use hooks and services. Services use `sync/store.ts`; persistence selects native SQLite IPC or browser IndexedDB via official `isTauri()`. Browser localStorage is only a source for explicit legacy imports. Native HTTP/session IPC is in `sync/api.ts` and `sync/persistence.ts`; do not call `invoke()` in components.

## Structure and Style

Feature UI lives in `components/`; query hooks in `hooks/`; UI state in `store/`; shared models in `types/`; synchronization in `sync/`. Existing `services/index.ts` and `types/index.ts` barrels are supported. Preserve serialized snake_case names. Match surrounding formatting, keep TypeScript strict, and avoid `any` or error suppression.

React Query reflects business data and Zustand holds UI state. Persist entity changes and outbox updates together through the offline store. Handle failures without discarding pending changes. Never clear caches as a substitute for successful synchronization.

## Validation and Known Gaps

Run `npm run test:sync` for sync changes and `npm run build` for frontend changes. Tests use Node, not Vitest. UI regression infrastructure is a candidate task, not an existing facility. Search/calendar navigation is incomplete; recurring-instance generation and background notifications are not fully implemented. Follow the root `TODO.md` for current priorities.
