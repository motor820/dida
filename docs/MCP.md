# Dida MCP 与 Rona 接入

## 当前交付

`mcp/` 提供标准 stdio MCP server，使用官方 TypeScript SDK v2，Node.js 24 直接运行 JavaScript 与共享 TypeScript 模块。OpenClaw 按需启动并管理进程，不新增公网监听端口或独立 daemon。

架构：Rona → OpenClaw 原生 MCP 客户端 → Dida MCP → 现有认证/同步 API → Dida 服务端。日常任务操作不直接写数据库；网页和 Mac 通过原同步机制接收变化。完成重复任务复用 `src/services/recurrence.ts` 的实例 ID、时区与子任务复制逻辑。

## 安装与运行

在源码根目录执行：

```bash
npm ci --prefix mcp
npm run test:mcp
DIDA_API_URL=http://127.0.0.1:1430 \
DIDA_MCP_TOKEN_FILE=/home/motor/dida/private/mcp-session.json \
npm run mcp
```

stdout 是 MCP 协议，不用于普通日志。HTTP API 仅允许 HTTPS 或本机回环 HTTP；请求禁止重定向，凭据不随重定向传出。

## 认证与维护

本机维护者显式生成一个与普通登录会话同样可撤销、有效 30 天的专用设备会话，不读取或更改用户密码：

```bash
python3 ops/provision-mcp-session.py \
  --database /home/motor/dida/data/dida.sqlite3 \
  --token-file /home/motor/dida/private/mcp-session.json
```

只有此配置脚本访问数据库的 sessions 表，正常 MCP 操作全部走 API。文件权限为 600，令牌不会写到 stdout、OpenClaw JSON 或 Git。重复配置只撤销原 MCP 文件对应会话，保留其他设备。生产接入前先执行 workspace 的 `ops/dida.sh backup`。

用户可在 Dida 账号设置中撤销“Rona · Dida MCP”。改密、撤销和数据库恢复后 MCP 会话失效；到期也是如此，需维护者重新执行上面的配置命令。server 每次请求重读会话文件，不需要为轮换重启 OpenClaw。**不自动重建被撤销的权限**。服务端备份恢复会撤销全部设备会话，所以不需要将旧 MCP 令牌作为有效凭据恢复。

## OpenClaw 配置

已在本机 `~/.openclaw/openclaw.json` 的 `mcp.servers.dida` 注册。显式维护安装脚本为 `python3 ops/install-openclaw-mcp.py`，它先备份 OpenClaw 配置与 Rona 规则，再安装本 checkout 的 skill 和配置，不自动生成新会话。配置只保存命令及凭据文件路径：

```json
{
  "transport": "stdio",
  "enabled": true,
  "command": "/home/motor/.nvm/versions/node/v24.22.1/bin/node",
  "args": ["--experimental-strip-types", "/home/motor/dida/worktrees/web-macos-sync/mcp/src/server.mjs"],
  "cwd": "/home/motor/dida/worktrees/web-macos-sync",
  "env": {
    "DIDA_API_URL": "http://127.0.0.1:1430",
    "DIDA_MCP_TOKEN_FILE": "/home/motor/dida/private/mcp-session.json"
  },
  "connectionTimeoutMs": 15000,
  "requestTimeoutMs": 60000,
  "supportsParallelToolCalls": false,
  "codex": { "agents": ["main"] }
}
```

`codex.agents` 是 OpenClaw 对原生 Codex 线程的投影范围；其他运行方式仍遵循 OpenClaw 的既有工具策略。未修改工具审批模式或其他代理权限。配置已验证且 Gateway 热加载日志确认应用；MCP 的会话级连接在 Rona 下一次运行时建立，不通过重启打断现有会话。

核验命令：

```bash
openclaw config validate --json
openclaw mcp doctor dida --probe --json
openclaw mcp probe dida --json
openclaw skills info dida-tasks --agent main --json
```

已验证发现 12 个工具、无 MCP 诊断错误，Rona skill 为 eligible/modelVisible。正式账号的状态和待办只读 MCP 调用通过；没有给正式账号创建测试待办。Gateway 的通用 `tools.invoke` 不物化会话 MCP 工具，不能把该接口的 not_found 当作 MCP server 失败；应使用原生 MCP 客户端或实际代理运行。未向聊天渠道发送测试消息。

## 工具与 Rona skill

OpenClaw 工具名加 `dida__` 前缀，例如 `dida__dida_list_tasks`。提供状态、任务查询/详情/创建/修改/完成/回收站/恢复、清单查询与保存、标签查询与保存。创建使用固定 request_id 去重，更新只提交变化字段，显式完成布尔值避免重试反向切换。父子变更及下一期生成在单次 API 事务中提交；超过 100 条记录或请求体限制时拒绝整次写入，不分批造成部分成功。不提供永久删除、改密或任意 SQL 工具。

技能源码：[dida-tasks/SKILL.md](../integrations/openclaw/dida-tasks/SKILL.md)，安装于 `~/.openclaw/workspace/skills/dida-tasks/SKILL.md`。已同步 Rona AGENTS 与 personalrepo skill 的路由：新待办及状态以 Dida 为准，旧 personalrepo action_items 保留，不自动迁移。知识资料仍走 personalrepo。

原 OpenClaw 配置与规则保存在 workspace 的受限 `private/openclaw-dida-时间戳/`；回退时仅恢复本次改动，避免覆盖其他后续配置。移除集成可删除 `mcp.servers.dida` 和 dida-tasks 技能，再从 Dida 设置撤销该专用设备会话。

## 验证与边界

隔离测试启动真实 Rust API、临时 SQLite 和两个独立 MCP 客户端，验证协议发现、账号认证、清单/标签/任务、新建去重、独立字段保留、输入拒绝、并发重复任务生成、删除恢复和会话撤销。另验证配置脚本不改密码、不撤销其他设备、不泄露凭据。

每次调用从 API 完整分页读取历史并按固定水位还原最新状态；当前适合个人任务规模，未进行大规模历史性能测试。提醒工具只设置 Dida 的应用内提醒，不意味着进程退出后的系统推送或 OpenClaw 定时通知。标准 SDK 接入与只读生产验证均已完成，未声称经过 Rona 模型自主规划的完整自然语言验收。
