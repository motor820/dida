# Dida 0.2 网页与 Mac 试用

本阶段交付网页版、Apple Silicon Mac 桌面端及自建同步 API；暂未开发安卓客户端。

- 网页：https://dida.aiking.net:888/
- 账号：motordida。网页与 Mac 使用同一密码；初始密码不进入仓库，由部署者单独提供。
- Mac 首次启动可点击“先离线使用，稍后登录同步”。已经保存的任务、修改及待上传队列都在本机 SQLite 中；网络不可用时仍能编辑。
- 网页首次进入需要登录，数据使用 IndexedDB；页面已打开时可继续断网编辑，再联网补传。不把浏览器缓存清理当作退出方式，先同步或导出备份。
- 顶部“账号与同步”可登录、修改共用密码、查看和撤销其他设备、导入导出数据。改密撤销所有旧登录；退出登录会清理这台设备缓存，若有待上传修改应先导出。
- 同一字段按校准后的修改时间自动取新；未修改的字段不会因旧界面快照回写。永久删除保留终止标记。
- 旧版本数据不会自动混入服务器。选择“导入这台设备的旧版数据”，或导入 JSON 备份；原始数据保留。旧局域网网页与新域名属于不同浏览器存储来源，需要先在旧来源导出再导入。

## Mac 安装

GitHub Actions 的 macOS Apple Silicon trial 工作流生成 DMG 和 APP ZIP，保留 14 天。构建使用 ad-hoc 签名，没有苹果公证。首次打开被系统拦截时，确认来源后到“系统设置 → 隐私与安全性 → 仍要打开”。不需要全局关闭 Gatekeeper。
Mac 数据库路径：~/Library/Application Support/com.akm.dida-clone/dida.db。新数据和待同步队列在 sync_local_state 中原子保存；原有关系表保留供显式旧数据导入。
登录令牌在 macOS Keychain 中，API 主机固定为上面的 HTTPS 域名。当前无端到端加密；服务端持有任务明文数据。

## 开发与验证

```bash
npm ci
npm run test:sync
npm run build
cargo test --manifest-path crates/local-store/Cargo.toml
cargo test --manifest-path server/Cargo.toml
```

在 Mac 上执行 npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg；个人试用可设置 APPLE_SIGNING_IDENTITY=-。
安全审计结果与范围见 SECURITY-REVIEW.md。

## 本机服务运维

本次部署不新增 Docker 容器，使用用户级 systemd 服务；已有 OpenResty 负责 HTTPS 反代。

- 服务：systemctl --user status dida-sync.service
- 日志：journalctl --user -u dida-sync.service --since today
- 启动/停止：systemctl --user start/stop dida-sync.service
- 运行目录：~/dida/runtime/
- 配置：~/dida/private/environment
- 数据：~/dida/data/dida.sqlite3
- 备份：~/dida/backups/；每天 03:30 后执行，保留最近 14 份。
- 手动备份：systemctl --user start dida-sync-backup.service
- 已启用用户 linger，无需登录桌面也会开机运行。
- 后端只监听 127.0.0.1:1430；公网 888 经路由器映射至本机 443。DNS 使用仅 DNS，证书由 1Panel 管理并自动续签。

恢复之前，先手动备份当前状态，然后停止 dida-sync.service。加载 environment 中的环境变量后，执行 dida-sync-server restore /绝对路径/备份.sqlite3，再启动服务。恢复会更换同步代次并撤销旧会话；各设备重新登录后取服务器快照，未上传修改仍按同步规则处理。此操作会用备份覆盖当前服务器数据。

服务端以 SQLite backup API 生成一致快照，不直接复制仍在写入的数据库文件。备份配置包含私密初始凭据，目录和文件受权限保护；生产数据、令牌和密码不得提交 Git。

当前重复任务沿用原项目能力：保存与同步规则，自动生成下一次任务的完整调度尚未作为本阶段交付承诺。提醒仍为打开应用时的本地提示，不承诺退出应用后的系统通知；安卓原生提醒在后续阶段开发。

CI 在可用的标准 Intel Mac 运行器上交叉编译 aarch64 安装包，并另外编译同源码的 Intel 版本进行启动检查；只上传 Apple Silicon 产物。用户已于 2026-11-04 确认 M1 版本测试通过；具体场景未逐项提供，不据此声称所有平台和后台行为均已验收。

## 开发进度与交接

当前待办以 [TODO.md](../TODO.md) 为准，交接以 [WORK-STATUS.md](WORK-STATUS.md) 为准。受版本管理的部署资料见 [deployment/index.md](deployment/index.md)。

## 当前 Mac 应用名称

新版应用名称及可执行文件名为 Dida，安装包内为 Dida.app，当前 Actions 产物名为 Dida-macOS-Apple-Silicon。旧包中的 dida-clone.app 属于此前构建。应用标识 com.akm.dida-clone、SQLite 目录和 Keychain 条目保持兼容。第三栏子任务标题及描述统一使用 14px，编辑与展示一致。
