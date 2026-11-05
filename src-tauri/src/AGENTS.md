# Legacy Checkout Guidelines

本目录属于 Dida 0.1 旧局域网代码，分支 legacy/lan-web。最新 Dida 0.2 网页、Mac、同步与 MCP 文档见 [新版索引](../../../worktrees/web-macos-sync/docs/index.md)；不要在旧目录实现新版需求。

## 当前旧版实现

React/TypeScript 在 src/，Tauri/Rust 在 src-tauri/。旧 services 根据环境走原生 IPC 或 localStorage；它没有新版 IndexedDB/outbox、同步 API 或 MCP。数据库用 rusqlite 和 Arc<Mutex<Connection>>，没有 sqlx 连接池。序列化字段保留 snake_case，已有 services/types 的 index.ts 导出。

## 修改与验证

先读此 checkout 的根 AGENTS.md 及相关嵌套指南。组件经 hooks/services 调用；SQL 绑定参数，不在组件直调 IPC。保留用户现有浏览器数据和本地数据库。旧源码维护补丁及旧浏览器导出页已保存到新版 ops/legacy-export/。

旧版脚本为 npm run dev / build / tauri；部署机 Vite 1420 已供旧网页使用，不能再启动冲突实例。旧库/原生路径并未自动接入新版同步，数据通过显式导出导入迁移。旧版没有新版测试脚本，不能照抄 test:mcp 或 test:recurrence 到这里执行。

原项目早期的泛化模板和功能清单仅作历史，不是现行实现或操作依据。新增开发在 worktrees/web-macos-sync/ 完成；本 checkout 的维护改动应按旧版分支单独保存。
