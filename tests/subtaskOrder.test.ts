import test from 'node:test';
import assert from 'node:assert/strict';
import { sortSubtasks } from '../src/utils/subtaskOrder.ts';
import type { Task } from '../src/types/task.ts';

const task = (id: string, order: number, completed_at: number | null = null): Task => ({
  id, title: id, order, completed_at, completed: completed_at !== null,
  description: '', list_id: 'smart_inbox', parent_id: 'parent', tags: [],
  priority: 0, due_date: null, reminder: null, repeat_rule: null,
  is_deleted: false, created_at: 1, updated_at: 1,
});

test('completed children follow every open child in completion-time order', () => {
  const items = [task('later', 0, 200), task('open-b', 20), task('earlier', 30, 100), task('open-a', 10)];
  assert.deepEqual(sortSubtasks(items).map(t => t.id), ['open-a', 'open-b', 'earlier', 'later']);
  assert.equal(items[0].id, 'later');
});

test('reopening a child restores its manual position among open tasks', () => {
  const first = task('first', 0, 100);
  const second = task('second', 10);
  assert.deepEqual(sortSubtasks([first, second]).map(t => t.id), ['second', 'first']);
  assert.deepEqual(sortSubtasks([{ ...first, completed: false, completed_at: null }, second]).map(t => t.id), ['first', 'second']);
});

test('equal completion times are stable and legacy missing times use updated_at', () => {
  const items = [task('b', 10, 100), task('a', 0, 100), { ...task('legacy', 30, 50), completed_at: null, updated_at: 50 }];
  assert.deepEqual(sortSubtasks(items).map(t => t.id), ['legacy', 'a', 'b']);
});
