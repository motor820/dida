# UI Component Guidelines

## Organization

`Task/` contains task list, row, detail, context-menu, and reminder components. `Layout/` contains navigation, sidebar and layout. `Common/` contains date picker, alerts, toast and context-menu utilities. `Sync/` contains authentication and account/sync panels. List and tag management are primarily embedded in the sidebar and task UI; inspect actual files before proposing new components.

## Conventions

Use PascalCase filenames, typed props, existing Tailwind classes and CSS variables from `src/index.css`. Reuse date and priority helpers. Keep business operations in hooks/services and sync state; never call native IPC directly from components. Extract complex or repeated logic where a change warrants it; existing large components are not evidence of a hard line limit.

## Verification

Run `npm run build` and check changed interactions manually. Python Playwright browser regressions exist; Vitest/React Testing Library are not configured. Search and calendar navigation currently expose unfinished views; do not describe them as complete. System reminders after process exit are outside current functionality. Keep `TODO.md` aligned with delivered behavior.

`Layout/NavRail.tsx` owns bottom-left sync/settings controls and opens `SyncPanel` through a portal; `SyncGate` only initializes and gates login. There is no top sync/status row.
