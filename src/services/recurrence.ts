import type { Task } from '../types/task.ts';
import { baselineKey } from '../sync/model.ts';
import { nextOccurrence, shiftOccurrenceDate } from '../utils/recurrence.ts';

export interface TaskChange { kind: 'task'; id: string; value: { [key: string]: unknown }; initialize?: boolean }
export async function occurrenceId(source: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`dida-occurrence:${source}`));
  return `repeat_${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function completionChanges(task: Task, tasks: Task[], now: number, knownIds: ReadonlySet<string> = new Set(tasks.map(item => item.id))): Promise<TaskChange[]> {
  const completed = !task.completed;
  const descendants: Task[] = [];
  const queue = [task.id], visited = new Set(queue);
  while (queue.length) {
    const parent = queue.shift();
    for (const child of tasks) if (child.parent_id === parent && !visited.has(child.id) && !child.is_deleted) {
      visited.add(child.id); descendants.push(child); queue.push(child.id);
    }
  }
  const targets = completed ? [task, ...descendants.filter(child => !child.completed)] : [task];
  const changes: TaskChange[] = targets.map(child => ({ kind: 'task', id: child.id, value: { completed, completed_at: completed ? now : null, updated_at: now } }));
  if (!completed || task.is_deleted || !task.repeat_rule || task.repeat_rule.type === 'none') return changes;
  if (task.due_date == null) throw new Error('请先为重复任务设置日期');
  const next = nextOccurrence(task.due_date, task.repeat_rule, now);
  if (!next) return changes;
  const nextId = await occurrenceId(task.id);
  // Reopening and completing an occurrence again never recreates, resets or resurrects its successor.
  if (knownIds.has(nextId)) return changes;
  const ids = new Map([[task.id, nextId]]);
  for (const child of descendants) ids.set(child.id, await occurrenceId(`${nextId}:${child.id}`));
  for (const source of [task, ...descendants]) {
    const { [baselineKey]: _baseline, ...copy } = source as Task & { [baselineKey]?: string };
    const due = source.id === task.id ? next.due : source.due_date == null ? null : shiftOccurrenceDate(source.due_date, task.due_date, next.due, source.repeat_rule?.timezone || next.rule.timezone!);
    const value: Task = { ...copy, id: ids.get(source.id)!, parent_id: source.id === task.id ? source.parent_id : ids.get(source.parent_id!)!, due_date: due,
      completed: false, completed_at: null, is_deleted: false, created_at: now, updated_at: now,
      repeat_rule: source.id === task.id ? next.rule : source.repeat_rule };
    changes.push({ kind: 'task', id: value.id, value: { ...value }, initialize: true });
  }
  return changes;
}
