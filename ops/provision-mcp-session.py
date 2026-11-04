#!/usr/bin/env python3
"""Explicit local administrator provisioning of a revocable Dida MCP device session.

Only this provisioning command touches sessions; normal MCP operations use the API.
It never reads, changes, or prints the user's password/hash and never renews revoked sessions automatically.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import tempfile
import time


def provision(database: Path, token_file: Path, name: str, days: int):
    if not database.is_file():
        raise ValueError('Existing Dida database required; refusing to create one')
    token_file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if token_file.is_symlink():
        raise ValueError('Token file must not be a symlink')
    previous = None
    if token_file.exists():
        previous = json.loads(token_file.read_text()).get('token')
    token = secrets.token_hex(32)
    created = int(time.time() * 1000)
    expires = created + days * 86400000
    credential = {'token': token, 'expires_at': expires, 'device_name': name}
    fd, temporary = tempfile.mkstemp(prefix='.mcp-session-', dir=token_file.parent)
    new_hash = hashlib.sha256(token.encode()).hexdigest()
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(credential, stream)
            stream.flush()
            os.fsync(stream.fileno())
        with sqlite3.connect(f'file:{database}?mode=rw', uri=True, timeout=10) as connection:
            connection.execute('INSERT INTO sessions(hash,name,created,expires) VALUES(?,?,?,?)',
                               (new_hash, name, created, expires))
        try:
            os.replace(temporary, token_file)
        except BaseException:
            with sqlite3.connect(f'file:{database}?mode=rw', uri=True, timeout=10) as connection:
                connection.execute('DELETE FROM sessions WHERE hash=?', (new_hash,))
            raise
        if previous:
            with sqlite3.connect(f'file:{database}?mode=rw', uri=True, timeout=10) as connection:
                connection.execute('DELETE FROM sessions WHERE hash=?', (hashlib.sha256(previous.encode()).hexdigest(),))
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {'device_name': name, 'expires_at': expires, 'token_file': str(token_file), 'password_changed': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--token-file', required=True, type=Path)
    parser.add_argument('--name', default='Rona · Dida MCP')
    parser.add_argument('--days', default=30, type=int, choices=range(1, 31), metavar='1..30')
    args = parser.parse_args()
    if not args.name or len(args.name) > 200:
        parser.error('Device name must be 1–200 characters')
    print(json.dumps(provision(args.database.resolve(), args.token_file.absolute(), args.name, args.days), ensure_ascii=False))
