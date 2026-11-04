---
trigger: always_on
---

# Dida 开发约定

当前交付范围为网页、M1 Mac 和单用户同步。安卓暂缓。首先阅读仓库根目录 `AGENTS.md`，修改目录时再读其嵌套指南；实际状态以 `TODO.md` 和 `docs/WORK-STATUS.md` 为准。

业务数据流为组件 → hooks → services → sync store → Mac SQLite / 网页 IndexedDB。不要绕过离线队列直接写数据库，也不要在组件里调用 IPC。Zustand 只保存 UI 状态，React Query 反映业务查询。

Rust 使用 rusqlite，不使用 sqlx；当前模型保留 snake_case 字段。Tauri 2 权限使用 capabilities/CSP，不能复制 Tauri 1 allowlist 示例。保留原应用标识和用户数据库，测试使用隔离数据。

执行前端构建和相关 Node/Rust 测试。源码提交、Mac 打包与生产部署分别记录；当前下载工作流为 `macos-trial.yml`。用户已确认 M1 版测试通过，未逐项记录的后台行为仍需专项验收。

可参考仓库内技术资料，但通用模板不得覆盖实际实现。不得依赖原作者机器上的绝对路径或不存在的外部技能。不要记录口令或令牌。
