# Dida 当前开发基线

更新：2026-11-04。应用版本 0.2.0；上一应用提交 `96dccb1`。本次文档和运维整理提交作为后续开发基线；准确提交号请用 `git log -1` 查询，避免自引用提交号。

## 已交付与用户确认

- 网页、离线 Mac 客户端及自建单账号同步已交付；安卓暂缓。
- 用户于 2026-11-04 明确确认“M1 版本测试通过”。这是用户真机验收结果，未提供逐项测试记录。
- 已验证 GitHub Actions 构建 `41673984772` 全部完成，ARM64 APP/DMG 上传成功；安装包在 GitHub，未下载到部署机。
- 网页/API： https://dida.aiking.net:888/ 。当前用户名 `motordida`；用户已手动修改密码，最近用户名变更前后已核对密码哈希不变。密码和初始凭据不进入 Git。

## 已有验证证据

此前记录：8 项 TS 同步核心、5 项 Rust 服务端、3 项 SQLite 回归通过；双浏览器完成跨端、断网重连、刷新、认证检查；隔离备份恢复已验证完整性、会话撤销和 epoch 更换。安全报告及机器证据在 `docs/SECURITY-REVIEW.md` 与 `docs/security/`，不将当时扫描结果当作永久无漏洞保证。

本次基线的重新验证结果记录在 `docs/BASELINE-VALIDATION.md`。

## 仓库与本机状态

- 维护仓库： https://github.com/motor820/dida 。原始仓库为 `jameingh/dida-clone`，仅作上游来源。
- 新版源码：`/home/motor/dida/worktrees/web-macos-sync/`，分支 `feature/web-macos-sync`。
- 旧版源码：`/home/motor/dida/app/`，本地 `main` 仍停留 `3f6aefe`，不是当前发布版本。不要直接切换、重置或覆盖其改动。
- 旧 checkout 有依赖锁文件、UUID 兼容修改及未跟踪导出页面；本次保留原状，维护差异另存 `ops/legacy-export/legacy-checkout-maintenance.patch`，导出源文件也已纳入版本管理。
- 本地 `origin` 应指向维护仓库，`upstream` 保留原始仓库；配置只影响本机，不随提交传播。
- workspace 根目录本身不是 Git 仓库；根目录运维文档和脚本已在本仓库 `docs/deployment/`、`ops/` 保存受版本管理副本。
- 线上产物在 workspace 的 `runtime/`，数据在 `data/`，备份在 `backups/`，配置在 `private/`。源码提交不会替换线上程序。备份每日执行，最多 14 份完整配对，仍为同机副本。

## 今日开发准备

本次仅整理准确基线，不把候选功能当作已批准的今日实施范围。下一项从 [TODO.md](../TODO.md) 选择；建议先接通搜索，再处理重复任务调度和原生提醒，具体顺序由使用者安排。每项记录目标、验收和结果。

仍需专项记录：M1 详细场景、整机重启自启、后台系统通知；当前确认不扩大到这些尚未逐项验证的能力。
