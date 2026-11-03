import { invoke, isTauri } from '@tauri-apps/api/core';
import { emptyState, LocalState } from './model';
export const native = isTauri();
let database: Promise<IDBDatabase> | undefined;
function idb(): Promise<IDBDatabase> {
  if (!database) database = new Promise((resolve, reject) => {
    const req = indexedDB.open('dida-offline-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('无法打开浏览器本地数据库'));
  });
  return database;
}
export async function loadState(): Promise<LocalState> {
  let raw: string | undefined | null;
  if (native) raw = await invoke<string | null>('sync_local_load');
  else {
    const db = await idb();
    raw = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction('state', 'readonly'); const req = tx.objectStore('state').get('current');
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  if (!raw) return emptyState();
  const value = JSON.parse(raw) as LocalState;
  if (value.schema !== 1 || !value.records || !Array.isArray(value.outbox)) throw new Error('本地数据库版本不兼容，请先导出数据');
  value.epoch ||= '';
  return value;
}
export async function saveState(value: LocalState): Promise<void> {
  const raw = JSON.stringify(value);
  if (native) return invoke('sync_local_save', { value: raw });
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(raw, 'current');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
