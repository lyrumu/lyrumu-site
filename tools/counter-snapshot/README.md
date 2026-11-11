# Firebase 计数构建快照

`fetch.mjs` 使用现有 Firebase Web 配置匿名登录，分页读取 views、likes 并生成被 Git 忽略的 `data/counter_snapshot.json`；完整成功后才原子替换。Hugo 模板将其嵌入 HTML。没有快照时保留原占位；Firebase 监听成功后继续更新。读取完整集合后不存在的文档显示为 0。用户浏览器缓存优先于构建快照，因两者未比较时间，缓存可能更旧。

生产 Pages 构建命令需要在原 Hugo 命令前增加 `node tools/counter-snapshot/fetch.mjs &&`，具体 Hugo 参数保持 Pages 当前配置。Node 需要支持原生 fetch、AbortSignal.timeout（Node 18.17 或更新版本）。快照读取失败时构建失败，保留上一次成功部署，而不是发布空数据；这也会阻止当次代码更新部署。构建每次匿名登录会创建匿名 Firebase 用户，应检查账户清理策略及配额，Firestore Rules 必须允许匿名用户列出这两个集合。

## 上线前配置（尚未执行）

1. 将代码提交并推送到 GitHub 默认分支，并确认 Pages 生产分支也包含这些改动。
2. 在 Pages 项目的 **Settings → Builds** 修改生产构建命令，并为生产分支创建 Deploy Hook。确认原 Hugo 命令和 Node 版本符合上文要求。
3. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions → New repository secret** 创建 `PAGES_DEPLOY_HOOK`，把完整 Hook URL 填入 Secret。URL 可以触发生产构建，请只存入 Secret。
4. 在 GitHub 仓库的 **Actions → Refresh counter snapshot → Run workflow** 选择默认分支，手动试跑一次。在 Pages 确认部署成功，并检查构建日志中的 `Counter snapshot prepared`。Actions 成功表示 Pages 接收了构建请求。
5. 用无痕窗口检查首访数字。验证 Firebase 后台更新、不可达时回退，以及 Popular 的缓存提示。

工作流每天 UTC 05:23 检查一次，每四天触发构建。手动运行可随时触发。GitHub 定时任务可能延迟，公开仓库连续 60 天无活动时可能停用。触发或构建失败后，线上保留上次成功部署，快照可能超过四天。
