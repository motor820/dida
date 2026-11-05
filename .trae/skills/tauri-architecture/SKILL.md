---
name: tauri-architecture
description: 在调整 Dida 的共享前端、离线同步、Tauri 原生边界、Rust API 或 MCP 架构时使用；围绕现有模块划分和数据兼容性做设计。
---

# Dida 架构工作约定

以根目录 AGENTS.md 和 ARCHITECTURE.md 为当前实现来源，TODO.md 为候选需求，不把通用模板中的文件、API 或依赖视为已存在。

## 数据边界

React UI → query hooks → services → offline sync store。持久化适配器用 isTauri 区分 Mac SQLite 与浏览器 IndexedDB；业务修改和 outbox 原子保存。Zustand 仅保存 UI 状态。

Mac commands/sync.rs 处理 SQLite、Keychain 与固定 HTTPS 请求；legacy repositories 供旧数据读取。保留 com.akm.dida-clone 及现有用户数据库，应用名为 Dida。后端使用 rusqlite，不迁移到 sqlx 以匹配模板。Tauri 2 权限为 capabilities/CSP，不是旧 allowlist。

API 使用字段级 HLC 合并、initialize/initial 优先级、幂等操作、终止删除和分页水位。重复生成复用 services/recurrence.ts 与 utils/recurrence.ts，不能在各端另写一套日期或去重规则。

MCP 是独立 Node 24 stdio 适配层，通过 API 操作同一数据，不是旁路任务库；Rona skill 只负责路由和使用约定。独立会话显式配置，撤销后不自动恢复。详见 docs/MCP.md。

## 变更验证

先列出受影响的数据/协议/客户端，再选择相关 Node、Cargo、MCP 和 Python Playwright 回归。保留离线队列、旧库与原子性。隔离数据库和端口，不用正式数据做写入测试。

源码提交不等于部署或 Mac 交付。macos-trial.yml 交叉编译 ARM64，另以 Intel 版本检查启动；新版 M1 功能仍需实际验收。未交付能力和当前发布记录见 TODO.md、docs/RELEASES.md。
