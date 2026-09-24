---
title: "Codex初始配置与常见问题"
date: 2026-09-24
draft: false
description: "记录 Codex 网络代理反复reconnecting重连、VS Code 扩展、日志写盘伤害硬盘问题的实际排查经验。"
slug: ""
aliases: []
weight: 0
tags: [agent, chatgpt]
categories: [tools, ai]
topics: []
series: []
showDateUpdated: false
dateUpdated: ""
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

> 接续[Codex Plus 订阅指南](/notes/codex-plus/)。这里整理的是我在 Codex 配置会话中实际遇到的网络代理、VS Code 扩展和日志写盘问题；路径与端口请按自己的设备核对。

***

## 1. 网络代理：区分应用重连与命令联网

### Codex 反复 reconnecting

当时用 `codex doctor` 检查，发现 Codex 主进程没有代理环境变量，网络诊断失败。核对 Clash Verge 的实际监听端口后，我把代理变量写入用户级 `~/.codex/.env`，完全重启 Codex；再次诊断时，ChatGPT 地址和 WebSocket 连接恢复。`config.toml` 中只设置命令环境，不能解决主进程没有代理的问题。

这是我个人设备的原因和验证结果。遇到重连时，先检查网络、代理监听端口和 `codex doctor` 的具体失败项，不要照抄别人的端口。


`.codex/.env`示例：
```markdown
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
ALL_PROXY=http://127.0.0.1:7897
http_proxy=http://127.0.0.1:7897
https_proxy=http://127.0.0.1:7897
all_proxy=http://127.0.0.1:7897
NO_PROXY=localhost,127.0.0.1,::1
no_proxy=localhost,127.0.0.1,::1
# 具体端口参考你本机clashverge的设置
```
***

### Codex 能对话，执行的联网命令却失败

我把 `proxyon` 定义在 `~/.zshrc`。Codex 调用的非交互式 zsh 不会加载这个函数；需要在*同一次命令*中启动交互式 zsh、开启代理并执行联网操作：

```zsh
# 在交互式 zsh 中加载自定义 proxyon，并执行需要联网的命令
/bin/zsh -ic 'proxyon && curl -I https://github.com'
```

一次命令导出的环境变量不会自动保留到下一次独立的工具调用中。上面的示例只适用于自己定义了 `proxyon` 的情况。

综上,如果未开clashverge的全局代理 可以在codex的全局AGENTS.md里添加一条:
```markdown
- 终端命令涉及网络访问时，使用 `/bin/zsh -ic 'proxyon && <实际命令>'`。
  proxyon 定义在 ~/.zshrc 中，需要交互式 zsh 加载。
  开启代理和实际网络命令必须在同一次 shell 调用中执行，
  不要假设代理环境变量会跨工具调用保留。
```

***

## 2. VS Code 扩展：更新与会话

我遇到过桌面端可用的模型在 VS Code 扩展里看不到。排查发现本机扩展版本偏旧：`extensions.autoCheckUpdates` 被关闭，扩展还固定了版本。后来开启扩展更新检查、保留“只对选定扩展自动安装更新”的设置，Codex 扩展更新成功；不需要打开所有扩展的自动安装。[VS Code 扩展更新说明](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)

CLI 和 IDE 扩展读取相同的 Codex 配置层；桌面端和扩展访问同一项目时，代码文件的改动都能看到。但这不代表聊天列表会双向完整显示。缺少会话时，先核对打开的项目和客户端版本。[Codex 配置说明](https://learn.chatgpt.com/docs/config-file/config-basic)

这次也核对了 VS Code 的备份范围：个人设置、快捷键和代码片段适合按文件管理；记录部分扩展自动更新名单的 `state.vscdb` 还混有其他状态，不适合作为普通配置跨设备套用。具体备份方式可参考站内的[chezmoi 配置管理笔记](/notes/使用chezmoi管理dot-files/)。

***

## 3. TRACE 日志异常写盘

我曾检查到 Codex 的 `logs` 数据库持续写入 TRACE 日志，于是备份后用 SQLite trigger 拦截新日志。后续采样没有再观察到高频写盘，但 trigger 仍在，不能据此判断当前版本已经修复。它也会丢掉 ERROR 等诊断日志，其他设备应先确认是否真的有持续异常写入。[官方故障排查说明](https://learn.chatgpt.com/docs/reference/troubleshooting)列出了日志位置；分享日志前需要检查敏感信息。

这是我当时使用的原始提示词；它涉及数据库修改，使用前应先核对路径与诊断结果。

修复写盘的prompt:
```markdown
帮我检查1. .codex/logs 2. .codex/sglite 是否因TRACE日子持续高频写盘。如果中招 先备份 再用SQLite trigger 拦截logs表insert。#checkpoint/truncate WAL，最后确认MAX(id)和WAL不再增长
```
