# Mac 构建与交付记录

应用版本目前仍为 0.2.0；不同构建用 **COMMIT.txt 的源码提交号**区分。只把成功结束并有未过期产物的 run 当作可交付版本。

## 下载

[macOS Apple Silicon trial 工作流](https://github.com/motor820/dida/actions/workflows/macos-trial.yml)，选择最新成功运行，在 Artifacts 下载 `Dida-macOS-Apple-Silicon`。需登录有访问权限的 GitHub 账号；产物保留 14 天，过期后重新构建。

| 已验证构建 | 源码 | 内容 |
|---|---|---|
| [41932102591](https://github.com/motor820/dida/actions/runs/41932102591) | f77f558 | Dida.app / Dida 可执行文件、14px 子任务和描述；不包含之后的左下角入口及 MCP 提交 |
| [41926391218](https://github.com/motor820/dida/actions/runs/41926391218) | 66470f1 | 共享浏览器改版、日期排序、季度重复；应用仍是旧命名 |
| [41673984772](https://github.com/motor820/dida/actions/runs/41673984772) | 96dccb1 | 初始网页/Mac 离线同步；用户于 2026-11-04 确认该阶段 M1 测试通过 |

当前本次任务正在准备更晚的构建，将包含左下角刷新/设置及最新文档；成功后补录在本表，不用旧包代替。

## 构建来源与验证

工作流 .github/workflows/macos-trial.yml 使用 macos-15-intel 和 aarch64-apple-darwin；再编译同源码 Intel 版检查启动与 SQLite，验证 CFBundleName=Dida、签名和 ARM64 二进制，仅上传 M1 包。

下载包包含 DMG、Dida-apple-silicon.app.zip、COMMIT.txt、SHA256SUMS.txt 和 INSTALL.txt。当前为 ad-hoc 签名，无 Apple 公证。工具会重新构建前端并嵌入应用，Mac 使用本地 SQLite/Keychain，不是打开线上网站的快捷方式。

main 在应用相关路径发生推送时自动构建；开发分支仅带 [build-macos] 标记或手动触发时执行，避免相同代码重复打包。历史 release.yml 是标签草稿发布流程，未作为当前个人试用交付入口验收，不通过随意推送 v* 标签触发它。

## 安装后验收

安装 Dida.app 后检查左下角设置/刷新、字体、原位编辑、离线重开数据保留、网页同步及重复任务下一期。CI 成功代表构建和所列检查通过，不等于所有 M1 真机交互均已验收。
