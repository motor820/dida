import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTasksByDate } from '../src/utils/taskOrder.ts';
import { getSortedGroupNames } from '../src/utils/taskGrouping.ts';
import type { Task } from '../src/types/task.ts';
const task = (id: string, due_date: number | null, order = 0, created_at = 1, completed = false): Task => ({
  id, title: id, due_date, order, created_at, completed, description: '', list_id: 'smart_inbox', parent_id: null,
  priority: 0, reminder: null, repeat_rule: null, tags: [], is_deleted: false, updated_at: created_at, completed_at: null,
});
test('pending dates override creation and manual ordering, including times within a day', () => {
  const tasks = [task('far', 300, 0, 1), task('near-later', 120, 10, 2), task('near-earlier', 100, 100, 100)];
  assert.deepEqual(sortTasksByDate(tasks).map(t => t.id), ['near-earlier', 'near-later', 'far']);
  assert.equal(tasks[0].id, 'far');
});
test('changing or clearing a due date immediately determines its new position', () => {
  const tasks = [task('a', 100), task('b', 200), task('none', null)];
  assert.deepEqual(sortTasksByDate(tasks.map(t => t.id === 'b' ? {...t, due_date:50} : t)).map(t => t.id), ['none','b','a']);
  assert.deepEqual(sortTasksByDate(tasks.map(t => t.id === 'a' ? {...t, due_date:null} : t)).map(t => t.id), ['a','none','b']);
});
test('undated tasks precede every dated task, and completed history remains below pending tasks', () => {
  const tasks = [task('done-first', 20, 0, 1, true), task('none', null), task('near', 50), task('done-second', 10, 0, 1, true)];
  assert.deepEqual(sortTasksByDate(tasks).map(t => t.id), ['none','near','done-first','done-second']);
});
test('equal dates retain manual ordering and deterministic ties', () => {
  assert.deepEqual(sortTasksByDate([task('b',100,20),task('a',100,10)]).map(t=>t.id),['a','b']);
  assert.deepEqual(sortTasksByDate([task('b',null),task('a',null)]).map(t=>t.id),['a','b']);
});

test('undated groups come before overdue/today/future groups, with completed history last', () => {
  const groups = { '更远': [task('future', 100)], '已完成': [task('done', null, 0, 1, true)], '已过期': [task('overdue', 1)], '无日期': [task('none', null)], '今天': [task('today', 50)] };
  assert.deepEqual(getSortedGroupNames(groups), ['无日期', '已过期', '今天', '更远', '已完成']);
});
