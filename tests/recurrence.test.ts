import test from 'node:test';
import assert from 'node:assert/strict';
import { civilTimestamp, civilDate, nextOccurrence, normalizeRepeat, shiftOccurrenceDate, repeatLabel } from '../src/utils/recurrence.ts';
import { completionChanges, occurrenceId } from '../src/services/recurrence.ts';
import { applyOperation, mergeRecord, decodeRecord } from '../src/sync/model.ts';
import type { LocalState, SyncRecord } from '../src/sync/model.ts';
import type { Task, RepeatRule } from '../src/types/task.ts';
const zone = 'Asia/Shanghai';
const at = (year: number, month: number, day: number, hour = 9, timezone = zone) => civilTimestamp({ year, month, day, hour, minute: 0, second: 0 }, timezone);
const rule = (type: string, fields: object = {}) => ({ type, timezone: zone, ...fields } as RepeatRule);
const task = (fields: Partial<Task> = {}): Task => ({ id: 'original', title: 'Repeat me', description: 'keep description', list_id: 'smart_inbox', completed: false,
  priority: 2, due_date: at(2026, 1, 31), reminder: '5m_before', repeat_rule: rule('monthly'), tags: ['tag'], parent_id: null, order: 10, is_deleted: false, created_at: 10, updated_at: 10, completed_at: null, ...fields });

test('daily recurrence keeps wall time and skips an overdue backlog', () => {
  assert.equal(nextOccurrence(at(2026, 1, 1), rule('daily'), at(2026, 1, 8, 10))!.due, at(2026, 1, 9));
  assert.equal(nextOccurrence(at(2026, 1, 1), rule('daily'), at(2026, 1, 8, 8))!.due, at(2026, 1, 8));
});
test('early completion still advances from the original scheduled due date', () => {
  assert.equal(nextOccurrence(at(2030, 1, 1), rule('daily'), at(2026, 1, 1))!.due, at(2030, 1, 2));
});
test('monthly recurrence clamps short months without losing the original day', () => {
  const feb = nextOccurrence(at(2026, 1, 31), rule('monthly'), at(2026, 1, 31))!;
  assert.equal(feb.due, at(2026, 2, 28));
  assert.equal(nextOccurrence(feb.due, feb.rule, feb.due)!.due, at(2026, 3, 31));
});
test('yearly recurrence returns to leap day when it exists again', () => {
  const next = nextOccurrence(at(2024, 2, 29), rule('yearly'), at(2024, 2, 29))!;
  assert.equal(next.due, at(2025, 2, 28));
  assert.equal(nextOccurrence(next.due, next.rule, at(2027, 3, 1))!.due, at(2028, 2, 29));
});
test('Monday-to-Friday skips the weekend without pretending to support holiday calendars', () => {
  assert.equal(nextOccurrence(at(2026, 11, 6), rule('weekday'), at(2026, 11, 6))!.due, at(2026, 11, 9));
});
test('custom fortnightly weekdays advance within the week then skip the off week', () => {
  const repeat = rule('custom', { frequency: 'weekly', interval: 2, daysOfWeek: [1, 3, 5] });
  const wed = nextOccurrence(at(2026, 11, 2), repeat, at(2026, 11, 2))!;
  assert.equal(wed.due, at(2026, 11, 4));
  const fri = nextOccurrence(wed.due, wed.rule, wed.due)!;
  assert.equal(fri.due, at(2026, 11, 6));
  assert.equal(nextOccurrence(fri.due, fri.rule, fri.due)!.due, at(2026, 11, 16));
});
test('custom daily/monthly/yearly intervals remain distinct and roundtrip', () => {
  for (const [frequency, expected] of [['daily', at(2026, 2, 2)], ['monthly', at(2026, 3, 31)], ['yearly', at(2028, 1, 31)]] as const) {
    const input = rule('custom', { frequency, interval: 2 });
    const next = nextOccurrence(at(2026, 1, 31), input, at(2026, 1, 31))!;
    assert.equal(next.due, expected); assert.equal(next.rule.frequency, frequency);
  }
});
test('legacy incomplete and invalid custom settings are rejected before completion', () => {
  assert.throws(() => normalizeRepeat(rule('custom', { interval: 2 }), at(2026, 1, 1)));
  assert.throws(() => normalizeRepeat(rule('custom', { frequency: 'weekly', daysOfWeek: [] }), at(2026, 1, 1)));
  assert.throws(() => normalizeRepeat(rule('daily', { interval: 0 }), at(2026, 1, 1)));
});
test('an ending date stops further occurrences', () => {
  assert.equal(nextOccurrence(at(2026, 1, 1), rule('daily', { endDate: at(2026, 1, 1) }), at(2026, 1, 1)), null);
});
test('a pinned timezone preserves wall time across daylight-saving changes', () => {
  const due = at(2026, 3, 7, 9, 'America/New_York');
  const next = nextOccurrence(due, rule('daily', { timezone: 'America/New_York' }), due)!;
  assert.equal(next.due - due, 23 * 3600);
  assert.equal(civilDate(next.due, 'America/New_York').hour, 9);
});
test('nonexistent DST time moves forward for one occurrence and returns to its original wall time', () => {
  const due = civilTimestamp({ year: 2026, month: 3, day: 7, hour: 2, minute: 30, second: 0 }, 'America/New_York');
  const next = nextOccurrence(due, rule('daily', { timezone: 'America/New_York' }), due)!;
  assert.equal(civilDate(next.due, 'America/New_York').hour, 3);
  const following = nextOccurrence(next.due, next.rule, next.due)!;
  assert.equal(civilDate(following.due, 'America/New_York').hour, 2);
});
test('completion preserves the original and creates an unfinished copy with the whole checklist tree', async () => {
  const original = task();
  const child = task({ id: 'child', parent_id: original.id, completed: true, completed_at: 1, repeat_rule: null });
  const grandchild = task({ id: 'grandchild', parent_id: child.id, repeat_rule: null, due_date: null });
  const before = JSON.stringify([original, child, grandchild]);
  const changes = await completionChanges(original, [original, child, grandchild], original.due_date!);
  const copies = changes.filter(change => change.initialize).map(change => change.value as unknown as Task);
  assert.equal(copies.length, 3);
  assert.equal(copies[0].title, original.title); assert.equal(copies[0].description, original.description);
  assert.equal(copies[0].due_date, at(2026, 2, 28)); assert.equal(copies[0].completed, false);
  assert.equal(copies[0].reminder, original.reminder); assert.deepEqual(copies[0].tags, original.tags);
  assert.equal(copies[1].parent_id, copies[0].id); assert.equal(copies[2].parent_id, copies[1].id);
  assert.equal(copies[1].completed, false); assert.equal(copies[1].completed_at, null);
  assert.equal(copies[2].due_date, null); assert.equal(JSON.stringify([original, child, grandchild]), before);
});
test('parallel completions on two devices share all successor IDs', async () => {
  const original = task(); const child = task({ id: 'child', parent_id: original.id });
  const [a, b] = await Promise.all([completionChanges(original, [original, child], original.due_date!), completionChanges(original, [original, child], original.due_date! + 1)]);
  assert.deepEqual(a.filter(c => c.initialize).map(c => c.id), b.filter(c => c.initialize).map(c => c.id));
});
test('reopening creates no successor and a second completion never resets an existing or deleted successor', async () => {
  const original = task(); const id = await occurrenceId(original.id);
  assert.equal((await completionChanges({ ...original, completed: true }, [original], original.due_date!)).length, 1);
  const existing = task({ id, title: 'already edited', is_deleted: true });
  assert.ok((await completionChanges(original, [original, existing], original.due_date!)).every(change => !change.initialize));
  assert.ok((await completionChanges(original, [original], original.due_date!, new Set([original.id, id]))).every(change => !change.initialize));
});
test('a nonrecurring completion does not create a task; recurring tasks require a date', async () => {
  assert.equal((await completionChanges(task({ repeat_rule: null }), [], 123)).length, 1);
  await assert.rejects(completionChanges(task({ due_date: null }), [], 123));
});
test('late generation cannot overwrite a user edit even if its initializer clock is newer', () => {
  const edit: SyncRecord = { kind: 'task', id: 'next', fields: { title: { value: 'edited', stamp: '100' }, completed: { value: true, stamp: '100' } } };
  const initial: SyncRecord = { kind: 'task', id: 'next', fields: { title: { value: 'old copy', stamp: '999', initial: true }, completed: { value: false, stamp: '999', initial: true }, due_date: { value: 42, stamp: '999', initial: true } } };
  for (const record of [mergeRecord(edit, initial), mergeRecord(initial, edit)]) {
    assert.equal(record.fields.title.value, 'edited'); assert.equal(record.fields.completed.value, true); assert.equal(record.fields.due_date.value, 42);
  }
});
test('initializer metadata survives local operation application and snapshot serialization', () => {
  const state = { records: {} } as LocalState;
  applyOperation(state, { op_id: 'init', kind: 'task', id: 'next', patch: { title: 'copy' }, stamp: '200', initialize: true });
  const restored = JSON.parse(JSON.stringify(state)) as LocalState;
  applyOperation(restored, { op_id: 'edit', kind: 'task', id: 'next', patch: { title: 'edited' }, stamp: '100' });
  assert.equal(decodeRecord<{title:string}>(restored.records['task:next']).title, 'edited');
});

