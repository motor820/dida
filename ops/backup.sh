#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
set -a
source "$project_dir/private/environment"
set +a
backup_dir="$project_dir/backups"
mkdir -p "$backup_dir"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || { echo 'Another backup is already running' >&2; exit 1; }
backup_stamp=$(date +%Y%m%d-%H%M%S)
db="$backup_dir/dida-${backup_stamp}.sqlite3"
config="$backup_dir/config-${backup_stamp}.tar.gz"
[[ ! -e "$db" && ! -e "$config" ]] || { echo 'Backup timestamp already exists' >&2; exit 1; }
backup_tmp=$(mktemp -d "$backup_dir/.pending-XXXXXX")
trap 'rm -rf -- "$backup_tmp"' EXIT
"$project_dir/runtime/dida-sync-server" backup "$backup_tmp/database.sqlite3"
python3 - "$backup_tmp/database.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(f'file:{sys.argv[1]}?mode=ro',uri=True) as conn:
    assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok','Backup integrity check failed'
PY
tar -czf "$backup_tmp/config.tar.gz" -C "$project_dir/private" environment initial-password initial-credentials.txt
mv -- "$backup_tmp/config.tar.gz" "$config"
mv -- "$backup_tmp/database.sqlite3" "$db"
python3 - "$backup_dir" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1]); pairs=[]
for db in sorted(root.glob('dida-*.sqlite3'),reverse=True):
    config=root/('config-'+db.name[5:-8]+'.tar.gz')
    if config.is_file():pairs.append((db,config))
for db,config in pairs[14:]:
    db.unlink();config.unlink()
print(f'Backup complete; retained {min(len(pairs),14)} complete database/configuration pairs.')
PY
