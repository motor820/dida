import type { Task } from '../types/task.ts';

/** Keep open tasks in manual order, followed by tasks in completion order. */
export function sortSubtasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed) {
      const time = (a.completed_at ?? a.updated_at) - (b.completed_at ?? b.updated_at);
      if (time) return time;
    }
    return a.order - b.order || a.created_at - b.created_at || a.id.localeCompare(b.id);
  });
}
