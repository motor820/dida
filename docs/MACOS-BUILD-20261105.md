# 2026-11-05 M1 安装包构建

> 历史验收：本文记录对应阶段的行为和测试结果，“尚未打包/未实现”等表述仅描述当时状态。当前功能以 [WEB-MACOS.md](WEB-MACOS.md) 和 [TODO.md](../TODO.md) 为准，后续安装包见 [RELEASES.md](RELEASES.md)。

## 源码范围

包含上一基线之后的任务原位编辑、Enter 续建、多行标题、描述/检查事项切换、响应式布局、日期面板、截止日期排序、季度重复及下一期生成、用户头像和 DIDA 网页标识。同步协议包含向后兼容的初始化字段语义，配套服务端代码一并提交。

应用仍为 0.2.0；使用下载包内的 COMMIT.txt 精确区分构建。未修改 bundle identifier、用户数据库路径或现有密码。

## Mac 适配检查

- 业务操作仍走共享 services/sync store，原生状态与 outbox 继续原子保存在 SQLite。
- 原生 API 固定 HTTPS 主机，通过 Keychain 管理令牌；没有新增跨域请求或权限。
- 头像与 favicon 都由本地资源打包，CSP 允许对应资源；窗口默认 1420×827，使用共享响应式布局。
- 日期计算使用 Intl IANA 时区；重复实例 ID 使用标准 Web Crypto，相关逻辑已通过单元测试。WebView 实际运行仍由新版安装后的用户验证。

## 本地验证

- npm run test:sync：8 项通过。
- npm run test:tasks：3 项子任务排序、5 项主任务排序通过。
- npm run test:recurrence：21 项通过。
- cargo test --locked --offline --manifest-path crates/local-store/Cargo.toml：3 项通过。
- cargo test --locked --offline --manifest-path server/Cargo.toml：7 项通过。
- npm run build：TypeScript 与 Vite 生产构建通过。

本次没有重新运行完整浏览器回归，之前记录见 WEB-TASK-ACCEPTANCE.md 与 DATE-REPEAT-ACCEPTANCE.md。

## GitHub 构建

工作流 macos-trial.yml，目标 aarch64-apple-darwin，生成 APP ZIP、DMG、校验和与 COMMIT.txt。开发分支提交带 [build-macos] 才执行打包；普通开发分支推送仍跳过构建，main 推送和手动触发行为保留。CI 新增任务排序和重复规则测试。

构建使用 ad-hoc 签名，尚无 Apple 公证，安装包保留 14 天。构建结果及下载地址在任务完成后写入本机 docs/work-status.md；源码提交本身不表示构建成功。安装包仅留 GitHub，不下载到部署机。
