# 快速开始

## 使用 Mac / 网页

网页：<https://dida.aiking.net:888/>。账号 `motordida`，使用自己修改后的 Dida 密码。

M1 安装包见 [交付记录](docs/RELEASES.md)：登录有仓库访问权限的 GitHub 账号，从 Actions 的 Artifacts 下载 `Dida-macOS-Apple-Silicon`。解压后打开 DMG，将 **Dida.app** 放入应用程序。初次可选择“先离线使用，稍后登录同步”。

左下角刷新按钮立即同步，下方齿轮设置打开账号、设备和导入导出。macOS 弹出 `net.aiking.dida.sync` 钥匙串授权时，输入 Mac 登录/钥匙串密码；这与应用自己的登录密码不同。完整说明见 [WEB-MACOS.md](docs/WEB-MACOS.md)。

## 源码开发

Node.js 24、npm、Rust stable；Mac 安装 Xcode Command Line Tools：

```bash
npm ci
npm run test:sync
npm run test:tasks
npm run test:recurrence
npm run build
cargo test --locked --manifest-path crates/local-store/Cargo.toml
cargo test --locked --manifest-path server/Cargo.toml
```

`npm run tauri dev` 用于 Mac 桌面调试。`npm run dev -- --host 127.0.0.1 --port 1492` 可避开部署机已占用的 1420；浏览器 API 仍需同源反代，隔离回归脚本会自行模拟 API 或接入临时真实服务，见 [验收说明](docs/WEB-TASK-ACCEPTANCE.md)。

M1 本地打包：

```bash
rustup target add aarch64-apple-darwin
APPLE_SIGNING_IDENTITY=- npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg
```

产物在 `src-tauri/target/aarch64-apple-darwin/release/bundle/`。GitHub 使用 `macos-trial.yml` 构建；精确源码提交保存在安装包 COMMIT.txt。

## MCP 开发

```bash
npm ci --prefix mcp
cargo build --locked --manifest-path server/Cargo.toml
npm run test:mcp
```

stdio 启动为 `npm run mcp`，需要配置 API 地址与独立会话文件，见 [MCP.md](docs/MCP.md)。不要让 stdout 日志污染协议。

## 数据保护

Mac 文件为 `~/Library/Application Support/com.akm.dida-clone/dida.db`；当前状态与队列在 `sync_local_state`，旧关系表用于显式导入。网页使用 IndexedDB。遇到问题先导出并保留原库，退出前同步未上传修改；恢复服务端数据前按 [备份策略](docs/deployment/backup-policy.md) 执行。
