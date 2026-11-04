# Dida

基于 Tauri 2、React 19、TypeScript 和 Rust 的个人任务管理应用。当前版本 **0.2.0**，交付网页、Apple Silicon Mac 桌面端和单用户自建同步服务。

## 当前状态

- 任务增删改查、子任务、智能清单、自定义清单、标签、拖拽排序和回收站已实现。
- Mac 使用本机 SQLite，可先离线使用，登录后与网页同步；网页使用 IndexedDB，首次访问需要登录，已打开页面可断网编辑、重连补传。
- 支持 JSON 导入导出、旧数据显式迁移、设备会话管理及修改密码。
- GitHub Actions 已生成 ARM64 APP ZIP 和 DMG；用户已于 **2026-11-04 确认 M1 版本测试通过**。具体测试场景未逐项记录，不将其扩展为所有场景的验收结论。
- 重复规则可以设置和同步，但自动生成下一次任务尚未完整实现；提醒仅在应用打开时提示。
- 搜索、高级过滤、日历视图、深色模式及大列表虚拟滚动尚未完成。安卓暂缓开发。

完整状态与下一步任务以 [TODO.md](TODO.md) 为准；本次基线见 [工作记录](docs/WORK-STATUS.md)。

## 使用与下载

- 网页：<https://dida.aiking.net:888/>
- 当前部署用户名：`motordida`；密码由使用者维护，不进入 Git。
- [已验证的 M1 构建](https://github.com/motor820/dida/actions/runs/41673984772)，在 Artifacts 下载 `dida-clone-macOS-Apple-Silicon`，包含 DMG 与 APP ZIP。该次产物保留至 2026-11-17 16:52 UTC；过期后需重新构建。
- 打开 DMG，将应用拖入“应用程序”。当前使用 ad-hoc 签名，尚无 Apple 公证；若被拦截，在系统设置的“隐私与安全”中选择“仍要打开”。

服务器持有同步任务明文，当前没有端到端加密。退出登录会清理本机缓存，先同步或导出未上传的数据。详见 [使用与迁移说明](docs/WEB-MACOS.md)。

## 开发与验证

Node.js 24（与 CI 一致）、npm、Rust stable；Mac 桌面构建还需 Xcode Command Line Tools。从源码仓库根目录运行：

```bash
npm ci
npm run test:sync
npm run build
cargo test --locked --manifest-path crates/local-store/Cargo.toml
cargo test --locked --manifest-path server/Cargo.toml
npm run dev
```

`npm run dev` 启动 Vite 1420 端口，不自动启动 API。浏览器 API 使用同源路径；独立调试需要另配开发反向代理。部署机的旧网页已占用 1420，不能直接再启动同端口实例。在 Mac 上用 `npm run tauri dev` 调试桌面端。

M1 打包命令：`npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg`。当前下载工作流为 `.github/workflows/macos-trial.yml`，显式指定 ARM64；旧 `release.yml` 仅保留历史标签发布方式，尚未作为本阶段正式发布流程验收。

## 代码与文档

- `src/`：React UI、服务层及 `sync/` 离线同步核心。
- `src-tauri/`：桌面 IPC、Keychain、原生 HTTP 和旧数据库兼容层。
- `crates/local-store/`：SQLite 原子保存与回归测试。
- `server/`：Axum 认证、同步 API 和 SQLite 数据库。
- `tests/`：Node 同步核心测试；`ops/`：运维脚本与旧数据导出工具。
- [快速开始](QUICKSTART.md) · [架构](ARCHITECTURE.md) · [贡献指南](AGENTS.md) · [安全审计](docs/SECURITY-REVIEW.md) · [部署资料](docs/deployment/index.md)

源码仓库为 <https://github.com/motor820/dida>，原始代码来自 `jameingh/dida-clone`。许可文件见 [LICENSE](LICENSE)。
