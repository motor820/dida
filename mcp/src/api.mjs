import { readFile, stat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { emptyState, applyOperation, observeClock, decodeRecord, stamp } from '../../src/sync/model.ts';

export class DidaApi {
  constructor({ url = process.env.DIDA_API_URL || 'http://127.0.0.1:1430', tokenFile = process.env.DIDA_MCP_TOKEN_FILE } = {}) {
    this.base = new URL(url);
    if (this.base.username || this.base.password || this.base.search || this.base.hash || this.base.pathname !== '/') throw new Error('DIDA_API_URL 必须是服务根地址');
    if (this.base.protocol !== 'https:' && !(this.base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(this.base.hostname))) throw new Error('Dida API 仅支持 HTTPS 或本机回环 HTTP');
    this.tokenFile = tokenFile;
    this.device = `mcp_${randomUUID().replaceAll('-', '')}`;
    this.queue = Promise.resolve();
  }
  async credential() {
    if (!this.tokenFile) throw new Error('未配置 DIDA_MCP_TOKEN_FILE，请由本机维护者配置独立 MCP 会话');
    let value;
    try {
      const info = await stat(this.tokenFile);
      if ((info.mode & 0o077) !== 0) throw new Error('会话文件权限必须为 600');
      value = JSON.parse(await readFile(this.tokenFile, 'utf8'));
    } catch (error) {
      if (error.message === '会话文件权限必须为 600') throw error;
      throw new Error('无法读取 MCP 会话文件，请由本机维护者运行会话配置脚本');
    }
    if (!Number.isFinite(value.expires_at) || !/^[a-f0-9]{64}$/.test(value.token || '')) throw new Error('MCP 会话文件格式错误');
    if (value.expires_at <= Date.now()) throw new Error('Dida MCP 会话已过期，请由维护者重新配置；不要重置用户密码');
    return value;
  }
  async request(method, path, body) {
    const { token } = await this.credential();
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await fetch(new URL(path, this.base), {
          method, redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${token}`, 'X-Dida-Client': 'native', 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch {
        if (!attempt) continue;
        throw new Error('Dida API 连接失败；操作可能已到达服务器，创建重试请沿用 request_id');
      }
      if (response.status === 401) throw new Error('Dida MCP 会话失效或已撤销，请由维护者重新配置；不要索要或重置用户密码');
      if (response.status >= 500 && !attempt) { await response.body?.cancel(); continue; }
      let data;
      try { data = await response.json(); } catch { throw new Error(`Dida API 响应格式错误（HTTP ${response.status}）`); }
      if (!response.ok) throw new Error(`Dida API 拒绝操作（HTTP ${response.status}）`);
      return data;
    }
  }
  async snapshot() {
    const session = await this.request('GET', '/api/v1/auth/session');
    const state = emptyState();
    state.device = this.device;
    state.offset = session.time - Date.now();
    state.username = session.username;
    state.epoch = session.epoch;
    let cursor = 0, until;
    for (let page = 0; page < 10000; page++) {
      const data = await this.request('GET', `/api/v1/sync/pull?after=${cursor}${until === undefined ? '' : `&until=${until}`}`);
      until ??= data.until;
      if (!Array.isArray(data.records) || !Number.isSafeInteger(data.cursor) || data.until !== until) throw new Error('同步响应无效');
      for (const record of data.records) {
        // Pull pages contain successive full record versions; use the last one at this water mark.
        state.records[`${record.kind}:${record.id}`] = record;
        for (const field of Object.values(record.fields)) observeClock(state, field.stamp);
      }
      state.offset = data.time - Date.now();
      if (!data.has_more) return state;
      if (data.cursor <= cursor) throw new Error('同步分页没有前进');
      cursor = data.cursor;
    }
    throw new Error('同步历史过长，无法完整读取；没有执行写操作');
  }
  values(state, kind, { tombstones = false } = {}) {
    return Object.values(state.records).filter(r => r.kind === kind && (tombstones || r.fields.__deleted?.value !== true)).map(r => {
      const { __dida_base: _baseline, ...value } = decodeRecord(r);
      return value;
    });
  }
  async push(state, updates) {
    const operations = [];
    for (const update of updates) {
      const existing = state.records[`${update.kind}:${update.id}`];
      if (existing?.fields.__deleted?.value === true) throw new Error('记录已永久删除，不能恢复或覆盖');
      const patch = Object.fromEntries(Object.entries(update.value).filter(([key, value]) => value !== undefined && JSON.stringify(existing?.fields[key]?.value) !== JSON.stringify(value)));
      if (!Object.keys(patch).length) continue;
      const operation = { op_id: randomUUID(), kind: update.kind, id: update.id, patch, stamp: stamp(state), ...(update.initialize ? { initialize: true } : {}) };
      operations.push(operation);
      applyOperation(state, operation);
    }
    if (!operations.length) return false;
    if (operations.length > 100) throw new Error('本次操作涉及超过 100 条记录，未执行；请缩小范围');
    const body = { device_id: this.device, operations };
    if (Buffer.byteLength(JSON.stringify(body)) > 1900000) throw new Error('操作内容过大，未执行；请缩小范围');
    const result = await this.request('POST', '/api/v1/sync/push', body);
    if (operations.some(op => !result.ack?.includes(op.op_id))) throw new Error('服务器未确认全部操作，请查询当前状态后再试');
    return true;
  }
  exclusive(callback) {
    const result = this.queue.then(async () => callback(await this.snapshot()));
    this.queue = result.catch(() => {});
    return result;
  }
}
export function requestId(kind, key) {
  return `mcp_${createHash('sha256').update(`${kind}:${key}`).digest('hex')}`;
}
