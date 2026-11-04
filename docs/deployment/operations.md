# Dida 运行与维护

正式入口：https://dida.aiking.net:888/ 。旧版入口：http://192.168.1.3:1420/ 。
旧版数据导出：http://192.168.1.3:1420/dida-export.html ，需在存有旧数据的原浏览器打开。

## 常用操作

```bash
/home/motor/dida/ops/dida.sh status
/home/motor/dida/ops/dida.sh start
/home/motor/dida/ops/dida.sh stop
/home/motor/dida/ops/dida.sh restart
/home/motor/dida/ops/dida.sh check
/home/motor/dida/ops/dida.sh logs
/home/motor/dida/ops/dida.sh backup
```

start 启动正式服务、旧版网页和备份定时器；stop 同时停止两项服务、定时器及正在运行的备份。
restart 重启两项网页服务；不切换发布版本。check 检查服务存活、本机 API 健康和旧版导出页面，不替代完整浏览器验收。

## 用户级服务

- dida-sync.service：正式网页与同步 API，监听 127.0.0.1:1430。
- dida-legacy-web.service：旧版局域网网页，监听 192.168.1.3:1420；替代旧名称 dida-clone-web.service。
- dida-sync-backup.service：一次性备份任务，成功结束后 inactive 是正常状态。
- dida-sync-backup.timer：每日 03:30 后随机延迟最多 5 分钟执行备份。

服务由 systemd --user 托管，异常退出后 3 秒重试。已启用开机自启和 motor 用户 linger。
实际配置在 ops/systemd/，用户标准目录只保留链接。修改后执行：

```bash
systemctl --user daemon-reload
systemctl --user restart dida-sync.service dida-legacy-web.service
systemctl --user restart dida-sync-backup.timer
```

不要并行手工启动另一个正式服务器，以免端口冲突或访问同一数据库。
正式服务使用 runtime/ 的程序和网页，修改源码不会自动上线。
更新时先备份，构建与验证新版本，再替换正式产物并重启验收；旧网页版本保留在 runtime/releases/。

## 配置与故障排查

- private/environment 包含数据目录、网页目录、监听地址、账号和初始密码文件路径。
- private/initial-credentials.txt 为最初交付的账号信息；如已改密，该初始密码不再代表当前密码。
- runtime/web 为当前正式网页发布链接，必须指向存在的 releases/ 子目录。
- journalctl --user -u dida-sync.service -n 100 --no-pager 查看正式日志。
- systemctl --user list-timers dida-sync-backup.timer 查看下次备份时间。
- 本机健康但公网异常时，继续检查已有 OpenResty/1Panel 反代、DNS、证书及端口映射。
- 旧版网页绑定固定局域网地址 192.168.1.3；该地址变更时需同步修改其 unit 配置。

备份和恢复详见 backup-policy.md；回退迁移详见 migration-rollback.md。
整机重启、Mac 真机和真实浏览器离线操作不属于本次终端迁移验收已完成的项目。
