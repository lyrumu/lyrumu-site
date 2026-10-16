---
title: "Codex初始配置与常见问题"
date: 2026-09-24
lastmod: 2026-10-10
draft: false
description: "记录 Codex 反复 reconnecting 重连、Agent 终端联网失败与 proxyon 代理快捷函数、VS Code 扩展、TRACE 日志写盘伤硬盘问题的实际排查经验。"
slug: ""
aliases: []
weight: 0
tags: [agent, chatgpt]
categories: [tutorials]
topics: []
series: []
showDateUpdated: true
dateUpdated: "2026-10-10"
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

> 接续[Codex Plus 订阅指南](/notes/codex-plus/)。这里整理的是我在Codex等Agent配置会话中实际遇到的网络代理、VS Code 扩展和日志写盘问题；路径与端口请按自己的设备核对。

本文大部分内容针对 macOS，Windows 需甄别后稍作修改再使用。让终端稳定联网的部分对所有 Agent 都适用，即使你没遇到同类问题，也可能提升 Agent 的执行效率。

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

### Agent 能对话，执行的联网命令却失败

代理软件的流量通常不会被终端主动继承，macOS 和 Windows 都一样。Agent 执行的 Bash 命令里只要涉及联网——拉取 GitHub 仓库、装依赖、请求 API——就会连不出去而卡住，拖慢整个流程。

让终端也走代理有两条路：

1. 代理软件开启 **TUN 模式**，由它接管终端的流量。代价是 TUN 本身不够稳定：代理超时或临时断开时，原本可以直连的内容也会一起访问不了。
2. 给终端手动设置**临时代理变量**。关闭终端后变量会自动失效，不会污染系统环境，缺点是每次都要手动输一遍。

```zsh
# 端口换成你本机代理软件实际监听的那个
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890
```

想省掉每次手输，可以把它们封装成 `proxyon` / `proxyoff` 两个快捷函数。下面这段提示词可以直接丢给任何 Agent，让它按你的系统生成：

```text
帮我写两套终端快捷函数：
1. macOS(zsh)：在 ~/.zshrc 中定义 proxyon / proxyoff
2. Windows(PowerShell)：在 $PROFILE 中定义 proxyon / proxyoff

功能：
proxyon：设置终端环境变量 HTTP_PROXY、HTTPS_PROXY、ALL_PROXY，指向 socks5 代理地址（默认 127.0.0.1:7890），输出提示已开启代理。
proxyoff：清空这三个代理环境变量，输出提示已关闭代理。

要求：
- 注释写清楚，附带安装步骤、重载配置命令、验证命令 curl ip.sb
- 区分：只修改当前终端会话环境变量，不会启动代理软件本身
- 输出分开 macOS 代码块和 Windows 代码块
```

在 macOS 上把 `proxyon` 定义进 `~/.zshrc` 之后还有一层坑：Codex 等 Agent 调用的**非交互式 zsh 不会加载这个函数**。需要在*同一次命令*中启动交互式 zsh、开启代理并执行联网操作：

```zsh
# 在交互式 zsh 中加载自定义 proxyon，并执行需要联网的命令
/bin/zsh -ic 'proxyon && curl -I https://github.com'
```

一次命令导出的环境变量不会自动保留到下一次独立的工具调用中。

所以更省事的做法是：快捷函数设好之后，在 Agent 的全局 `AGENTS.md` 里加一条规则，让它遇到联网命令时自动带上代理。这样即使你没有事先手动执行 `proxyon`，Agent 也会自己处理。

```markdown
- 终端命令涉及网络访问时，使用 `/bin/zsh -ic 'proxyon && <实际命令>'`。
  proxyon 定义在 ~/.zshrc 中，需要交互式 zsh 加载。
  开启代理和实际网络命令必须在同一次 shell 调用中执行，
  不要假设代理环境变量会跨工具调用保留。
```

***

## 2. TRACE 日志异常写盘

我曾检查到 Codex 的 `logs` 数据库持续写入 TRACE 日志，于是备份后用 SQLite trigger 拦截新日志。后续采样没有再观察到高频写盘，但 trigger 仍在，不能据此判断当前版本已经修复。它也会丢掉 ERROR 等诊断日志，其他设备应先确认是否真的有持续异常写入。[官方故障排查说明](https://learn.chatgpt.com/docs/reference/troubleshooting)列出了日志位置；分享日志前需要检查敏感信息。

这是我当时使用的原始提示词；它涉及数据库修改，使用前应先核对路径与诊断结果。

修复写盘的prompt:
```text
任务：排查 .codex/logs 和 .codex/sqlite 是否因为TRACE日志产生高频写盘。
流程：
1. 检测：确认写盘来源是否为logs表持续插入TRACE记录
2. 确认问题后，先完整备份sqlite数据库文件
3. 编写SQLite BEFORE INSERT触发器，阻止logs表新增记录（插入时抛出异常中止写入）
4. 执行 PRAGMA wal_checkpoint(TRUNCATE)，完成WAL checkpoint并截断WAL
5. 校验：查询MAX(id)不再上涨，WAL文件不再持续增大
输出：检测命令、备份步骤、触发器SQL、WAL操作语句、验证查询语句，附带风险说明。
```

***

## 3. VS Code 扩展：更新与会话

我遇到过桌面端可用的模型在 VS Code 扩展里看不到。排查发现本机扩展版本偏旧：`extensions.autoCheckUpdates` 被关闭，扩展还固定了版本。后来开启扩展更新检查、保留“只对选定扩展自动安装更新”的设置，Codex 扩展更新成功；不需要打开所有扩展的自动安装。[VS Code 扩展更新说明](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)

CLI 和 IDE 扩展读取相同的 Codex 配置层；桌面端和扩展访问同一项目时，代码文件的改动都能看到。但这不代表聊天列表会双向完整显示。缺少会话时，先核对打开的项目和客户端版本。[Codex 配置说明](https://learn.chatgpt.com/docs/config-file/config-basic)

这次也核对了 VS Code 的备份范围：个人设置、快捷键和代码片段适合按文件管理；记录部分扩展自动更新名单的 `state.vscdb` 还混有其他状态，不适合作为普通配置跨设备套用。具体备份方式可参考站内的[chezmoi 配置管理笔记](/notes/使用chezmoi管理dot-files/)。
