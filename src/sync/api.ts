import { invoke } from '@tauri-apps/api/core';
import { native } from './persistence';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let status: number, data: T & { error?: string };
  if (native) {
    const response = await invoke<{ status: number; data: T & { error?: string } }>('sync_request', { method, path: `/api/v1${path}`, body: body ?? null });
    status = response.status; data = response.data;
  } else {
    const response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    status = response.status; data = await response.json();
  }
  if (status >= 300) throw new ApiError(status, data.error || `请求失败 (${status})`);
  return data;
}
