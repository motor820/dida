# Mac 构建与交付记录

当前源码版本为 0.2.1，更新为用户提供的蓝色圆环、黄色勾选图标，网页 favicon 与 Mac 图标统一。0.2.1 安装包已构建并验证成功。不同构建用 **COMMIT.txt 的源码提交号**区分。只把成功结束并有未过期产物的 run 当作可交付版本。

## 下载

[macOS Apple Silicon trial 工作流](https://github.com/motor820/dida/actions/workflows/macos-trial.yml)，选择最新成功运行，在 Artifacts 下载 `Dida-macOS-Apple-Silicon`。需登录有访问权限的 GitHub 账号；产物保留 14 天，过期后重新构建。

| 已验证构建 | 源码 | 内容 |
|---|---|---|
| [41943786755 最新包](https://github.com/motor820/dida/actions/runs/41943786755/artifacts/13377578096) | 3f90534 | 0.2.1：用户提供的新应用图标、网站 favicon 与 Apple touch icon；ARM64 打包、签名和启动检查全部通过 |
| [41938054981](https://github.com/motor820/dida/actions/runs/41938054981/artifacts/13375317372) | de4b96f | 包含左下角刷新/设置、删除顶部行、14px 详情、重复任务及最新共享前端；构建全部成功 |
| [41932102591](https://github.com/motor820/dida/actions/runs/41932102591) | f77f558 | Dida.app / Dida 可执行文件、14px 子任务和描述；不包含之后的左下角入口及 MCP 提交 |
| [41926391218](https://github.com/motor820/dida/actions/runs/41926391218) | 66470f1 | 共享浏览器改版、日期排序、季度重复；应用仍是旧命名 |
| [41673984772](https://github.com/motor820/dida/actions/runs/41673984772) | 96dccb1 | 初始网页/Mac 离线同步；用户于 2026-11-04 确认该阶段 M1 测试通过 |

最新包 artifact ID 为 13377578096，大小 11,335,087 bytes，保留至 **北京时间 2026-11-19 08:52**。SHA256（完整 artifact ZIP）：`788b72dfdca34b6b3a3978d825c890675425887125626b466eec4de72830cf9f`。

该包构建源码为 3f90534，包含 0.2.1 新图标和此前已交付的功能。Mac 的 icon.icns 逐字节保留用户提供文件，SHA256 为 `5cdc1fcaebba1c1fa901a1e0bc21edc1758324c4365e2c2c4c075f20f714310c`。网页于 2026-11-05 上线，公网图标哈希、Chrome 页面和三个图标链接验证通过。本次复核原生入口、SQLite 持久化、Keychain/HTTP、CSP 和 bundle 配置，未发现本次修改带来的问题；没有重新声称完成全量安全审计。37 项 Node、3 项 SQLite、7 项服务端测试通过，CI 依赖审计、签名、Intel 同源码启动及 SQLite 完整性检查通过。

下载后已核对 artifact ZIP、DMG 和应用 ZIP 的 SHA256、包内版本/标识、源码提交以及 ICNS 原文件一致性。

本次发布提交位于 feature/web-macos-sync；main 仍为此前文档基线。精确安装包来源看 COMMIT.txt/BUILD-INFO.json。

## 构建来源与验证

工作流 .github/workflows/macos-trial.yml 使用 macos-15-intel 和 aarch64-apple-darwin；再编译同源码 Intel 版检查启动与 SQLite，验证 CFBundleName=Dida、签名和 ARM64 二进制，仅上传 M1 包。

下载包包含 DMG、Dida-apple-silicon.app.zip、COMMIT.txt、BUILD-INFO.json、SHA256SUMS.txt 和 INSTALL.txt。当前为 ad-hoc 签名，无 Apple 公证。工具会重新构建前端并嵌入应用，Mac 使用本地 SQLite/Keychain，不是打开线上网站的快捷方式。

main 在应用相关路径发生推送时自动构建；开发分支仅带 [build-macos] 标记或手动触发时执行，避免相同代码重复打包。历史 release.yml 是标签草稿发布流程，未作为当前个人试用交付入口验收，不通过随意推送 v* 标签触发它。

## 安装后验收

安装 Dida.app 后检查左下角设置/刷新、字体、原位编辑、离线重开数据保留、网页同步及重复任务下一期。CI 成功代表构建和所列检查通过，不等于所有 M1 真机交互均已验收。
