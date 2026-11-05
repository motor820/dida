# Dida 0.2 实现架构

更新：2026-11-05。这里描述当前代码；待办见 [TODO.md](TODO.md)。

## 共享界面与业务

网页和 Mac 使用同一个 `src/main.tsx → App.tsx` 入口。`SyncGate` 负责初始化和登录门禁，授权后渲染全高内容；`NavRail` 左下角刷新按钮调用同步，下方设置通过 portal 打开 `SyncPanel`，没有顶部状态条。

数据流：`组件 → React Query hooks → services → sync/store.ts → 持久化与同步 API`。Zustand 保存面板、选中项等 UI 状态。业务实体沿用 snake_case 字段；任务日期为 Unix 秒，操作时钟/会话时间为毫秒。

- `sync/model.ts`：记录、混合逻辑时钟、字段合并、初始化标记及终止删除。正常修改优先于重复实例初始化，防止迟到初始化重置编辑。
- `sync/store.ts`：原子保存业务修改与 outbox、分页同步、导入导出和会话状态。
- `sync/persistence.ts`：官方 isTauri 选择 Mac SQLite IPC 或浏览器 IndexedDB；localStorage 仅作旧数据导入来源。
- `services/recurrence.ts` 与 `utils/recurrence.ts`：完成时复制下一期和子任务树、确定 ID、时区、月末/闰年及跳过逾期计划。共享代码同时用于 Mac 与 MCP，旧包不会因服务端升级自动获得新前端逻辑。

## Mac 原生边界

`src-tauri/tauri.conf.json` 的 productName、mainBinaryName 为 Dida，bundle identifier 保持 `com.akm.dida-clone`。Tauri 构建先运行前端构建并嵌入 dist，本机窗口不是在线网页的快捷方式。

`lib.rs` 注册旧数据只读及同步 IPC、单实例保护。`commands/sync.rs` 使用固定 HTTPS API、禁止重定向，令牌保存在 Keychain；`crates/local-store/` 原子保存 `sync_local_state`。旧 db/ 关系表及 rusqlite 的 `Arc<Mutex<Connection>>` 保留供导入，没有 sqlx 连接池。

## 服务端与协议

独立 `server/` 使用 Axum 和 SQLite。`web.rs` 提供认证、同步与设备路由；`store.rs` 处理事务、字段时间合并、幂等操作、初始化优先级、终止删除和会话。

单账号关闭公开注册，用户名由 DIDA_USERNAME 提供；有效密码哈希在数据库，初始密码文件仅用于首次创建。网页使用 Secure/HttpOnly/SameSite Cookie，原生和 MCP 使用 Bearer 会话。改密与恢复撤销会话；每批最多 100 个操作，详情见 [安全记录](docs/SECURITY-REVIEW.md)。无端到端加密。

## MCP 与 Rona

`mcp/` 使用 SDK v2 stdio，Node 24 运行，并通过同一 API 查询/提交操作。每次按固定水位分页还原最新状态；创建 request_id 去重、显式完成状态和原子操作上限避免重试/部分写入。专用会话通过本机维护脚本配置，600 权限文件，不自动续建被撤销的权限。

Rona 的轻量 skill 仅负责工具路由、日期和 ID 约定；新待办归 Dida，历史 personalrepo action_items 不自动迁移。当前已有 12 个工具，见 [MCP.md](docs/MCP.md)。

## 部署、构建与验证

API 由 systemd 用户服务监听 127.0.0.1:1430，OpenResty 提供 HTTPS。部署文件与数据位于源码之外，见 [目录](docs/deployment/directory-layout.md)。

GitHub 在 Intel Mac 上交叉编译 ARM64 APP/DMG，再编译 Intel 版作启动与 SQLite 检查；验证名称 Dida 和签名，仅上传 M1 包。Node/SQLite/服务端/MCP 和 Python Playwright 回归分别覆盖业务与界面；CI 启动不等于新版 M1 逐项功能验收。
