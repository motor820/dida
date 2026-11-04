# Task Component Guidelines

## Responsibilities

`TaskList.tsx` provides creation controls, task grouping, drag ordering and recursive subtask rendering. It is a normal scrolling list, not a virtualized list. `TaskItem.tsx` renders task rows; `TaskDetail.tsx` edits details; `TaskContextMenu.tsx` handles contextual actions. `ReminderManager.tsx` checks reminders while the app is open and displays local UI.

## Changes

Use task hooks for mutations, `utils/priority.ts` for priority styling, and `utils/date.ts` for date display. Preserve task IDs, parent-child relationships, trash/restore semantics and offline queue persistence. Consult actual component props instead of copying hypothetical examples.

Repeated rules are saved and synchronized; automatic next-instance generation remains a planned task. Do not claim process-exit system notifications or virtual scrolling until implemented and validated. Test changed creation, editing, completion and nested-task interactions. Run the frontend build and relevant sync tests.
