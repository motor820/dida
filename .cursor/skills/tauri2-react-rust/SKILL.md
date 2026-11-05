---
name: tauri2-react-rust
description: 修改 Dida 的 React/TypeScript 前端、Tauri 2 桌面适配和 Rust 同步功能时使用；依据本仓库的 SQLite/IndexedDB 离线数据流及现有回归验证改动。
---

# Dida Tauri / React / Rust 开发

首先读根目录 AGENTS.md 和目标目录嵌套指南。当前事实见 ARCHITECTURE.md、TODO.md 和 docs/WORK-STATUS.md，不依赖原作者机器路径或不存在的外部技能。

- 网页和 Mac 使用同一 src/ 入口。组件经 hooks/services 进入 sync store，禁止绕过 outbox 直接写任务；Mac 为 SQLite，网页为 IndexedDB。
- 正常业务写入通过共享服务；原生 IPC 位于 sync/persistence.ts、sync/api.ts 和 Rust commands/sync.rs。TypeScript/Rust 保留现有 snake_case 字段。
- Rust 数据层为 rusqlite 与 Arc<Mutex<Connection>>；不把通用 sqlx 示例当项目实现。Tauri 2 使用 capabilities/CSP，不使用 Tauri 1 allowlist。
- App/可执行文件名 Dida，bundle identifier com.akm.dida-clone 与旧数据路径保持兼容。Keychain 存令牌，不把令牌传回 JS 或写日志。
- 重复任务使用共享 recurrence 模块；完成、子任务复制、确定 ID 和初始化优先级必须保留原子性与去重。
- 同步与设置位于左下角；不要恢复旧顶部状态行。界面事实及未完成功能见 TODO.md。

按影响运行 npm run build、test:sync、test:tasks、test:recurrence；Rust 使用 local-store/server 的 cargo test。改动重复/同步时补运行隔离 API 浏览器测试。现有 Python Playwright 回归见 docs/WEB-TASK-ACCEPTANCE.md，MCP 用 npm run test:mcp。

部署机 1420 是旧网页；调试另选端口。修改源码、发布网页、替换 API 和 GitHub Mac 打包分别验收，不把编译通过当真机功能验收。
