# 当前备份策略

本次保留原来的每日备份、最多 14 份策略。目录调整没有关闭或增加备份频率；迁移前后额外手动运行了备份。

## 何时执行

用户级 dida-sync-backup.timer 每天本地时间 03:30 触发，随机延迟 0～5 分钟。
Persistent=true 表示机器关机错过的定时任务，会在定时器再次启动后补执行一次，不会按漏掉的每一天分别补齐。
开机自启、用户 linger 均已启用；机器必须实际开机，服务才能执行。

手动执行：`/home/motor/dida/ops/dida.sh backup`。
手动备份同样计入 14 份额度，所以“14 份”不一定覆盖完整 14 天。

## 每份备什么

`/home/motor/dida/backups/` 中按相同时间戳配对保存：

- dida-YYYYMMDD-HHMMSS.sqlite3：服务器 SQLite 一致性快照，包含已同步任务、清单、标签、账号密码哈希、同步记录和会话等数据库内容。
- config-YYYYMMDD-HHMMSS.tar.gz：private/environment、initial-password、initial-credentials.txt。

上述配置包内容指本次调整后新生成的备份；迁移保留的历史配置包只有 environment 和 initial-password，可能还引用旧目录。恢复任何历史配置都需要核对路径。

不包括源码、依赖、Mac 安装包、服务二进制、网页发布文件、systemd 配置、证书，以及尚未上传的浏览器/Mac 本地修改。
Git 中没有本机未提交修改的备份保证；重要源码变更还应正常提交。
配置包保存的是部署初始凭据和配置；用户改密后的有效密码哈希在数据库中。

## 如何保证可用

1. flock 防止两次备份并行运行。
2. 使用正式程序的 SQLite backup API，支持服务在线运行，不直接复制活跃的 WAL 数据库文件。
3. 先在同一目录临时生成快照，执行 PRAGMA integrity_check，再打包私密配置。
4. 两份文件生成成功后发布到正式备份名称；数据库文件最后发布，作为该配对完成的标记。
5. 仅清理完整配对，按文件名时间排序保留最新 14 对；备份失败不触发旧备份轮换。极端中断留下的孤立文件不自动删除，需检查处理。
6. 临时目录正常退出时清理；强制断电等异常可能留下 .pending-*，检查后可清理。

目录权限 700；新备份文件权限 600。备份未经加密，具有本机相应权限的人可以读取任务及配置。
失败记录保留在 systemd 日志中，目前没有额外的失败消息通知。

## 如何恢复

恢复会覆盖目标服务器当前数据库，先备份当前状态。恢复前停止正式服务及备份定时器、备份任务。
在 motor 用户的 Bash 中，将最后一行示例文件替换为实际选中的备份：

```bash
/home/motor/dida/ops/dida.sh backup
systemctl --user stop dida-sync-backup.timer dida-sync-backup.service dida-sync.service
set -a
source /home/motor/dida/private/environment
set +a
/home/motor/dida/runtime/dida-sync-server restore /home/motor/dida/backups/dida-YYYYMMDD-HHMMSS.sqlite3
# 仅在 restore 成功后启动；失败时先排查，不要盲目继续。
systemctl --user start dida-sync.service dida-sync-backup.timer
/home/motor/dida/ops/dida.sh check
```

恢复程序校验数据库，恢复后更换同步 epoch 并撤销所有旧会话，各设备需要重新登录。
当前配置正常时无需恢复配置包；确需恢复配置时先解压到私密临时目录，核对路径和权限后替换，避免旧配置指向错误目录。
不把数据库/WAL/SHM 文件直接相互覆盖，也不要直接把备份文件复制到运行中的数据库位置。

本次已将真实备份恢复到隔离临时目录，核对记录数量、完整性、会话清空和 epoch 更换；没有覆盖正式数据库。

## 能防什么、不能防什么

可用于误删、错误修改、数据库或升级故障后的回退。
所有自动备份仍在同一台机器、同一块磁盘上；不能抵御整盘损坏、整机丢失或同时删除项目和备份。
每日备份最坏可能损失近一天已同步变更；机器长期关机、任务失败时窗口会更长。
当前未配置异机、云端或异地副本，也没有静默上传到外部服务。

迁移前另留一份固定回退快照在 private/migration-时间戳/，它不参与每日 14 份轮换；确认迁移稳定后可决定是否删除。
若不需要自动备份，可执行 `systemctl --user disable --now dida-sync-backup.timer`；已有备份不会随之删除。