test('copied checklist dates retain their own wall time across a parent DST transition', () => {
  const zone = 'America/New_York';
  const oldParent = at(2026, 3, 7, 9, zone), newParent = at(2026, 3, 8, 9, zone);
  const oldChild = at(2026, 3, 8, 11, zone);
  assert.equal(shiftOccurrenceDate(oldChild, oldParent, newParent, zone), at(2026, 3, 9, 11, zone));
});
test('completing a task already in trash never creates a new occurrence', async () => {
  const original = task({ is_deleted: true });
  assert.ok((await completionChanges(original, [original], original.due_date!)).every(change => !change.initialize));
});

test('quarterly preset uses three calendar months and restores the original month-end day', () => {
  const input = rule('quarterly');
  const first = nextOccurrence(at(2030, 1, 31), input, at(2026, 1, 1))!;
  assert.equal(first.due, at(2030, 4, 30));
  assert.equal(first.rule.type, 'monthly'); assert.equal(first.rule.interval, 3);
  const second = nextOccurrence(first.due, first.rule, first.due)!;
  assert.equal(second.due, at(2030, 7, 31));
  assert.equal(repeatLabel(first.rule, first.due), '每季度（31日）');
});
test('quarterly repeats cross years and skip overdue quarters on the original cadence', () => {
  assert.equal(nextOccurrence(at(2026, 11, 4), rule('quarterly'), at(2026, 11, 4))!.due, at(2027, 2, 4));
  assert.equal(nextOccurrence(at(2026, 1, 31), rule('quarterly'), at(2026, 11, 4))!.due, at(2027, 1, 31));
});
