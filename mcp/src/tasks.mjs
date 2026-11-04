import { completionChanges } from '../../src/services/recurrence.ts';
import { normalizeRepeat } from '../../src/utils/recurrence.ts';
import { requestId } from './api.mjs';

const now = () => Math.floor(Date.now() / 1000);
const defaults = [
  ['smart_inbox', '收集箱'], ['smart_all', '所有任务'], ['smart_today', '今天'],
  ['smart_week', '最近7天'], ['smart_completed', '已完成'], ['smart_trash', '垃圾桶'],
].map(([id, name]) => ({ id, name, is_smart: true }));
export function dateSeconds(value) {
  if (value === null) return null;
  if (!/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error('日期必须为带时区的 ISO 8601，例如 2026-11-06T18:00:00+08:00');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < 946684800000) throw new Error('日期无效');
  return Math.floor(time / 1000);
}
function present(task) {
  return { ...task, due_at: task.due_date == null ? null : new Date(task.due_date * 1000).toISOString() };
}
function descendants(tasks, id) {
  const result = [], visited = new Set([id]), queue = [id];
  while (queue.length) {
    const parent = queue.shift();
    for (const child of tasks) if (child.parent_id === parent && !visited.has(child.id)) {
      result.push(child); visited.add(child.id); queue.push(child.id);
    }
  }
  return result;
}
export class TaskManager {
  constructor(api) { this.api = api; }
  tasks(state) { return this.api.values(state, 'task'); }
  get(state, id) {
    const task = this.tasks(state).find(t => t.id === id);
    if (!task) throw new Error('任务不存在或已永久删除，请先查询确认 ID');
    return task;
  }
  lists(state) { return [...defaults, ...this.api.values(state, 'list')]; }
  checkRefs(state, value, id) {
    if (value.list_id !== undefined && value.list_id !== 'smart_inbox' && !this.api.values(state, 'list').some(l => l.id === value.list_id)) throw new Error('只能放入收集箱或已存在的自定义清单');
    if (value.tags !== undefined && value.tags.some(id => !this.api.values(state, 'tag').some(tag => tag.id === id))) throw new Error('标签不存在，请先查询或创建标签');
    if (value.parent_id) {
      const parent = this.get(state, value.parent_id);
      if (parent.is_deleted) throw new Error('不能将子任务放入回收站任务');
      if (parent.id === id || descendants(this.tasks(state), id).some(t => t.id === parent.id)) throw new Error('父子任务不能形成循环');
      if (value.list_id !== parent.list_id) throw new Error('子任务应与父任务属于同一清单');
    }
  }
  fields(input, task = {}) {
    const { task_id, request_id, due_at, ...patch } = input;
    const result = { ...patch };
    if (due_at !== undefined) result.due_date = dateSeconds(due_at);
    const due = result.due_date !== undefined ? result.due_date : task.due_date;
    if (due === null) { result.reminder = null; result.repeat_rule = null; }
    if (patch.repeat_rule && patch.repeat_rule.type !== 'none') {
      if (due == null) throw new Error('重复任务必须设置日期');
      result.repeat_rule = normalizeRepeat(patch.repeat_rule, due);
    }
    if (patch.repeat_rule?.type === 'none') result.repeat_rule = null;
    if (result.reminder && result.reminder !== 'none' && due == null) throw new Error('提醒必须先设置截止日期');
    if (result.title !== undefined) result.title = result.title.trim();
    if (result.title === '') throw new Error('任务标题不能为空');
    return result;
  }
  async list(input) {
    return this.api.exclusive(async state => {
      let tasks = this.tasks(state);
      const { status = 'pending', query = '', list_id, tag_id, due_after, due_before, include_subtasks = false, offset = 0, limit = 50 } = input;
      tasks = tasks.filter(t => status === 'trash' ? t.is_deleted : !t.is_deleted && (status === 'all' || t.completed === (status === 'completed')));
      if (!include_subtasks) tasks = tasks.filter(t => !t.parent_id);
      if (query) tasks = tasks.filter(t => `${t.title}\n${t.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      if (list_id) tasks = tasks.filter(t => t.list_id === list_id);
      if (tag_id) tasks = tasks.filter(t => t.tags?.includes(tag_id));
      if (due_after !== undefined) { const time = dateSeconds(due_after); tasks = tasks.filter(t => t.due_date != null && t.due_date >= time); }
      if (due_before !== undefined) { const time = dateSeconds(due_before); tasks = tasks.filter(t => t.due_date != null && t.due_date <= time); }
      tasks.sort((a, b) => (a.due_date ?? -Infinity) - (b.due_date ?? -Infinity) || a.order - b.order || a.id.localeCompare(b.id));
      return { tasks: tasks.slice(offset, offset + limit).map(present), total: tasks.length, next_offset: offset + limit < tasks.length ? offset + limit : null };
    });
  }
  async detail({ task_id }) {
    return this.api.exclusive(async state => ({ task: present(this.get(state, task_id)), subtasks: descendants(this.tasks(state), task_id).map(present) }));
  }
  async create(input) {
    return this.api.exclusive(async state => {
      const id = requestId('task', input.request_id);
      if (state.records[`task:${id}`]) return { task: present(this.get(state, id)), created: false };
      const parent = input.parent_id ? this.get(state, input.parent_id) : undefined;
      const task = { id, title: '', description: '', list_id: parent?.list_id || 'smart_inbox', completed: false, priority: 0,
        due_date: null, reminder: null, repeat_rule: null, tags: [], parent_id: null, order: Date.now(),
        is_deleted: false, created_at: now(), updated_at: now(), completed_at: null, ...this.fields(input) };
      this.checkRefs(state, task, id);
      await this.api.push(state, [{ kind: 'task', id, value: task }]);
      return { task: present(this.get(await this.api.snapshot(), id)), created: true };
    });
  }
  async update({ task_id, ...input }) {
    return this.api.exclusive(async state => {
      const task = this.get(state, task_id);
      if (task.is_deleted) throw new Error('请先从回收站恢复任务');
      const fields = this.fields(input, task);
      this.checkRefs(state, { ...task, ...fields }, task_id);
      const updates = [{ kind: 'task', id: task_id, value: { ...fields, updated_at: now() } }];
      if (fields.list_id && fields.list_id !== task.list_id) {
        if (task.parent_id && !Object.hasOwn(fields, 'parent_id')) throw new Error('移动子任务前需显式解除父任务关系或移动父任务');
        for (const child of descendants(this.tasks(state), task_id)) updates.push({ kind: 'task', id: child.id, value: { list_id: fields.list_id, updated_at: now() } });
      }
      await this.api.push(state, updates);
      return { task: present(this.get(await this.api.snapshot(), task_id)) };
    });
  }
  async complete({ task_id, completed = true }) {
    return this.api.exclusive(async state => {
      const task = this.get(state, task_id);
      if (task.is_deleted) throw new Error('回收站任务不能设置完成状态');
      if (task.completed === completed) return { task: present(task), changed: false, generated_tasks: [] };
      const known = new Set(Object.values(state.records).filter(r => r.kind === 'task').map(r => r.id));
      const updates = await completionChanges(task, this.tasks(state), now(), known);
      await this.api.push(state, updates);
      const fresh = await this.api.snapshot();
      return { task: present(this.get(fresh, task_id)), changed: true, generated_tasks: updates.filter(u => !known.has(u.id)).map(u => present(this.get(fresh, u.id))) };
    });
  }
  async trash({ task_id }, restore = false) {
    return this.api.exclusive(async state => {
      const task = this.get(state, task_id);
      if (restore && task.parent_id && this.get(state, task.parent_id).is_deleted) throw new Error('请先恢复父任务');
      const targets = [task, ...descendants(this.tasks(state), task_id)];
      await this.api.push(state, targets.map(t => ({ kind: 'task', id: t.id, value: { is_deleted: !restore, updated_at: now() } })));
      return { task: present(this.get(await this.api.snapshot(), task_id)), affected_ids: targets.map(t => t.id) };
    });
  }
  async listEntities(kind) {
    return this.api.exclusive(async state => ({ [kind === 'list' ? 'lists' : 'tags']: kind === 'list' ? this.lists(state) : this.api.values(state, 'tag') }));
  }
  async saveEntity(kind, input) {
    return this.api.exclusive(async state => {
      const { id: suppliedId, request_id, ...fields } = input;
      if (!suppliedId && !request_id) throw new Error('创建清单/标签需要 request_id；更新需要 id');
      if (suppliedId?.startsWith('smart_')) throw new Error('不能修改系统智能清单');
      const id = suppliedId || requestId(kind, request_id);
      const existing = this.api.values(state, kind).find(v => v.id === id);
      if (!suppliedId && existing) return { [kind]: existing, created: false };
      if (suppliedId && !existing) throw new Error('清单或标签不存在');
      if (state.records[`${kind}:${id}`]?.fields.__deleted?.value === true) throw new Error('记录已永久删除');
      if (kind === 'tag' && fields.parent_id) {
        const tags = this.api.values(state, 'tag');
        let parent = tags.find(t => t.id === fields.parent_id);
        if (!parent) throw new Error('父标签不存在');
        const visited = new Set([id]);
        while (parent) {
          if (visited.has(parent.id)) throw new Error('标签不能形成循环');
          visited.add(parent.id); parent = tags.find(t => t.id === parent.parent_id);
        }
      }
      const value = { ...(existing || (kind === 'list' ? { id, icon: '📋', color: '#3B82F6', is_smart: false, order: Date.now(), created_at: now() } : { id, color: '#3B82F6', parent_id: null, is_pinned: false, created_at: now() })), ...fields, name: fields.name.trim() };
      if (!value.name) throw new Error('名称不能为空');
      await this.api.push(state, [{ kind, id, value: existing ? { ...fields, name: value.name } : value }]);
      const saved = this.api.values(await this.api.snapshot(), kind).find(v => v.id === id);
      return { [kind]: saved, created: !existing };
    });
  }
}
