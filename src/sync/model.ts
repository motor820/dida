export type Kind = 'task' | 'list' | 'tag';
export interface Field { value: unknown; stamp: string; initial?: boolean }
export interface SyncRecord { kind: Kind; id: string; fields: { [key: string]: Field } }
export interface Operation { op_id: string; kind: Kind; id: string; patch: { [key: string]: unknown }; stamp: string; initialize?: boolean }
export interface LocalState {
  schema: 1; device: string; records: { [key: string]: SyncRecord }; outbox: Operation[];
  cursor: number; epoch: string; lastTime: number; counter: number; offset: number; username: string; lastSync: number;
}
export function uid(): string {
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export function emptyState(): LocalState {
  return { schema: 1, device: uid(), records: {}, outbox: [], cursor: 0, epoch: '', lastTime: 0, counter: 0, offset: 0, username: '', lastSync: 0 };
}
export function mergeRecord(old: SyncRecord | undefined, incoming: SyncRecord): SyncRecord {
  const fields = { ...old?.fields };
  for (const [key, field] of Object.entries(incoming.fields)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('无效数据字段');
    if (key === '__deleted' && fields[key]?.value === true) continue;
    const old = fields[key];
    if (!old || (old.initial && !field.initial) || (!!old.initial === !!field.initial && field.stamp > old.stamp) || (key === '__deleted' && field.value === true)) fields[key] = field;
  }
  return { kind: incoming.kind, id: incoming.id, fields };
}
export function applyOperation(state: LocalState, operation: Operation): void {
  const incoming: SyncRecord = { kind: operation.kind, id: operation.id, fields: {} };
  for (const [key, value] of Object.entries(operation.patch)) incoming.fields[key] = { value, stamp: operation.stamp, ...(operation.initialize ? { initial: true } : {}) };
  const key = `${operation.kind}:${operation.id}`;
  state.records[key] = mergeRecord(state.records[key], incoming);
}
export function stamp(state: LocalState): string {
  const time = Math.max(Math.round(Date.now() + state.offset), state.lastTime);
  state.counter = time === state.lastTime ? state.counter + 1 : 0;
  state.lastTime = time;
  return `${String(time).padStart(13, '0')}-${String(state.counter).padStart(6, '0')}-${state.device}`;
}

export const baselineKey = '__dida_base' as const;
export function decodeRecord<T>(record: SyncRecord): T {
  const value = Object.fromEntries(Object.entries(record.fields).filter(([k]) => k !== '__deleted').map(([k, f]) => [k, f.value]));
  Object.defineProperty(value, baselineKey, { value: JSON.stringify(value), enumerable: true });
  return value as T;
}
export function changedFields(value: { [key: string]: unknown }, old: SyncRecord | undefined): { [key: string]: unknown } {
  const saved = (value as { [baselineKey]?: string })[baselineKey];
  const baseline: { [key: string]: unknown } | undefined = saved ? JSON.parse(saved) : undefined;
  const patch: { [key: string]: unknown } = {};
  for (const [key, field] of Object.entries(value)) {
    const before = baseline ? baseline[key] : old?.fields[key]?.value;
    if (key === baselineKey) continue;
    if (field !== undefined && JSON.stringify(before) !== JSON.stringify(field)) patch[key] = field;
  }
  return patch;
}

export function validateImport(kind: Kind, input: unknown): { id: string; [key: string]: unknown } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('导入记录格式错误');
  const value = input as { [key: string]: unknown };
  const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
  if (!id(value.id)) throw new Error('导入记录 ID 无效');
  const allowed = kind === 'task' ? ['id','title','description','list_id','completed','priority','due_date','reminder','repeat_rule','tags','parent_id','order','is_deleted','created_at','updated_at','completed_at'] : kind === 'list' ? ['id','name','icon','color','is_smart','order','created_at'] : ['id','name','color','parent_id','is_pinned','created_at'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('导入文件含不支持的字段');
  const text = kind === 'task' ? ['title','description'] : kind === 'list' ? ['name','icon','color'] : ['name','color'];
  for (const key of text) if (typeof value[key] !== 'string' || new TextEncoder().encode(String(value[key])).length > (key === 'description' ? 262144 : 4096)) throw new Error('导入文件文本格式不正确');
  for (const key of ['created_at','updated_at','completed_at','due_date','order']) if (key in value && value[key] !== null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) throw new Error('导入文件日期或排序无效');
  for (const key of ['completed','is_deleted','is_smart','is_pinned']) if (key in value && typeof value[key] !== 'boolean') throw new Error('导入文件状态无效');
  if (value.parent_id !== undefined && value.parent_id !== null && !id(value.parent_id)) throw new Error('导入父级 ID 无效');
  if (kind === 'task') {
    if (!id(value.list_id) || !Array.isArray(value.tags) || value.tags.length > 250 || !value.tags.every(id)) throw new Error('导入任务引用无效');
    if (typeof value.priority !== 'number' || ![0,1,2,3].includes(value.priority)) throw new Error('导入优先级无效');
    if (value.repeat_rule !== null && value.repeat_rule !== undefined && (typeof value.repeat_rule !== 'object' || Array.isArray(value.repeat_rule))) throw new Error('重复规则格式无效');
    if (JSON.stringify(value.repeat_rule ?? null).length > 4096) throw new Error('重复规则过长');
  }
  return { ...value, id: value.id };
}

export function observeClock(state: LocalState, incoming: string): void {
  const time = Number(incoming.slice(0, 13)), counter = Number(incoming.slice(14, 20));
  if (time > state.lastTime) { state.lastTime = time; state.counter = counter; }
  else if (time === state.lastTime) state.counter = Math.max(state.counter, counter);
}
