import type { Task } from '../types/task.ts';

/** Pending undated tasks come first, followed by dated tasks in due-date order. Keep completed history stable. */
export function sortTasksByDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) return 0;
    const firstDate = a.due_date ?? -Infinity;
    const secondDate = b.due_date ?? -Infinity;
    if (firstDate !== secondDate) return firstDate < secondDate ? -1 : 1;
    return a.order - b.order || a.created_at - b.created_at || a.id.localeCompare(b.id);
  });
}
