# Dida 0.2 架构

更新：2026-11-04。本文描述当前实现；未来候选功能见 [TODO.md](TODO.md)。

## 客户端数据流

`React 组件 → React Query hooks → services → src/sync/store.ts → 持久化与 HTTPS 同步`。

Zustand 保存面板、选中任务等 UI 状态。业务状态由离线 store 和 React Query 管理，不在组件里直接调用 IPC 或自行写数据库。

- `src/sync/model.ts`：实体、字段修改时间、合并、终止删除和操作标识。
- `src/sync/store.ts`：本地修改、待上传队列、同步、导入导出和会话状态。
- `src/sync/persistence.ts`：用官方 `isTauri()` 识别环境；Mac 调用 IPC，网页读写 IndexedDB。
- `src/sync/api.ts`：浏览器同源请求与原生请求适配。

任务、清单、标签和同步队列在一次存储提交中保存。默认智能清单由客户端计算；应用界面设置不作为业务实体同步。模型字段沿用 `parent_id`、`due_date` 等 snake_case；不要假定 TypeScript 会自动转换为 camelCase。

## Mac 原生边界

`src-tauri/src/lib.rs` 注册旧数据只读命令和当前同步 IPC。`commands/sync.rs` 提供本地状态保存、固定 HTTPS 主机请求和 Keychain 会话；不向 JavaScript 返回原生令牌。原生 HTTP 禁止重定向。

`db/` 使用 rusqlite 和 `Arc<Mutex<Connection>>`，没有 sqlx 或连接池。旧关系表保留供显式导入。`crates/local-store/` 管理 `sync_local_state` 的事务保存；本地文件仍为 `com.akm.dida-clone/dida.db`，不改 bundle identifier。

## 服务端

`server/` 是独立 Rust/Axum 程序。`web.rs` 提供认证、设备和同步路由；`store.rs` 管理 SQLite 事务、字段合并、幂等操作及会话。私人单账号关闭公开注册，用户名取 `DIDA_USERNAME`，有效密码哈希保存在数据库；初始密码文件仅在新建账号时写入哈希，不能将其当作用户改密后的有效密码。

浏览器会话用 Secure/HttpOnly/SameSite Cookie；原生端用 Keychain 令牌。按字段修改时间合并，永久删除保留终止标记。实际认证和限制见 [安全报告](docs/SECURITY-REVIEW.md)。当前没有端到端加密。

## 部署与构建

服务由 systemd 用户服务管理，仅监听 127.0.0.1:1430，已有 OpenResty 提供 HTTPS。SQLite 数据、私密配置、备份和运行产物都在源码工作树之外；布局见 [部署目录](docs/deployment/directory-layout.md)。

GitHub `macos-trial.yml` 在 Intel Mac 上交叉编译 `aarch64-apple-darwin`，另编译 Intel 版本作主机启动检查；仅上传 ARM64 APP/DMG。用户于 2026-11-04 确认 M1 真机测试通过，具体场景未逐项记录。

## 验证与边界

Node 测试覆盖合并、重试和导入；Rust 服务测试覆盖认证与同步；local-store 测试覆盖原子保存和旧库重启。浏览器断网、重连、跨端和恢复演练已有交接记录。搜索和日历目前只有入口；重复规则的完整实例调度、后台系统提醒及安卓尚未交付。网页断网编辑不代表首次离线加载可用。
