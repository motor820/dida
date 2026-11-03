import { invoke } from '@tauri-apps/api/core';
import { Task, List, Tag, SmartListType } from '../types';
import { request, ApiError } from './api';
import { emptyState, LocalState, Kind, Operation, SyncRecord, mergeRecord, applyOperation, stamp, uid, decodeRecord, changedFields, validateImport, observeClock, baselineKey } from './model';
import { loadState, saveState, native } from './persistence';

interface Pull { records: SyncRecord[]; cursor: number; until: number; has_more: boolean; time: number }
export interface SyncStatus { ready: boolean; authorized: boolean; username: string; pending: number; syncing: boolean; error: string; lastSync: number; native: boolean }
export const defaultLists: List[] = [
  [SmartListType.All, '所有任务', '📋'], [SmartListType.Today, '今天', '📅'], [SmartListType.Week, '最近7天', '📆'],
  [SmartListType.Inbox, '收集箱', '📥'], [SmartListType.Completed, '已完成', '✅'], [SmartListType.Trash, '垃圾桶', '🗑️'],
].map(([id, name, icon], order) => ({ id, name, icon, order, is_smart: true, color: '#3B82F6', created_at: 0 }));

class OfflineStore {
  private state: LocalState = emptyState();
  private started?: Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private channel = !native && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dida-sync-state') : undefined;
  private status: SyncStatus = { ready: false, authorized: false, username: '', pending: 0, syncing: false, error: '', lastSync: 0, native };
  private snapshot = this.status;
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    if (this.channel) this.channel.onmessage = () => { void this.refresh(); };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getStatus = () => this.snapshot;
  private emit(dataChanged = false) {
    this.status = { ...this.status, username: this.state.username, pending: this.state.outbox.length, lastSync: this.state.lastSync };
    this.snapshot = { ...this.status }; this.listeners.forEach(f => f());
    if (dataChanged) window.dispatchEvent(new Event('dida-data-changed'));
  }
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = () => !native && navigator.locks ? navigator.locks.request('dida-state-write', fn) : fn();
    const job = this.chain.then(run, run); this.chain = job.catch(() => undefined); return job;
  }
  private async refresh() { await this.exclusive(async () => { this.state = await loadState(); this.emit(true); }); }
  async initialize(): Promise<void> {
    if (this.status.ready) return;
    if (!this.started) this.started = (async () => {
      await this.exclusive(async () => { this.state = await loadState(); await saveState(this.state); });
      if (native) this.status.authorized = !!this.state.username || await invoke<boolean>('sync_has_session');
      if (native) { this.status.ready = true; this.emit(); }
      try {
        const start = Date.now(); const result = await request<{ username: string; time: number }>('GET', '/auth/session');
        await this.change(s => { s.username = result.username; s.offset = result.time - (start + Date.now()) / 2; });
        this.status.authorized = true;
      } catch { /* A Mac keeps its local database available offline. The web requires a valid session. */ }
      this.status.ready = true; this.emit();
      window.addEventListener('online', () => { void this.sync(); });
      window.addEventListener('focus', () => { void this.sync(); });
      setInterval(() => { if (document.visibilityState === 'visible') void this.sync(); }, 15000);
      if (this.status.authorized) void this.sync();
    })();
    return this.started;
  }
  async useOffline() { if (!native) return; this.status.authorized = true; this.emit(); }
  async login(username: string, password: string): Promise<void> {
    const start = Date.now();
    const result = await request<{ username: string; time: number }>('POST', '/auth/login', { username, password, device_name: native ? 'Mac' : '网页浏览器' });
    if (this.state.username && this.state.username !== result.username) throw new Error('请先导出本地数据，再切换账号');
    await this.change(s => { s.username = result.username; s.offset = result.time - (start + Date.now()) / 2; });
    this.status.authorized = true; this.status.error = ''; this.emit(); await this.sync();
  }
  async logout(): Promise<void> {
    try { await request('POST', '/auth/logout', {}); } catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw new Error('无法连接服务器注销会话，请联网后重试'); }
    if (native) await invoke('sync_forget_session');
    await this.exclusive(async () => { this.state = emptyState(); await saveState(this.state); });
    this.status.authorized = false; this.status.error = ''; this.emit(true); this.channel?.postMessage('logout');
  }
  async changePassword(current_password: string, new_password: string) {
    await request('POST', '/auth/password', { current_password, new_password });
    this.status.authorized = native; this.status.error = '密码已修改，请使用新密码重新登录同步'; this.emit();
  }
  async change<T>(fn: (state: LocalState) => T): Promise<T> {
    return this.exclusive(async () => {
      const next = await loadState(); const result = fn(next);
      await saveState(next); this.state = next; this.emit(true); this.channel?.postMessage('changed'); return result;
    });
  }
  values<T>(kind: Kind): T[] {
    return Object.values(this.state.records).filter(r => r.kind === kind && r.fields.__deleted?.value !== true)
      .map(r => decodeRecord<T>(r));
  }
  async put(kind: Kind, value: { id: string; [key: string]: unknown }): Promise<void> { await this.batch([{ kind, id: value.id, value }]); }
  async batch(updates: { kind: Kind; id: string; value: { [key: string]: unknown } }[]): Promise<void> {
    await this.change(s => {
      for (const update of updates) {
        const old = s.records[`${update.kind}:${update.id}`];
        if (old?.fields.__deleted?.value === true) continue;
        if (update.value.__deleted !== true) {
          const current = old ? Object.fromEntries(Object.entries(old.fields).filter(([key]) => key !== '__deleted').map(([key, field]) => [key, field.value])) : {};
          const candidate = { ...current, ...update.value }; delete candidate[baselineKey];
          validateImport(update.kind, candidate);
        }
        const patch = changedFields(update.value, old);
        if (!Object.keys(patch).length) continue;
        const op: Operation = { op_id: uid(), kind: update.kind, id: update.id, patch, stamp: stamp(s) };
        applyOperation(s, op); s.outbox.push(op);
      }
    });
    if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { void this.sync(); }, 1000);
  }
  async sync(): Promise<void> {
    if (!this.state.username || this.status.syncing || !this.status.authorized) return;
    this.status.syncing = true; this.status.error = ''; this.emit();
    try {
      const started = Date.now();
      const session = await request<{ username: string; epoch: string; time: number }>('GET', '/auth/session');
      await this.change(s => {
        s.offset = session.time - (started + Date.now()) / 2;
        if (s.epoch !== session.epoch) {
          s.records = {}; s.cursor = 0; s.epoch = session.epoch;
          for (const operation of s.outbox) applyOperation(s, operation);
        }
      });
      // Network waits never hold the local write lock: editing remains available offline.
      for (let page = 0; page < 1000; page++) {
        const pending = this.state.outbox.slice(0, 100); if (!pending.length) break;
        while (pending.length > 1 && new TextEncoder().encode(JSON.stringify(pending)).length > 1500000) pending.pop();
        const start = Date.now(); const result = await request<{ ack: string[]; time: number }>('POST', '/sync/push', { device_id: this.state.device, operations: pending });
        await this.change(s => { const ack = new Set(result.ack); s.outbox = s.outbox.filter(o => !ack.has(o.op_id)); s.offset = result.time - (start + Date.now()) / 2; });
      }
      let cursor = this.state.cursor, until: number | undefined;
      for (let page = 0; page < 10000; page++) {
        const result = await request<Pull>('GET', `/sync/pull?after=${cursor}${until === undefined ? '' : `&until=${until}`}`);
        await this.change(s => {
          for (const record of result.records) {
            const key = `${record.kind}:${record.id}`; s.records[key] = mergeRecord(s.records[key], record);
            for (const field of Object.values(record.fields)) observeClock(s, field.stamp);
          }
          s.cursor = Math.max(s.cursor, result.cursor);
        });
        cursor = result.cursor; until = result.until; if (!result.has_more) break;
      }
      await this.change(s => { s.lastSync = Date.now(); });
    } catch (e) {
      this.status.error = e instanceof Error ? e.message : String(e);
      if (e instanceof ApiError && e.status === 401) { this.status.error = '登录已失效，请重新登录；本机修改仍已保存'; if (!native) this.status.authorized = false; }
    } finally { this.status.syncing = false; this.emit(); }
  }
  exportData(): string { return JSON.stringify({ format: 'dida-export-v1', tasks: this.values<Task>('task'), lists: this.values<List>('list'), tags: this.values<Tag>('tag') }, (key, value: unknown) => key === baselineKey ? undefined : value, 2); }
  async importData(raw: string): Promise<void> {
    const data: { tasks?: Task[]; lists?: List[]; tags?: Tag[] } = JSON.parse(raw);
    if (![data.tasks, data.lists, data.tags].every(a => a === undefined || Array.isArray(a))) throw new Error('导入文件格式不正确');
    const updates: { kind: Kind; id: string; value: { [key: string]: unknown } }[] = [];
    for (const [kind, values] of [['list', data.lists], ['tag', data.tags], ['task', data.tasks]] as const) {
      for (const value of values || []) {
        if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.id)) throw new Error('导入文件含无效 ID');
        if (kind === 'list' && 'is_smart' in value && value.is_smart) continue;
        const checked = validateImport(kind, value);
        updates.push({ kind, id: checked.id, value: checked });
      }
    }
    await this.batch(updates);
  }
  async importLegacy(): Promise<void> {
    if (native) {
      const [tasks, lists, tags] = await Promise.all([invoke<Task[]>('get_tasks', { listId: null }), invoke<List[]>('get_lists'), invoke<Tag[]>('get_tags')]);
      const priorities: { [key: string]: number } = { None: 0, Low: 1, Medium: 2, High: 3 };
      const browserTasks: Task[] = JSON.parse(localStorage.getItem('dida-tasks') || '[]');
      const browserLists: List[] = JSON.parse(localStorage.getItem('dida-lists') || '[]');
      const browserTags: Tag[] = JSON.parse(localStorage.getItem('dida-tags') || '[]');
      const combine = <T extends { id: string }>(a: T[], b: T[]): T[] => Array.from(new Map([...a, ...b].map(value => [value.id, value])).values());
      await this.importData(JSON.stringify({ tasks: combine(tasks.map(t => ({ ...t, priority: typeof t.priority === 'string' ? priorities[t.priority] ?? 0 : t.priority })), browserTasks), lists: combine(lists, browserLists), tags: combine(tags, browserTags) }));
    } else {
      await this.importData(JSON.stringify({ tasks: JSON.parse(localStorage.getItem('dida-tasks') || '[]'), lists: JSON.parse(localStorage.getItem('dida-lists') || '[]'), tags: JSON.parse(localStorage.getItem('dida-tags') || '[]') }));
    }
  }
}
export const offline = new OfflineStore();
