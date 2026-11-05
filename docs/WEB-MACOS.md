# Dida 网页与 Apple Silicon Mac 使用说明

更新：2026-11-05；应用版本 0.2.0。网页与 Mac 共用当前界面和业务；安卓尚未交付。

## 账号与同步

- 网页：<https://dida.aiking.net:888/>。当前用户名 `motordida`，使用自己修改后的 Dida 密码，仓库不记录有效密码。
- **左下角刷新图标**立即同步；其下的**设置齿轮**打开账号、改密、设备、导入导出和退出功能。顶部状态行已移除，刷新按钮提示及设置面板显示同步状态。
- Mac 初次可以选择先离线使用，任务和待上传操作保存于 SQLite。网页初次需登录，已打开页面可断网编辑并在重连后上传，不承诺首次离线打开网页。
- 修改密码撤销全部旧会话（包括 Rona MCP）；退出登录清理当前设备缓存，所以先同步或导出未上传变更。
- 同一字段按校准修改时间合并；重复实例初始化不覆盖真实编辑，永久删除不被旧编辑复活。

## Mac 安装与钥匙串

最新包见 [RELEASES.md](RELEASES.md)，GitHub Actions 产物名 `Dida-macOS-Apple-Silicon`，包含 DMG、APP ZIP、COMMIT.txt 和 SHA256SUMS.txt，保留 14 天。解压后打开 DMG，将 **Dida.app** 放入应用程序。此前的 dida-clone.app 为旧命名包，应按提交号区分。

当前 ad-hoc 签名、未 Apple 公证；来源确认后可在“系统设置 → 隐私与安全”中选择“仍要打开”，不需要全局关闭 Gatekeeper。

系统提示访问 `net.aiking.dida.sync` 时，是授权读取 Keychain 中的同步令牌，需要 **Mac 登录/钥匙串密码**；在 Dida 登录表单才填写 Dida 密码。对本次安装的 Dida 可选择“始终允许”。改包或签名变化可能重新提示。

应用标识仍为 `com.akm.dida-clone`，数据库仍为 `~/Library/Application Support/com.akm.dida-clone/dida.db`，当前状态和 outbox 在 sync_local_state；旧关系表保留供显式导入。不要用删除数据库排查问题。原生 API 固定 HTTPS 主机，令牌保存在 Keychain；服务器持有任务明文，没有端到端加密。

## 当前界面与任务行为

第二栏标题 16px 粗体，未完成无日期任务在前，其后按截止时间排序。第三栏子任务标题和描述为 14px，展示、编辑和检查事项文本模式一致。标题支持多行及 Enter 续建；第三栏主标题 Enter 转入描述编辑。窄屏保留 60px 导航图标栏并以抽屉展示详情。

重复规则支持日、周、月、季度、年、周一至周五和自定义公历规则。**完成当前任务才生成下一期及检查项**，不是独立后台定时调度；保留月末/闰年与当地时刻，逾期计划跳过历史，离线/多设备使用确定 ID 去重。旧自定义规则缺少频率时需重新选择。提醒仍是打开应用时的本地提示，不承诺退出后的系统通知。

搜索、日历、深色模式和虚拟滚动仍见 [TODO](../TODO.md)，不能仅凭导航按钮认定已完成。

## 数据迁移

旧数据不会自动混入服务端。在设置中选择“导入这台设备的旧版数据”，或导入 JSON 备份；原始旧数据保留。旧局域网网页与新域名不同源，须在原浏览器先打开旧导出页 <http://192.168.1.3:1420/dida-export.html> 导出，再到新应用导入。

## 开发与运维

命令与环境见 [QUICKSTART](../QUICKSTART.md)，当前实现见 [ARCHITECTURE](../ARCHITECTURE.md)。构建会将相同前端源码嵌入 Mac；原生编译、签名和 Intel 主机启动检查通过后，仍需区分用户在 M1 的实际功能验收。

正式 API 为用户级 dida-sync.service，路径在 workspace runtime/data/private/backups 下。每日保留最近 14 份完整配对备份。恢复会覆盖服务器数据、更换 epoch 并撤销会话，须按 [备份恢复流程](deployment/backup-policy.md) 操作。恢复后 Rona MCP 需重新配置专用会话，见 [MCP](MCP.md)。
