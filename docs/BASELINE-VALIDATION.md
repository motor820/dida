# 2026-11-04 基线验证

> 历史验收：本文记录对应阶段的行为和测试结果，“尚未打包/未实现”等表述仅描述当时状态。当前功能以 [WEB-MACOS.md](WEB-MACOS.md) 和 [TODO.md](../TODO.md) 为准，后续安装包见 [RELEASES.md](RELEASES.md)。

本次基线以前一应用提交 `96dccb1` 为起点，整理开发文档、AI 接手规则、运维源码和旧 checkout 维护补丁；未变更新版应用运行逻辑。

## 本次重新执行

| 检查 | 结果 |
|---|---|
| `npm run test:sync` | 8 项通过 |
| `npm run build` | TypeScript 与 Vite 构建通过 |
| `cargo test --locked --offline --manifest-path crates/local-store/Cargo.toml` | 3 项通过 |
| `cargo test --locked --offline --manifest-path server/Cargo.toml` | 5 项通过 |
| `bash -n ops/dida.sh ops/backup.sh` | 通过 |
| 核心说明与部署索引的相对链接 | 无失效链接 |
| 运维脚本与部署目录源文件比对 | 一致 |
| `ops/deploy-panel.py` Python AST 语法 | 通过 |
| 暂存文件范围及凭据模式检查 | 未包含私密配置、数据库、运行产物、私钥或 GitHub 令牌 |
| 旧浏览器导出页与版本管理源文件比对 | 一致 |

补充检查已完成：`git diff --check` 通过；旧维护补丁在旧 checkout 通过反向 `git apply --check`，确认完整记录当前差异；`ops/dida.sh check` 显示同步服务、旧网页及备份定时器 active，健康接口返回 0.2.0，旧导出页面可访问。

## 已有证据与边界

- 用户在本次会话中明确确认 M1 版本测试通过。没有新建或下载 Mac 安装包，也没有虚构详细测试步骤。
- Actions `41673984772` 已在此前查询确认完成成功；ARM64 APP/DMG 由提交 `96dccb1` 构建。
- 之前的双浏览器、同步恢复及漏洞审计证据见 `WORK-STATUS.md`、`SECURITY-REVIEW.md` 和部署资料。此基线未重新进行完整浏览器回归或依赖漏洞扫描。
- 未测试整机重启、进程退出后的系统提醒、重复任务自动实例调度；后两项仍未完整实现。
- 当前改动不发布到生产，不更改用户密码或业务数据库。

## 基线标识

本地标签 `baseline-2026-11-04` 指向本次整理提交，分支为 `feature/web-macos-sync`。本次只创建本地提交与标签，未推送远程，也未改写旧 `app/` checkout。
