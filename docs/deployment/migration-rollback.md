# 2026-11-04 目录迁移回退记录

迁移前固定快照的位置记录在 private/migration-snapshot-path。该快照目录包含：
- 旧版四个 systemd unit 和原备份脚本。
- 原私密配置、迁移前 SQLite 一致性备份和配置包。
- 两个工作树的 Git 状态、HEAD、完整差异和文件哈希清单。

迁移保留原有 main 上的 package-lock.json、Sidebar.tsx 修改以及两个未跟踪导出页面。
开发工作树迁移前干净，迁移时仅额外更新部署路径文档；迁移当时没有提交或推送代码。后续基线已将运维资料与旧 checkout 维护补丁纳入 Git，旧目录中的原有修改仍保留。

若需要回到旧布局，由维护者按以下顺序执行，不能在服务运行时直接移动数据库：

1. 用新脚本再做一份当前备份；停止新布局的两项网页服务、备份定时器和备份任务。
2. 核对原目标路径尚不存在，保留本次操作后的当前数据，不默认用迁移前数据库覆盖。
3. 用 git worktree move 将 worktrees/web-macos-sync 移回 /home/motor/dida-macos-build；将 app 移回 /home/motor/dida-clone 后执行 git worktree repair，核对两个工作树。
4. runtime 移回 ~/.local/lib/dida-sync；data 移回 ~/.local/share/dida-sync；backups 移回其 backups 子目录。
5. 将 private/environment、initial-password 移回 ~/.config/dida-sync，initial-credentials.txt 移回原主目录；环境文件中的运行、数据、网页和密码文件路径改回旧路径。
6. 修复 runtime/web 的绝对链接，恢复快照中的旧 backup.sh；将四个旧 unit 恢复到 ~/.config/systemd/user，移除新旧版服务链接并恢复旧 dida-clone-web 自启。
7. daemon-reload，重新启用启动旧两项网页服务和备份 timer，逐项检查网页、API、任务数据和备份。

文档、运维脚本和迁移快照可继续留在 dida/ 供审计，不需要为回退清空项目目录。
以上为人工回退流程，未实际执行回退；正常验收通过后继续使用新布局。
