#!/usr/bin/env python3
"""Install this checkout's Dida MCP and thin skill into the local Rona/OpenClaw.
Back up configuration and only change Dida integration and todo routing fields.
Run after dependencies and the explicit MCP device session have been configured.
"""
from pathlib import Path
from datetime import datetime
import json, os, shutil, tempfile

workspace=Path('/home/motor/dida')
source=Path(__file__).resolve().parents[1]
openclaw=Path('/home/motor/.openclaw')
rona=openclaw/'workspace'
config=openclaw/'openclaw.json'
backup=workspace/'private'/('openclaw-dida-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(mode=0o700)

def backup_file(path):
    if path.exists():
        target=backup/str(path.relative_to(openclaw))
        target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        shutil.copy2(path,target)
        target.chmod(0o600)

def atomic(path, text, mode):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.dida-update-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:
            f.write(text);f.flush();os.fsync(f.fileno())
        os.chmod(name,mode);os.replace(name,path)
    finally:
        Path(name).unlink(missing_ok=True)

paths=[config,rona/'AGENTS.md',rona/'skills/rona-personal-knowledge/SKILL.md',rona/'skills/dida-tasks/SKILL.md']
for path in paths:backup_file(path)
original=config.read_text()
d=json.loads(original)
d.setdefault('mcp',{}).setdefault('servers',{})['dida']={
 'transport':'stdio','enabled':True,
 'command':'/home/motor/.nvm/versions/node/v24.22.1/bin/node',
 'args':['--experimental-strip-types',str(source/'mcp/src/server.mjs')],
 'cwd':str(source),
 'env':{'DIDA_API_URL':'http://127.0.0.1:1430','DIDA_MCP_TOKEN_FILE':str(workspace/'private/mcp-session.json')},
 'connectionTimeoutMs':15000,'requestTimeoutMs':60000,'supportsParallelToolCalls':False,
 'codex':{'agents':['main']},
}
d.setdefault('skills',{}).setdefault('entries',{}).setdefault('dida-tasks',{})['enabled']=True
assert config.read_text()==original,'OpenClaw config changed concurrently; retry after inspection'
atomic(config,json.dumps(d,ensure_ascii=False,indent=2)+'\n',0o600)
atomic(rona/'skills/dida-tasks/SKILL.md',(source/'integrations/openclaw/dida-tasks/SKILL.md').read_text(),0o644)
p=rona/'AGENTS.md';s=p.read_text()
s=s.replace('| 待办及其当前状态 | personalrepo 的 `action_items`，通过同一 skill 操作 |','| 待办及其当前状态 | Dida MCP，通过 `skills/dida-tasks/SKILL.md` 操作；旧 personalrepo action_items 仅作历史，未经明确要求不自动迁移 |')
s=s.replace('- 待办先记录为 `note:task` 资产，再建立引用该 `asset_id` 的 `action_item`；当前状态只在 `action_items` 维护。','- 新增待办、子任务、日期和完成状态通过 `dida-tasks` 调用 Dida MCP 维护；不再为新待办建立 personalrepo action_item。相关资料仍可在 personalrepo 归档并把来源链接放进 Dida 描述；旧 action_items 保留，只有明确要求时迁移。')
atomic(p,s,0o644)
p=rona/'skills/rona-personal-knowledge/SKILL.md';s=p.read_text()
s=s.replace('记录笔记/任务/想法','记录笔记/想法').replace('更新任务状态，并同步','并同步')
s=s.replace('Use category `note`, `task`, `topic`, `idea`, `question`, `insight`, or `inbox`. For `task`, the command also creates an `action_item` linked to the returned `asset_id`. Remove the temporary Markdown after the command returns `indexed`.','Use category `note`, `topic`, `idea`, `question`, `insight`, or `inbox`. New todos and their current status belong to Dida: use `dida-tasks` and its MCP tools instead of creating personalrepo action_items. Keep supporting documents here and link them from the Dida description. Remove the temporary Markdown after the command returns `indexed`.')
s=s.replace('Update only the structured state of an existing task:','Historical personalrepo action_items remain available. Only when Motor explicitly asks to maintain a historical record (ordinary new todos go to Dida):')
atomic(p,s,0o644)
print(json.dumps({'configured_server':'dida','skill':'dida-tasks','rona_agent':'main','backup_directory':str(backup),'config_sections_changed':['mcp.servers.dida','skills.entries.dida-tasks']},ensure_ascii=False))
