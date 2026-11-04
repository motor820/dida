# Dida 项目文档

- [Workspace 贡献指南](WORKSPACE-GUIDELINES.md)
- [目录说明](directory-layout.md)
- [启动、停止与故障排查](operations.md)
- [备份策略与恢复方法](backup-policy.md)
- [迁移回退说明](migration-rollback.md)
- [本次验收记录](verification-results.json)
- [项目工作状态](../WORK-STATUS.md)
- [同步设计方案](../SYNC-PLAN.md)
- [当前网页与 Mac 使用说明](../WEB-MACOS.md)
- [安全审计报告](../SECURITY-REVIEW.md)

2026-11-04 已完成目录与运行环境迁移。正式入口 https://dida.aiking.net:888/ 。
本次验证包含服务重启、自启配置、本机和公网接口、隔离跨设备同步与真实备份恢复。
以上为迁移当时的验收范围，未执行整机重启。后续用户已确认 M1 版本测试通过；当前基线将运维脚本和部署资料纳入 Git，详见 [工作状态](../WORK-STATUS.md)。
