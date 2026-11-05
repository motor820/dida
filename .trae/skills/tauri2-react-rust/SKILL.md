---
name: tauri2-react-rust
description: 仅在维护 app/ 的 Dida 0.1 旧局域网 checkout 时使用；新版网页、Mac、同步和 MCP 开发转到新版工作树。
---

# 旧版 Dida 维护

以本 checkout 根 AGENTS.md 和实际源码为准。当前是 legacy/lan-web，代码为旧 React + Tauri/rusqlite，浏览器存储为 localStorage；没有新版同步队列和 MCP。已有 barrel 导出，Rust/TS 字段是 snake_case，不使用 sqlx 连接池或 Tauri 1 allowlist 模板。

不要将这里的历史版本当最新应用。新版开发和操作说明见 [当前文档](../../../../worktrees/web-macos-sync/docs/index.md)。保留旧数据，先导出再迁移；不要以删除数据库重置来排查用户数据问题。
