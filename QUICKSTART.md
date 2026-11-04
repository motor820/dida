# 快速开始

## 使用 M1 应用

从 [已验证构建](https://github.com/motor820/dida/actions/runs/41673984772) 的 Artifacts 下载 Apple Silicon 安装包，打开 DMG 并拖到“应用程序”。首次可选择“先离线使用，稍后登录同步”。用户已于 2026-11-04 确认 M1 测试通过。

同步地址为 https://dida.aiking.net:888/，当前部署用户名 `motordida`，使用你自行修改后的密码。密码不记录在仓库中。签名、下载有效期与迁移限制见 [使用说明](docs/WEB-MACOS.md)。

## 源码开发

使用 Node.js 24、npm 和 Rust stable；Mac 需 Xcode Command Line Tools。在源码仓库根目录执行：

```bash
npm ci
npm run test:sync
npm run build
cargo test --locked --manifest-path crates/local-store/Cargo.toml
cargo test --locked --manifest-path server/Cargo.toml
```

Mac 桌面调试：`npm run tauri dev`。浏览器调试：`npm run dev`，Vite 端口为 1420，API 使用同源 `/api/v1/`，开发环境需自行配置 API 反向代理。部署机的旧版网页已占用 1420，开发时应使用独立机器或先安排端口方案，不能随意停止服务。

M1 本地打包：

```bash
rustup target add aarch64-apple-darwin
APPLE_SIGNING_IDENTITY=- npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg
```

产物位于 `src-tauri/target/aarch64-apple-darwin/release/bundle/`。GitHub 当前使用 `macos-trial.yml` 做同样的目标构建。

## 数据保护与排查

Mac 数据库为 `~/Library/Application Support/com.akm.dida-clone/dida.db`，当前业务状态及队列保存在 `sync_local_state`；旧关系表保留供导入。网页使用 IndexedDB，不能按旧文档仅检查 localStorage。

遇到数据问题先导出备份并保留原库，不通过删除数据库排查。退出登录前先同步或导出未上传变更。正式服务配置和恢复方法见 [部署说明](docs/deployment/operations.md)。

今日待办见 [TODO.md](TODO.md)，已知范围与验证结果见 [工作状态](docs/WORK-STATUS.md)。
