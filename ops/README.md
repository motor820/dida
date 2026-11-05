# 本机运维资料

`dida.sh`、`backup.sh` 和 `systemd/` 是 `/home/motor/dida/ops/` 当前部署配置的受版本管理副本。它们按本机布局运行，不应直接从源码工作树调用 `backup.sh`：其相对路径依赖 workspace 根目录。部署更新需按 `docs/deployment/operations.md` 同步到实际运维目录，再按需 reload；提交不会自动部署。

`deploy-panel.py` 只访问本机 1Panel Unix socket，需要相应权限；没有嵌入凭据。`legacy-export/` 提供旧浏览器数据导出页面及旧 checkout 的维护补丁。

`legacy-checkout-maintenance.patch` 记录旧 `app/` 未提交的依赖锁文件更新和 HTTP 环境下 UUID 兼容修复；旧源码目录保留原状。应用补丁前核对目标旧代码提交 `3f6aefe`，使用 `git apply --check`，不要重复应用。导出页面与 `ops/legacy-export/` 中源文件相同，实际位于旧版 `public/`。

不要把 private、数据库、备份、运行二进制或打包安装文件加入 Git。

`provision-mcp-session.py` 是显式本机 MCP 会话配置入口；`install-openclaw-mcp.py` 安装备份后的 OpenClaw 配置和 Rona skill。源码根路径由脚本位置确定，实际 OpenClaw/部署目录仍按本机布局。正常 MCP 工具通过 API，不直接写业务表。维护说明见 docs/MCP.md。
