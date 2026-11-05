# Dida

个人待办应用，当前应用版本 **0.2.0**。网页与 Apple Silicon Mac 共用 React 19 / TypeScript 界面和业务逻辑，Tauri 2 提供桌面能力，Rust/Axum + SQLite 提供单用户同步；Rona 通过 MCP 管理同一份待办。

## 已实现

- 任务、子任务、清单、标签、日期、优先级、回收站及 JSON 导入导出。
- 原位多行编辑、Enter 续建、描述/检查事项切换、日期排序及响应式详情抽屉。
- 按天/周/月/季度/年和自定义公历重复；完成后原子生成下一期及检查项，处理离线重试与并发去重。
- Mac SQLite 离线保存，网页 IndexedDB 断网编辑与重连同步；登录、改密、设备撤销和旧数据显式迁移。
- 左下角刷新按钮立即同步，下面的设置按钮打开账号、设备和导入导出；顶部状态行已删除。第三栏子任务与描述使用 14px，第二栏标题 16px 粗体。
- 12 个 stdio MCP 工具及 Rona 的轻量 dida-tasks skill。

搜索/高级过滤、日历视图、深色模式、大列表虚拟滚动、退出后的系统通知尚未完成；安卓暂缓。准确待办见 [TODO.md](TODO.md)。

## 使用

网页：<https://dida.aiking.net:888/>。当前部署用户名 `motordida`，密码由使用者维护，不进入 Git。

Mac 应用为 **Dida.app**，可先离线使用，再登录同步。下载入口与对应提交见 [构建交付记录](docs/RELEASES.md)，在 GitHub Actions 的 Artifacts 下载 `Dida-macOS-Apple-Silicon`。安装包包括 DMG、APP ZIP、COMMIT.txt 和校验和，保留 14 天。当前 ad-hoc 签名，尚无 Apple 公证；被系统拦截时到“隐私与安全”选择“仍要打开”。

macOS 钥匙串授权框需要 Mac 登录/钥匙串密码；Dida 登录框需要 Dida 账号密码。操作与迁移说明见 [WEB-MACOS.md](docs/WEB-MACOS.md)。服务器持有同步任务明文，当前没有端到端加密；退出登录前先同步或导出待上传数据。

## 开发与验证

Node.js 24、npm、Rust stable；Mac 需 Xcode Command Line Tools。在本源码根目录执行：

```bash
npm ci
npm ci --prefix mcp
npm run test:sync
npm run test:tasks
npm run test:recurrence
npm run build
cargo test --locked --manifest-path crates/local-store/Cargo.toml
cargo test --locked --manifest-path server/Cargo.toml
cargo build --locked --manifest-path server/Cargo.toml
npm run test:mcp
```

MCP 集成测试需要上一步的独立 API debug 可执行文件；测试自己创建临时数据库和随机凭据。浏览器测试还需 Python Playwright 和 Chrome，见 [验收说明](docs/WEB-TASK-ACCEPTANCE.md)。

`npm run dev` 启动 Vite 1420，不自动代理 API；开发机浏览器需另配同源 API 代理。部署机该端口已供旧网页使用，使用独立端口或机器。在 Mac 用 `npm run tauri dev` 调试；M1 构建命令是 `npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg`。

## 结构与文档

`src/` 为共享前端与同步逻辑；`src-tauri/` 为桌面适配；`crates/local-store/` 为原子存储；`server/` 为 API；`mcp/` 为 MCP server；`integrations/` 为 Rona skill；`tests/` 为回归；`ops/` 为运维源码。

[文档索引](docs/index.md) · [快速开始](QUICKSTART.md) · [架构](ARCHITECTURE.md) · [接手状态](docs/WORK-STATUS.md) · [MCP](docs/MCP.md) · [贡献指南](AGENTS.md)

维护仓库：<https://github.com/motor820/dida>，原代码来自 `jameingh/dida-clone`，许可见 [LICENSE](LICENSE)。仓库当前仍公开；用户已决定私有化稍后自行处理。本机部署数据、凭据、备份和运行产物不进入 Git。
