# 2026-11-05 文档与发布核对

范围：当前源码工作树全部 37 份 Markdown（不含依赖、target 和 Git 元数据），另核对旧 app/ 的全部 16 份 Markdown，以及 workspace 根 AGENTS.md 和 7 份部署说明。旧版操作指南按实际 rusqlite/IPC/localStorage 修正，早期功能/架构计划标注历史范围；原运行源码和导出文件内容核对未变。机器审计 JSON、历史测试结果和迁移验收不改写成新版结果。

## 修正内容

- 将当前状态与分阶段开发过程分离，历史记录集中标注，避免把“当时未提交/未打包”当成当前状态。
- 同步重复任务下一期、共享浏览器/Mac 逻辑、左下角刷新/设置、14px 详情及 Dida 应用名。
- 更新 MCP/Rona、独立会话维护、凭据和恢复边界；明确历史 action_items 不自动迁移。
- 清理 AI 技术模板中的旧 Tauri allowlist、sqlx 连接池及不存在的测试/文件示例，保留实际模块与测试入口。
- 当前文档经索引互相引用，原始审计/验收保留日期与版本范围；下载对应关系集中在 RELEASES.md。
- main 与开发分支交付时同步；旧工作树改名 legacy/lan-web，已核对原有 tracked diff 和 untracked 文件哈希不变。
- 仓库继续公开；用户已明确延后私有化。旧版 README 已标注历史范围，维护补丁保留依赖和 UUID 兼容修改，其他旧资料在归档分支保存。

## 本次验证

| 检查 | 结果 |
|---|---|
| Node 同步 / 子任务排序 / 主任务排序 / 重复规则 | 8 + 3 + 5 + 21 项通过 |
| SQLite / Rust API | 3 + 7 项通过；debug API 构建通过 |
| MCP 真实 stdio 与隔离 API、会话配置 | 8 项通过 |
| Python Playwright task_ui / date_repeat_ui / date_order_ui / recurrence_sync_ui | 四个脚本通过，使用隔离数据库与会话 |
| TypeScript / Vite | 生产构建通过 |
| npm audit（前端与 MCP 锁文件） | 各自 0 项已知漏洞 |
| workflow YAML、嵌入的 bash 脚本及四个 skill frontmatter | 校验通过 |
| 37 份 Markdown 本地链接、Git whitespace、旧 checkout 维护补丁 | 全部通过 |

以上共 55 项 Node/Rust/MCP 自动测试，加四个浏览器回归脚本。未重新进行第三方渗透测试或 M1 真机逐项功能验收。Rust 最新公告审计及 Mac 原生构建/签名/启动由本次 Actions 执行，最终结果见 RELEASES.md。

## 全量文档清单

| 文档 | 核对方式 |
|---|---|
| `.agent/rules/Tauri跨平台开发助手.md` | 与当前源码/配置核对；修正或确认一致 |
| `.cursor/skills/tauri2-react-rust/SKILL.md` | 与当前源码/配置核对；修正或确认一致 |
| `.trae/rules/tauri2-react-rust.md` | 与当前源码/配置核对；修正或确认一致 |
| `.trae/skills/tauri-architecture/SKILL.md` | 与当前源码/配置核对；修正或确认一致 |
| `.trae/skills/tauri2-react-rust/SKILL.md` | 与当前源码/配置核对；修正或确认一致 |
| `AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |
| `ARCHITECTURE.md` | 与当前源码/配置核对；修正或确认一致 |
| `PROJECT_SUMMARY.md` | 与当前源码/配置核对；修正或确认一致 |
| `QUICKSTART.md` | 与当前源码/配置核对；修正或确认一致 |
| `README.md` | 与当前源码/配置核对；修正或确认一致 |
| `TODO.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/BASELINE-VALIDATION.md` | 保留历史范围并明确当前入口 |
| `docs/DATE-REPEAT-ACCEPTANCE.md` | 保留历史范围并明确当前入口 |
| `docs/DOCUMENTATION-REVIEW.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/MACOS-BUILD-20261105.md` | 保留历史范围并明确当前入口 |
| `docs/MCP.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/RELEASES.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/SECURITY-REVIEW.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/SYNC-PLAN.md` | 保留历史范围并明确当前入口 |
| `docs/WEB-MACOS.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/WEB-TASK-ACCEPTANCE.md` | 保留历史范围并明确当前入口 |
| `docs/WORK-STATUS.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/deployment/WORKSPACE-GUIDELINES.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/deployment/backup-policy.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/deployment/directory-layout.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/deployment/index.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/deployment/migration-rollback.md` | 保留历史范围并明确当前入口 |
| `docs/deployment/operations.md` | 与当前源码/配置核对；修正或确认一致 |
| `docs/history/2026-11-04-05-development.md` | 保留历史范围并明确当前入口 |
| `docs/index.md` | 与当前源码/配置核对；修正或确认一致 |
| `integrations/openclaw/dida-tasks/SKILL.md` | 与当前源码/配置核对；修正或确认一致 |
| `ops/README.md` | 与当前源码/配置核对；修正或确认一致 |
| `src/AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |
| `src/components/AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |
| `src/components/Task/AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |
| `src-tauri/src/AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |
| `src-tauri/src/db/AGENTS.md` | 与当前源码/配置核对；修正或确认一致 |

## 文档与安装包对应关系

Mac 构建使用与推送的 main 相同源码，产物内保存 COMMIT.txt、BUILD-INFO.json 和校验和。构建成功后可追加纯交付元数据提交；若后续提交只修改说明和下载链接，记录其与实际安装包源码的对应关系，不把两个提交号混为一谈。旧的 baseline 标签仍是历史快照，不重写。

旧版归档提交 7716f03 单独位于 legacy/lan-web，保存先前的依赖锁文件、UUID 兼容修复、导出页和 16 份旧文档的范围修正；未将旧实现合并覆盖新版。两个实际 checkout 的最终工作状态也会核对。

## 最终构建结果

Actions 41938054981 在 main 的源码 de4b96f 上全部 success。ARM64 APP/DMG、CFBundleName=Dida、签名、Intel 主机启动、SQLite 完整性及上传检查均通过；artifact ID 13375317372，最新链接与有效期见 RELEASES.md。本次只补录交付元数据和旧文档归档，不改变该安装包的运行源码。用户稍后手动处理仓库私有化，当前仓库仍公开。
