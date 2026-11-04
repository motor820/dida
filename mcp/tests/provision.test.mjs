import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

test('local provisioning preserves password and other devices, rotates only its own session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dida-provision-test-'));
  const database = join(directory, 'dida.sqlite3'), tokenFile = join(directory, 'private/session.json');
  const db = new DatabaseSync(database);
  try {
    db.exec("CREATE TABLE account(id INTEGER PRIMARY KEY,password_hash TEXT); INSERT INTO account VALUES(1,'unchanged-test-hash'); CREATE TABLE sessions(hash TEXT PRIMARY KEY,name TEXT,created INTEGER,expires INTEGER); INSERT INTO sessions VALUES('native-device','Mac',0,9999999999999);");
    const run = () => {
      const result = spawnSync('python3', [resolve(import.meta.dirname, '../../ops/provision-mcp-session.py'), '--database', database, '--token-file', tokenFile], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const stdout = run(), first = JSON.parse(await readFile(tokenFile, 'utf8'));
    assert.ok(!stdout.includes(first.token));
    assert.equal((await stat(tokenFile)).mode & 0o777, 0o600);
    assert.ok(first.expires_at <= Date.now() + 30 * 86400000);
    run(); const second = JSON.parse(await readFile(tokenFile, 'utf8'));
    assert.notEqual(first.token, second.token);
    assert.equal(db.prepare('SELECT password_hash FROM account').get().password_hash, 'unchanged-test-hash');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE hash=?').get(createHash('sha256').update(first.token).digest('hex')).n, 0);
    assert.equal(db.prepare("SELECT name FROM sessions WHERE hash='native-device'").get().name, 'Mac');
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
});
