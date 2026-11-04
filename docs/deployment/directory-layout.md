# Dida 目录说明

项目根目录：`/home/motor/dida`。

| 目录 | 用途 |
|---|---|
| app/ | 原主仓库，分支 main；也是旧版局域网网页的源码目录 |
| worktrees/web-macos-sync/ | Git 关联工作树，分支 feature/web-macos-sync；当前新版网页、Mac 和同步服务源码 |
| docs/ | 本机部署、运维、备份、迁移验收等统一文档 |
| ops/ | 运维入口、备份脚本、面板辅助脚本 |
| ops/systemd/ | 用户级服务和备份定时器的实际配置 |
| runtime/ | 正式同步服务二进制、网页发布版本和 web 链接 |
| data/ | 正式 SQLite 数据库及其 WAL/SHM 文件 |
| backups/ | 每日及手动备份，最多保留最近 14 个完整配对 |
| private/ | 环境变量、初始凭据、迁移前回退快照；目录 700、普通文件 600 |
| archive/ | 早期构建配置留档 |

`app` 和开发工作树仍使用原有 Git 关系。不要随意直接移动或删除其中任何一个；关联工作树使用 git worktree 管理。
原仓库已有的 README、AGENTS 等仓库说明和 docs/ 技术文档保留在对应仓库中；当前新版使用说明见 `../WEB-MACOS.md`。
应用 bundle identifier 保持原值 com.akm.dida-clone，以保证已有 Mac 数据目录兼容；目录整理没有更改应用数据格式。

项目外必要入口：
- `~/.config/systemd/user/dida-*.service` 和 `dida-sync-backup.timer`：链接至本项目 ops/systemd/。
- default.target.wants/、timers.target.wants/：systemd 的开机启用链接。
- `/var/lib/systemd/linger/motor`：已有的用户服务后台运行标记。
- HTTPS 反代、证书和续签由已有 1Panel/OpenResty 管理，仍反代 127.0.0.1:1430。
- Node、Rust 等共享工具及缓存仍在用户标准工具目录。

数据、凭据、备份和运行产物由项目根 .gitignore 排除，不得提交 Git。
