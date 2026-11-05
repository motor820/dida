# Dida 当前接手状态

更新：2026-11-05；应用版本 0.2.0。当前代码以 Git HEAD 为准，安装包以 COMMIT.txt 为准，不在文档中写自引用提交号。历史过程见 [history](history/2026-11-04-05-development.md)。

## 当前已交付

网页 <https://dida.aiking.net:888/>，用户名 motordida；有效密码由用户维护。网页与 Dida Mac 共用前端，已包括多行原位编辑、描述/检查事项切换、响应式布局、季度重复及下一期、日期排序、共用头像、14px 详情文字和左下角同步/设置。

MCP 的 12 个工具已接入本机 OpenClaw；Rona dida-tasks skill 可见，配置热加载和 probe 通过，正式账号只读状态/查询通过。所有写入测试使用隔离数据库，未修改生产任务或密码。新待办归 Dida，旧 personalrepo action_items 保留。

## Git 与发布约定

维护远端为 motor820/dida，upstream 为原始 jameingh/dida-clone。main 与 feature/web-macos-sync 在本次交付后指向同一最新提交。旧局域网 checkout app/ 使用 legacy/lan-web 保存历史代码和原有维护改动，实际源文件不因分支整理被替换；补丁位于 ops/legacy-export/，旧版维护与文档范围已独立保存为 legacy/lan-web 的 7716f03。

当前用户决定 GitHub 继续公开，私有化稍后自行处理。仓库是公开 fork，变私有需要先按 GitHub 规则脱离 fork 网络。不可将“用户计划私有化”写成“已经私有”。

本次文档与源码已推送 main、开发分支及基线标签；M1 构建 41938054981 完成 success，安装包源码为 de4b96f，包含左下角入口。旧版归档也已推送。已成功交付的安装包与准确构建提交见 [RELEASES](RELEASES.md)；待完成构建不作为已成功交付。

## 运行环境

workspace 为 /home/motor/dida，运行产物在 runtime/，数据库 data/dida.sqlite3，配置 private/，配对备份 backups/；均不进入 Git。正式 API 由 systemd --user 管理，127.0.0.1:1430 经已有 HTTPS 反代。网页发布切换 runtime/web，源码提交不会自动部署。每日最多保留 14 份同机备份，恢复后所有客户端重新登录，MCP 显式重新配置。

OpenClaw 本机配置、MCP token 和接入前备份均在受限目录；版本管理中只包含技能、维护脚本及配置示例。会话 30 天有效，不自动恢复被撤销的权限。

## 验证与待做

当前业务有 37 项 Node 测试、3 项 SQLite、7 项服务端及 8 项 MCP 测试，另有隔离 Chrome UI 与双浏览器 API 脚本。最近完整验证见 [文档核对](DOCUMENTATION-REVIEW.md)。MCP 自然语言自主规划尚未专项验收；历史 M1 测试通过不等同所有新版场景通过。

搜索、日历、后台系统通知、深色模式、安卓、自启整机重启和异机备份等见 [TODO](../TODO.md)。用户授权开发阶段验证通过后直接发布、按需重启；高风险与凭据边界仍按实际授权执行。
