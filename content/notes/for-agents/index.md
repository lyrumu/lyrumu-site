---
title: "Agent配置"
date: 2026-07-29
draft: false
description: "分享自用 AI Agent 配置与使用记录，整理 Skills 和插件、MCP 工具、Pi Agent 和 OpenCode 的自用配置，以及 AGENTS.md 约定和配置备份入口。"
slug: ""
aliases: []
weight: -1
tags: [agent, skills, mcp, opencode]
categories: [share-resources]
topics: []
series: []
showDateUpdated: true
dateUpdated: "2026-11-22"
images: []
showHero: true
heroStyle: "background"
showTableOfContents: true
showBreadcrumbs: true
showReadingTime: true
showWordCount: true
showZenMode: true
showRelatedContent: false
showComments: false
sharingLinks: []
---

> 记录自用的agent配置以及使用方法(keep updated)

***

## Skills && Plugins

### Skills管理工具
- [Claudecode plugin system](安装claudecode CLI，使用其插件系统):
  `brew install claude-code` && `/plugin marketplace add XXX` && `/plugin install XXX`

- [Vercel官网提供的skill管理工具npx skills](https://www.skills.sh/)
- [SkillHub](https://www.skillhub.cn/)

### Great Skills && Plugins
- [Anthropic-official-plugins](https://github.com/anthropics/claude-plugins-official) - Claude code官方插件市场
- [mattpocock-skills](https://github.com/mattpocock/skills) - 适合工程性仓库的skills
- [Ponytail(Plugin)](https://github.com/DietrichGebert/ponytail) - 节省你的tokens
- [Andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) - 高星插件、skill


***

## MCP

- [Context7](https://context7.com/) - 给agent提供最新官方文档
- [Tavily](https://www.tavily.com/) - 让agent能够搜索网络信息
- [Playwright](https://playwright.dev/) - Web自动化
- [Shadcn](https://ui.shadcn.com/docs/mcp) - 提供前端组件库

***

## 其他工具

- [Ego-Lite](https://github.com/citrolabs/ego-lite) - 支持导入Chrome,Edge等浏览器数据.agent操控浏览器的同时不影响你的其他工作 个人认为在多数情况比playwright好用

***

## Setup

### Pi Agent

<details>
<summary>展开 Pi Agent 配置</summary>

我的 Pi 全局配置放在 `~/.pi/agent/`，用 chezmoi 同步到 `lyrumu/MY_AGENT` 的 `dot_pi/agent/`。下面的模型列表按本机配置整理，跟仓库里的列表略有出入。[Pi 配置目录](https://github.com/lyrumu/MY_AGENT/tree/main/dot_pi/agent) · [仓库中的 settings.json](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/settings.json)

**常规设置**

`settings.json` 里选了默认模型、切换模型时的候选范围和各模型的推理级别，也配置了全屏终端和默认工具。本机的代理地址、Skills 路径、设备标识和更新记录从下面的摘录里省略。[Pi 设置文档](https://docs.pi.dev/latest/settings)

```json
{
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.6-sol",
  "enabledModels": [
    "deepseek/deepseek-flash",
    "zai/glm-5.3-flash",
    "zai/glm-5.3",
    "xiaomi/mimo-v2.6-flash",
    "xiaomi/mimo-v2.6-pro",
    "openai-codex/gpt-5.6-sol",
    "openai-codex/gpt-6-luna",
    "openai-codex/gpt-6.1-terra",
    "openai-codex/gpt-6.2-sol"
  ],
  "modelThinkingLevels": {
    "deepseek/deepseek-flash": "low",
    "zai/glm-5.3-flash": "low",
    "xiaomi/mimo-v2.6-flash": "low"
  },
  "defaultTools": [
    "+codemode",
    "+grep",
    "+find",
    "+ls"
  ],
  "defaultProjectTrust": "always",
  "packages": [
    "npm:pi-web-access"
  ],
  "tuiMode": "fullscreen",
  "fullscreenExitOutput": "transcript",
  "fullscreenScrollbar": "always",
  "showHardwareCursor": true,
  "hideThinkingBlock": true,
  "steeringMode": "one-at-a-time",
  "collapseChangelog": true
}
```

`defaultTools` 的 `+` 在默认工具之外启用 Codemode、`grep`、`find` 和 `ls`。项目没有已保存的信任决定时，`defaultProjectTrust: "always"` 会让 Pi 信任并加载项目配置和资源。我的 `models.json` 目前没有自定义 Provider。[Pi 配置文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/configuration.md)

**快捷键**

我在 `keybindings.json` 里把全屏会话滚动到底部的快捷键改成了 Ctrl+Enter。[仓库中的 keybindings.json](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/keybindings.json)

```json
{
  "$schema": "https://pi.dev/schemas/keybindings.schema.json",
  "tui.altScreen.bottom": "ctrl+enter"
}
```

**全局规则和追加系统提示词**

- `~/.pi/agent/AGENTS.md` 是我的全局规则文件，要求先读代码、从第一性原理出发，复杂后端要做对抗性审查，做前端优化时要保持后端行为。[AGENTS.md](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/AGENTS.md)
- `~/.pi/agent/APPEND_SYSTEM.md` 是我追加到 Pi 系统提示词里的跨项目约定。需求不明确先问，使用 `grilling` 时用 `questionnaire` 收集答案。这里也记录了终端命令注释、代理和临时服务的处理方式。[APPEND_SYSTEM.md](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/APPEND_SYSTEM.md)

`~/.pi/agent/skills/` 下现在有 `domain-modeling`、`ego-browser`、`grilling` 和 `hallmark`。`settings.json` 另外配置了对共享 Skills 路径的排除规则。

**认证、MCP 和搜索**

我把 DeepSeek、Z.ai、小米、Context7 和 Tavily 的密钥存进 macOS 钥匙串。仓库文件保存 `!` 开头的取值命令，通过 `security find-generic-password` 从本机钥匙串读取。`private_auth.json` 是 chezmoi 里的文件名，应用到本机后是 `~/.pi/agent/auth.json`。[模型认证配置](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/private_auth.json)

`mcp.json` 里配了 Context7 的远程 MCP，工具暴露设为 `deferred`。下面两段的 `<MACOS_ACCOUNT>` 代表存入钥匙串时使用的账户名。[仓库中的 mcp.json](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/mcp.json)

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "Authorization": "!echo Bearer $(security find-generic-password -a '<MACOS_ACCOUNT>' -w -s 'context7-api-key')"
      },
      "description": "Up-to-date documentation and code examples for libraries and frameworks",
      "exposure": "deferred"
    }
  }
}
```

网页搜索用 `npm:pi-web-access`。`web-search.json` 里选 Tavily，工作流设为 `auto-summary`，让搜索结果直接生成摘要。[仓库中的 web-search.json](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/web-search.json)

```json
{
  "provider": "tavily",
  "workflow": "auto-summary",
  "tavilyApiKey": "!security find-generic-password -a '<MACOS_ACCOUNT>' -ws 'tavily-api-key'"
}
```

**我自己配置的扩展**

- `plan-mode` 用 `/plan` 或 Alt+Tab 切换，也能用 `pi --plan` 启动。规划时停用内置的 `edit`、`write`，Bash 只放行匹配允许列表的命令。确认执行后用 `/todos` 看计划进度。[用法](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/plan-mode/README.md) · [入口代码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/plan-mode/index.ts)
- `permission-gate.ts` 在 Bash 命令命中危险操作规则时弹出确认，无交互界面时直接拦截。[源码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/permission-gate.ts)
- `protected-paths.ts` 针对 Pi 的 `write` 和 `edit` 工具，拦截路径中包含 `.env`、`.git/` 或 `node_modules/` 的改动。[源码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/protected-paths.ts)
- `questionnaire.ts` 给 Agent 提供交互式问卷。单题显示选项，多题用标签页切换，支持自行填写答案。我在 `grilling` 流程里也用它。[源码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/questionnaire.ts)
- `openai-quota.ts` 通过本机已用 ChatGPT 登录的 Codex CLI 读取额度。用 `/quota` 开关显示，全屏模式下可以点击额度刷新。本机版本已去掉仓库版本里的旧命令别名。[仓库版本](https://github.com/lyrumu/MY_AGENT/blob/main/dot_pi/agent/extensions/openai-quota.ts)
- `prompt-context.ts` 在输入区上方显示当前一轮的用户提示。长提示可以点击或按 Ctrl+Shift+E 展开。这个文件目前在本机。
- `pi-diff` 用 `/diff` 查看本次会话改过的文件和补丁。我在本机通过软链接加载开发目录，源码单独放在 `lyrumu/pi-diff`。[使用说明](/works/pi-diff/) · [扩展入口](https://github.com/lyrumu/pi-diff/blob/main/index.ts)

</details>

### OpenCode

<details>
<summary>展开 OpenCode 配置</summary>

我的 OpenCode 全局配置放在 `~/.config/opencode/`，用 chezmoi 同步到 `lyrumu/MY_AGENT`。`opencode.jsonc` 配 Agent、权限、模型和工具，`cli.json` 配终端界面。项目自己的配置可以放在项目根目录或 `.opencode/` 下。[OpenCode 配置目录](https://github.com/lyrumu/MY_AGENT/tree/main/dot_config/opencode) · [官方配置文档](https://opencode.ai/docs/config/)

**Agent 和权限**

我把默认 Agent 设为 `plan`，先把需求和改动范围弄清楚，需要动手时再切到 `build`。会话标题交给 `agents.title.model` 指定的 `deepseek/deepseek-flash`。权限按动作和资源匹配，最后一条匹配的规则生效。[opencode.jsonc](https://github.com/lyrumu/MY_AGENT/blob/main/dot_config/opencode/private_opencode.jsonc) · [权限规则](https://opencode.ai/docs/permissions/)

- 读取默认允许，`.env`、`*.pem`、`*.key` 和 `keys/` 等路径有拒绝规则，`.env.example` 可读。工作目录之外的访问设为 `ask`。
- Shell 默认 `ask`，常用的查看、Git 检查、测试、lint 和构建命令可直接执行。配置也列了几种 `rm`、`sudo` 和下载管道的 `deny` 模式。
- `build` 额外拒绝匹配 `git push` 和 `git reset --hard` 的命令。

**更新、上下文和文件监听**

我用 `update: "auto"` 自动更新，Shell 用 `zsh`，开启代码格式化和自动压缩，并通过 `compaction.buffer` 预留 10,000 个 token。文件监听忽略 `.git`、`node_modules`、构建产物、日志和密钥目录。仓库里的 `lsp: true` 是兼容字段，OpenCode 不会因此启动语言服务器。旧配置里的 `permission`、`agent` 等字段可以参考迁移指南。[配置说明](https://opencode.ai/docs/config/) · [迁移指南](https://opencode.ai/docs/migrate-v1/)

**模型、MCP 和钥匙串**

- `providers` 配了 DeepSeek、Z.ai Coding Plan 和小米，分别从 `{env:DEEPSEEK}`、`{env:ZAI}`、`{env:XIAOMI}` 取值。Z.ai 的 `baseURL` 指向 Coding Plan 的接口。
- `mcp.servers` 配了两个本地进程。Context7 用 `npx -y @upstash/context7-mcp` 启动，读取 `{env:CONTEXT7_API_KEY}`。Tavily 用本机的 `tavily-mcp`，读取 `{env:TAVILY_API_KEY}`。[MCP 配置文档](https://opencode.ai/docs/mcp-servers/)

**启动时从钥匙串取值**

`opencode.jsonc` 顶部的 `// @keychain` 声明记录环境变量名、钥匙串中的服务名和账户名。例如 `DEEPSEEK` 对应 `deepseek` 条目。我的 zsh `opencode` 函数调用 `opencode-keychain`，脚本读取配置实际引用的条目，把密钥放进这次 OpenCode 进程的环境。读不到需要的条目时，脚本会停止启动。[钥匙串声明](https://github.com/lyrumu/MY_AGENT/blob/main/dot_config/opencode/private_opencode.jsonc#L2-L6) · [zsh 启动入口](https://github.com/lyrumu/MY_AGENT/blob/main/dot_zshrc#L37-L42)

启动脚本用 Homebrew 的 Python 运行，最终执行 `~/.opencode/bin/opencode`。交互界面、`run` 和 `mini` 默认加 `--standalone`，让这次启动的服务拿到刚读取的凭据。[opencode-keychain 源码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_local/bin/private_executable_opencode-keychain)

**终端界面**

我的标签页按工作目录分组，纵向显示，diff 用统一视图和文件树，选中文本即复制。`session.permissions` 设为 `autoaccept`，所以终端会话会自动批准 `ask` 请求，匹配 `deny` 的操作仍会被拦截。想逐次确认时可以改成 `prompt`。[cli.json](https://github.com/lyrumu/MY_AGENT/blob/main/dot_config/opencode/private_cli.json) · [终端界面文档](https://opencode.ai/docs/cli/config/)

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "theme": { "name": "system" },
  "diffs": { "wrap": "word", "view": "unified", "tree": true, "single": false },
  "session": {
    "sidebar": "auto",
    "scrollbar": true,
    "thinking": "hide",
    "markdown": "rendered",
    "grouping": "none",
    "verbosity": "low",
    "image_preview": false,
    "new_location": "launch",
    "permissions": "autoaccept"
  },
  "animations": true,
  "terminal": { "copy": "select" },
  "tabs": { "mode": "on", "scope": "cwd", "layout": "vertical", "indicators": "status" },
  "prompt": { "image_preview": true }
}
```

**插件和 Skills**

- `plugins` 配了 Ponytail。本机 OpenCode 的 Skills 目录里有 `domain-modeling`、`grilling` 和 `hallmark`。
- 我配了本地插件 `exclude-claude-agent-skills.ts`，从系统提示词的 Skills 清单中过滤全局 `~/.claude/skills` 和 `~/.agents/skills` 里的条目，也尝试从 `/skills` 的注册表移除这些条目。相同的 Skill 如果也出现在 OpenCode 的全局目录或项目的 `.opencode/skills`、`.agents/skills`，就会保留。[插件源码](https://github.com/lyrumu/MY_AGENT/blob/main/dot_config/opencode/plugins/exclude-claude-agent-skills.ts)

</details>

***

## AGENTS.md && Claude.md

- 第一性原理
- 对抗性审查

***

## 其他建议 

- 尽可能按需精简的你配置
- 在项目具体子模块中建立agent工作区
- 不要被你的agent激怒
- 注意会话上下文

***

## 配置管理与备份

参考站内文章:
- [使用Chezmoi管理dot-files](https://lyrumu.top/notes/%E4%BD%BF%E7%94%A8chezmoi%E7%AE%A1%E7%90%86dot-files/)


