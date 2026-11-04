import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = resolve(import.meta.dirname, '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('stdio MCP against a real isolated Dida API', { timeout: 60000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'dida-mcp-test-'));
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`, tokenFile = join(dir, 'session.json');
  const password = randomBytes(24).toString('hex'), passwordFile = join(dir, 'password');
  await writeFile(passwordFile, password, { mode: 0o600 });
  const api = spawn(process.env.DIDA_TEST_SERVER_BIN || join(root, 'server/target/debug/dida-sync-server'), [], {
    env: { ...process.env, DIDA_DATA_DIR: dir, DIDA_PASSWORD_FILE: passwordFile, DIDA_USERNAME: 'mcp-test', DIDA_BIND: `127.0.0.1:${port}`, DIDA_PUBLIC_URL: origin, DIDA_WEB_DIR: join(root, 'dist') }, stdio: 'ignore',
  });
  let token, client, client2, task, child, list, tag;
  async function request(path, method = 'GET', body) {
    const response = await fetch(origin + '/api/v1' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Dida-Client': 'native', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, 200); return response.json();
  }
  async function connect() {
    const c = new Client({ name: 'dida-test', version: '1.0.0' });
    await c.connect(new StdioClientTransport({ command: process.execPath, args: ['--experimental-strip-types', join(root, 'mcp/src/server.mjs')], env: { ...process.env, DIDA_API_URL: origin, DIDA_MCP_TOKEN_FILE: tokenFile }, stderr: 'pipe' }));
    return c;
  }
  async function call(name, input = {}, c = client) {
    const result = await c.callTool({ name, arguments: input });
    assert.ok(!result.isError, result.content?.map(c => c.text).join(''));
    return result.structuredContent || JSON.parse(result.content[0].text);
  }
  async function fail(name, input, pattern) {
    const result = await client.callTool({ name, arguments: input });
    assert.equal(result.isError, true); assert.match(result.content.map(c => c.text).join(''), pattern);
  }
  try {
    for (let i = 0; i < 100; i++) {
      if (api.exitCode !== null) throw new Error('Isolated API exited');
      try { if ((await fetch(origin + '/healthz')).ok) break; } catch {}
      if (i === 99) throw new Error('API did not start'); await delay(50);
    }
    token = (await request('/auth/login', 'POST', { username: 'mcp-test', password, device_name: 'MCP test' })).token;
    assert.match(token, /^[a-f0-9]{64}$/);
    await writeFile(tokenFile, JSON.stringify({ token, expires_at: Date.now() + 3600000 }), { mode: 0o600 });
    client = await connect(); client2 = await connect();
    await t.test('discovery and authenticated status', async () => {
      const tools = await client.listTools(); assert.equal(tools.tools.length, 12);
      assert.equal((await call('dida_status')).username, 'mcp-test');
      assert.equal(tools.tools.find(t => t.name === 'dida_list_tasks').annotations.readOnlyHint, true);
    });
    await t.test('lists/tags, subtasks and idempotent creation', async () => {
      list = (await call('dida_save_list', { request_id: 'work', name: '测试清单' })).list;
      tag = (await call('dida_save_tag', { request_id: 'work', name: '重点' })).tag;
      const input = { request_id: 'parent', title: '隔离待办', description: '原始描述', list_id: list.id, tags: [tag.id], due_at: new Date(Date.now() + 86400000).toISOString(), repeat_rule: { type: 'daily' } };
      task = (await call('dida_create_task', input)).task;
      assert.equal((await call('dida_create_task', input)).created, false);
      child = (await call('dida_create_task', { request_id: 'child', title: '检查项', parent_id: task.id })).task;
      assert.equal(child.list_id, list.id);
      assert.equal((await call('dida_get_task', { task_id: task.id })).subtasks.length, 1);
      assert.equal((await call('dida_list_tasks', { query: '隔离', tag_id: tag.id })).total, 1);
    });
    await t.test('partial update preserves other fields; invalid refs/dates/cycles do not write', async () => {
      await request('/sync/push', 'POST', { device_id: 'external', operations: [{ kind: 'task', id: task.id, op_id: 'external-edit', patch: { description: '另一设备的修改' }, stamp: `${Date.now()}-000000-external` }] });
      assert.equal((await call('dida_update_task', { task_id: task.id, title: '修改标题' })).task.description, '另一设备的修改');
      await fail('dida_update_task', { task_id: task.id, parent_id: child.id }, /循环/);
      await fail('dida_update_task', { task_id: task.id, due_at: '2026-11-06' }, /时区/);
      await fail('dida_create_task', { request_id: 'bad', title: '不应生成', list_id: 'missing' }, /清单/);
      assert.equal((await call('dida_list_tasks', { query: '不应生成' })).total, 0);
    });
    await t.test('two MCP clients completing a recurrence create one successor tree', async () => {
      const results = await Promise.all([call('dida_set_task_completed', { task_id: task.id }), call('dida_set_task_completed', { task_id: task.id }, client2)]);
      assert.equal(new Set(results.flatMap(r => r.generated_tasks.map(t => t.id))).size, 2);
      assert.equal((await call('dida_list_tasks', { include_subtasks: true })).total, 2);
      const successor = results.flatMap(r => r.generated_tasks).find(t => !t.parent_id);
      await call('dida_update_task', { task_id: successor.id, title: '下一期编辑' });
      await call('dida_set_task_completed', { task_id: task.id, completed: false });
      assert.equal((await call('dida_set_task_completed', { task_id: task.id })).generated_tasks.length, 0);
      assert.equal((await call('dida_get_task', { task_id: successor.id })).task.title, '下一期编辑');
    });
    await t.test('trash and restore keep child identity', async () => {
      assert.ok((await call('dida_trash_task', { task_id: task.id })).affected_ids.includes(child.id));
      assert.equal((await call('dida_list_tasks', { status: 'trash', include_subtasks: true })).total, 2);
      await fail('dida_restore_task', { task_id: child.id }, /恢复父任务/);
      await call('dida_restore_task', { task_id: task.id });
      assert.equal((await call('dida_get_task', { task_id: child.id })).task.is_deleted, false);
    });
    await t.test('revocation fails closed without leaking or renewing the session', async () => {
      await request('/devices/' + createHash('sha256').update(token).digest('hex'), 'DELETE');
      await fail('dida_status', {}, /失效或已撤销/);
      const result = await client.callTool({ name: 'dida_create_task', arguments: { request_id: 'revoked', title: '不可创建' } });
      assert.equal(result.isError, true); assert.ok(!JSON.stringify(result).includes(token));
    });
  } finally {
    await client?.close(); await client2?.close(); api.kill('SIGTERM');
    if (api.exitCode === null) await new Promise(resolve => api.once('exit', resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
