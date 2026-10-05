---
title: "Linux Basics: WSL2 Setup and AI Agent Practices"
seoTitle: "WSL2 Linux Setup & AI Agent Practices"
date: 2026-06-23
draft: false
description: "WSL2 Ubuntu Installation and Configuration, Linux Common Commands, AI Agent General Practices (Session Discovery and Recovery, Project Mounting, Security Hardening), and WSL2 Common Issues Fix Records"
slug: ""
aliases: []
weight: 0 #如果文章需要置顶 把weight改成负数即可
tags: [linux, wsl2, agent]
categories: [engineering-practice]
topics: []
series: []
showDateUpdated: false
dateUpdated: ""
images: []
showHero: true
heroStyle: "background"
heroBackground: ""
heroImage: ""
heroBackgroundImage: ""
showTableOfContents: true
showBreadcrumbs: true
showReadingTime: true
showWordCount: true
showZenMode: true
showRelatedContent: false
relatedContentLimit: 3
showComments: false
sharingLinks: []
---

本文记录在 Windows 上搭一套 Linux 工具链的完整过程：**WSL2 环境 → 常用命令 → AI Agent 通用实践 → 踩坑修复**。

相比双系统和 VMware/VirtualBox，WSL2 启动不到 2 秒、资源按需动态分配，且文件系统互通（Windows 上的项目可以直接用 Linux 工具链处理）。

分三部分，可按需跳读：

1. **WSL2 安装与配置** —— 装系统、换源、隔离 Windows PATH、命令速查、代理
2. **AI Agent 通用实践** —— 与具体工具无关的用法：Session 绑定、项目挂载、安全加固
3. **WSL2 踩坑修复录** —— VMware 关机挂起、WinNAT 端口冲突、DNS 解析超时

> 第 3 部分是踩坑记录，结论都是本机实测得出，不是官方文档的转述。

---

## 第一部分：WSL2 安装与配置

### 1. 安装 Ubuntu

#### 1.1 一键安装（推荐）

以 **管理员身份** 打开 PowerShell，执行：

```powershell
wsl --install
```

默认安装当前最新的 Ubuntu LTS（**现在是 24.04 noble**，早期版本装的是 22.04 jammy）。安装完成后**重启电脑**。

> ⚠️ 记住你装到的是哪个版本 —— 下面换源时要用到，两者不通用。

#### 1.2 验证安装

重启后打开"Ubuntu"应用（开始菜单搜索），首次启动会要求设置用户名和密码（Linux 账户，与 Windows 账户独立）。

进入终端后执行：

```bash
lsb_release -a
# 应输出你实际安装的版本，例如 Ubuntu 24.04 LTS (noble)
# 精简镜像里可能没预装 lsb_release，改用：
cat /etc/os-release
```

#### 1.3 重装 Ubuntu（环境彻底损坏时）

如果 Ubuntu 环境被搞乱（例如 PATH 污染严重、依赖混乱），最干净的办法是**重装**：

```powershell
# 在 PowerShell 中执行
wsl --unregister Ubuntu
```

然后重新打开 Ubuntu 图标，会自动触发重装。需要重新设置用户名和密码。

---

### 2. 基础配置

#### 2.1 更新软件包

```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
```

#### 2.2 换源（国内加速）

默认源在国外，更新和装包都很慢。**清华源** 国内速度极快。

先确认你的发行版代号，并备份原配置：

```bash
lsb_release -cs                        # 22.04 → jammy，24.04 → noble，以此类推
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
```

**Ubuntu 22.04 及更早**，编辑 `/etc/apt/sources.list`：

```bash
sudo nano /etc/apt/sources.list
```

将文件内容**全部替换**为（把 `jammy` 换成 `lsb_release -cs` 输出的代号）：

```bash
# 清华大学开源软件镜像站
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-security main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ jammy-backports main restricted universe multiverse
```

> ⚠️ **24.04 起 Ubuntu 改了格式**：源文件不再是 `/etc/apt/sources.list`，而是 `/etc/apt/sources.list.d/ubuntu.sources`，内容为 deb822 格式（`URIs:` / `Suites:` / `Components:` 字段）。直接套用上面的 `deb ...` 单行写法会失效，改之前先打开原文件看格式。
>
> ⚠️ **版本号必须匹配**：`jammy` 的源配到 `noble` 系统上会直接搞坏依赖关系。

保存退出（`Ctrl+O` → `Enter` → `Ctrl+X`），然后：

```bash
sudo apt update
```

输出无报错即成功。

> 💡 **黑盒脚本**：也可以用 `bash <(curl -sSL https://linuxmirrors.cn/main.sh)` 一键换源（脚本会自己识别版本和格式），但脚本是黑盒的，建议了解原理后手动配。

#### 2.3 关闭 Windows PATH 继承（推荐）

WSL2 默认会**继承 Windows 的 PATH**，把 Windows 的可执行文件都带进 Linux 环境，Python 装了多个版本时容易乱。

优化前的样子：

![优化环境变量](image/优化环境变量.webp)
*`echo $PATH` 看到的 PATH 列表，可以看出 Windows 的路径混了进来*

关闭继承：

```bash
sudo nano /etc/wsl.conf
```

在文件末尾追加：

```bash
[interop]
enabled = true
appendWindowsPath = false
```

`Ctrl+O` 写入 → `Enter` 确认 → `Ctrl+X` 退出。

**在 Windows PowerShell** 里重启 WSL 让配置生效：

```powershell
wsl --shutdown
```

重新打开 Ubuntu，执行 `echo $PATH`，PATH 列表会干净很多。

#### 2.4 关于 systemd

> 官方文档：[使用 systemd 通过 WSL 管理 Linux 服务](https://learn.microsoft.com/zh-cn/windows/WSL/systemd)

印象里"WSL2 没有 systemd"已经过时了：**用 `wsl --install` 装的发行版，systemd 现在是默认开启的**，可以直接用 `systemctl` 管理服务。

```bash
systemctl status          # 有输出即 systemd 作为 PID 1 在跑
sudo systemctl restart nginx
```

代价是**启动变慢、内存和 CPU 占用略增**（systemd 需要接管 PID 1）。如果确实不需要，可以在 `/etc/wsl.conf` 里关掉；反过来，老发行版要手动开：

```bash
[boot]
systemd = true
```

改完同样要 `wsl --shutdown` 才生效。

#### 2.5 备份 Ubuntu（强烈推荐）

环境配置相对干净后**务必导出一份备份**：

```powershell
# 在 Windows PowerShell 执行
wsl -l -v                          # 复制输出的完整 Ubuntu 名称（默认是 Ubuntu）
wsl --shutdown                     # 先关闭 WSL
wsl --export Ubuntu D:\wsl_backup\ubuntu_snapshot.tar
```

> ⚠️ **U盘备份坑**：U盘如果是 FAT32，单文件 > 4GB 会失败。先把 U盘格式化成 **exFAT** 再备份。

恢复备份：

```powershell
wsl --import Ubuntu D:\wsl_install D:\wsl_backup\ubuntu_snapshot.tar
```

---

### 3. 常用命令与开发环境

#### 3.1 高频命令速查

WSL2 默认用户是普通用户，需要 root 权限时加 `sudo`。下面只列高频的，更全的用 `tldr <命令>`（`sudo apt install tldr`）查，比背手册快。

| 用途 | 命令 |
|------|------|
| 文件与目录 | `ls -la` · `cd ~` · `mkdir -p a/b/c` · `cp -r src/ dst/` · `mv old new` · `rm -rf dir`（慎用） |
| 查看文件 | `cat` · `less`（`q` 退出） · `head -n 20` · `tail -f log.txt` |
| 搜索与替换 | `grep -rn "TODO" src/` · `sed -i 's/old/new/g' file.txt` |
| 进程 | `ps aux \| grep python` · `top` · `kill -9 PID` · `pkill -f name` |
| 权限 | `chmod 755` · `chmod +x` · `chown user:group file` |
| 磁盘与内存 | `df -h` · `du -sh dir/` · `free -h` |
| 网络 | `ip addr` · `ip route` · `curl -I url` · `ssh user@host` · `scp file user@host:/path` |
| 压缩解压 | `tar -czvf a.tar.gz dir/` · `tar -xzvf a.tar.gz` · `unzip file.zip` |
| 后台运行 | `nohup python app.py &` |
| 快捷键 | `Ctrl+C` 终止 · `Ctrl+R` 搜索历史 · `Ctrl+L` 清屏 · `Ctrl+A/E` 行首/行尾 |

权限数字速记：`r=4 / w=2 / x=1`，三位分别代表 **所有者 / 用户组 / 其他人**（`755` = `rwxr-xr-x`）。

#### 3.2 安装 Node.js（nvm 管理多版本）

很多 CLI 工具和 AI Agent 都依赖 Node.js，用 nvm 管理多版本比直接装系统包更省事：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc                      # 加载配置
nvm --version                         # 验证

nvm install --lts                     # 安装最新 LTS
nvm ls                                # 列出已安装版本
node -v && npm -v                     # 验证
```

需要多版本共存时 `nvm install 20` / `nvm use 20` 切换即可，不会互相污染。

---

### 4. WSL2 网络与代理

WSL2 走 NAT，**网关 IP 每次重启都会变**，所以代理地址不能写死。

> 涉及国外网络时，先在 Windows 的 Clash Verge（或同类代理软件）里确认代理端口（HTTP 一般是 `7890`）。

#### 4.1 取 Windows 主机 IP

```bash
ip route | grep default            # 找 "default via" 后面的 IP
# 或一行拿到：
HOST_IP=$(ip route | awk '/default/ {print $3}')
```

> ⚠️ 网上流传的 `172.30.30.1` 是错的。实际常见的是 `172.30.16.1` 这类，子网 `172.30.16.0/20` —— 以 `ip route` 实际输出为准，别抄。

#### 4.2 临时配置

```bash
export http_proxy="http://$HOST_IP:7890"
export https_proxy="http://$HOST_IP:7890"
curl ipinfo.io                     # 有输出即代理生效
```

#### 4.3 永久配置（写入 ~/.bashrc）

```bash
nano ~/.bashrc
```

在文件末尾追加：

```bash
# 自动获取 Windows Host IP
HOST_IP=$(ip route | awk '/default/ {print $3}')
# HTTP / HTTPS Proxy
export http_proxy="http://$HOST_IP:7890"
export https_proxy="http://$HOST_IP:7890"
# SOCKS5 Proxy（按 Clash 实际端口修改）
export all_proxy="socks5://$HOST_IP:7898"
```

加载配置并验证：

```bash
source ~/.bashrc
env | grep proxy                    # 应输出三个 proxy 变量
```

这样每次开 shell 都会重新取网关 IP，不受重启影响。

---

## 第二部分：AI Agent 通用实践

下面整理终端 Agent 的工作目录、项目存放位置和安全实践；会话筛选与恢复方式因工具而异。

### 1. Session 查找与工作目录（重要）

> ⚠️ 这条目录经验来自 OpenCode：改名或移动目录后，原会话可能不再出现在当前目录的列表中。**列表找不到会话，不等于会话已丢失**；其他 Agent 的筛选和恢复方式要分别核对。

推荐做法：

- **优先在 project root 启动**，保持工作目录一致，方便找回会话；只处理某个子项目时，也可以从对应子目录启动
- **移动或改名项目后先检查会话筛选与恢复入口**，不要直接判断旧 session 已失效

```bash
# 推荐：在 project root 启动
cd project_root

# 只处理 backend 子项目时，也可以从这里启动
cd project_root/backend
```

以 Codex CLI 为例，`resume --all` 可以关闭当前目录筛选，`-C` 可以指定工作目录：

```bash
# 在全部会话中选择旧会话，并指定项目的新路径
codex resume --all -C /path/to/project

# 已知会话 ID 时，可直接恢复
codex resume <SESSION_ID> -C /path/to/project
```

OpenCode、Claude Code 等工具应查看各自版本的恢复入口；在确认数据丢失前，不必先改回原目录名。

### 2. 项目放在 WSL 内还是 /mnt/c

```bash
# /mnt/c/ 是 WSL 访问 Windows C 盘的固定挂载点
cd /mnt/c/Users/YourName/project
```

`/mnt/c/` 让 WSL 能直接操作 Windows 上的项目，但**跨文件系统的读写明显慢于 WSL 内部**（尤其是大量小文件，Agent 遍历仓库时代价被放大）。

- 临时改几行、或项目必须在 Windows 侧打开 → 放 `/mnt/c/`
- 长期开发、跑构建和测试 → 放 WSL 内（`~/projects/`）

### 3. 安全加固 checklist

Agent 有执行命令和读写文件的能力，部署时把这几点做掉：

- **密钥文件收紧权限**：`chmod 600 ~/.<tool>/.env`，凭据只放这里，不进仓库
- **开启危险命令审批**：多数 Agent 支持审批模式（如 `manual` / `smart` / `off`），设为 `manual`，不要图省事关掉；同时设一个合理的超时
- **远程入口配 allowlist**：接入消息平台（Telegram / Slack 等）时，明确列出允许的用户 ID，否则等于把 shell 暴露给所有人
- **用容器隔离执行环境**：把 Agent 的终端后端切到 Docker，避免它直接动宿主机
- **不以 root 运行**：给它一个受限的普通用户
- **设置资源限制**：CPU / 内存 / 磁盘都要有上限，防止失控的循环把机器拖死
- **定期更新**：Agent 迭代很快，保持更新

---

## 第三部分：WSL2 踩坑修复录

下面三个问题的共同点是：报错信息误导性很强，根因都不在报错指向的地方。结论均为本机实测。

### 1. VMware 导致 WSL 关机挂起

**症状**：Trae / VS Code 连接 WSL 后关机 / 重启，屏幕熄灭，风扇转，电源灯常亮，需强制关机。

**根因**：

1. `vmx86.sys` 驱动开机自动加载且带 `IGNORES_SHUTDOWN` 标志（主因）
2. VMnet1 / VMnet8 虚拟网卡 + VMware 服务关机时阻塞（次因）

**修复（管理员 PowerShell）**：

```powershell
# 1. 禁用 vmx86 驱动
sc.exe stop vmx86
sc.exe config vmx86 start= demand

# 2. 禁用 VMware 服务
Stop-Service VMAuthdService, VMnetDHCP, VMUSBArbService, "VMware NAT Service" -Force
Set-Service VMAuthdService, VMnetDHCP, VMUSBArbService, "VMware NAT Service", VmwareAutostartService -StartupType Disabled

# 3. 禁用虚拟网卡
Disable-NetAdapter -Name "VMware Network Adapter VMnet8" -Confirm:$false
Disable-NetAdapter -Name "VMware Network Adapter VMnet1" -Confirm:$false
```

**恢复 VMware**（需要用时）：

```powershell
Enable-NetAdapter "VMware Network Adapter VMnet8"
Enable-NetAdapter "VMware Network Adapter VMnet1"
Set-Service VMAuthdService, VMnetDHCP, VMUSBArbService, "VMware NAT Service" -StartupType Automatic
Start-Service VMAuthdService, VMnetDHCP, VMUSBArbService, "VMware NAT Service"
```

**效果**：关机耗时 ~3 分钟 → **~38 秒**。

---

### 2. WinNAT 端口冲突

**症状**：服务报 `EACCES: permission denied 0.0.0.0:PORT`，但 `netstat` 查不到占用进程 —— 端口被 WinNAT 随机保留了。

**排查**：

```powershell
# 1. 查进程占用（大概率查不到）
netstat -ano | findstr :PORT

# 2. 查 WinNAT 保留范围
netsh interface ipv4 show excludedportrange protocol=tcp
```

端口出现在排除范围里 → 确认是 WinNAT 随机保留。

**修复（管理员 PowerShell，必须按顺序）**：

```powershell
wsl --shutdown                  # 先停 WSL
net stop winnat                 # 再停 WinNAT
net start winnat                # 再起 WinNAT
```

> ⚠️ **顺序错误会损坏 WSL2 网络**：先动 WinNAT 再 `wsl --shutdown`，会导致必须重启 Windows 才能恢复网络。

---

### 3. WSL2 DNS 解析超时

**症状**：WSL2 里访问外部 API 时**间歇性**超时、连接错误（Python `httpx`、Node `fetch` 都遇到过），但同样的地址在 Windows 上正常。

**根因**：

1. WSL2 默认 DNS `10.255.255.254` 对部分域名解析**间歇性超时**
2. 未配置代理，直连时遇到 DNS 失败就整体超时

#### 修复 1：固定 WSL2 DNS

```bash
# 阻止 WSL 自动覆盖 DNS
sudo tee -a /etc/wsl.conf <<< $'\n[network]\ngenerateResolvConf = false'

# 重建 resolv.conf
sudo rm /etc/resolv.conf
sudo tee /etc/resolv.conf << "EOF"
nameserver 223.5.5.5
nameserver 114.114.114.114
EOF
```

> ⚠️ **必须 `wsl --shutdown`**：`/etc/wsl.conf` 的修改需要 WSL 实例完全重启后才生效，否则自定义 DNS 会被自动还原。

#### 修复 2：配置代理

按 **第一部分 §4** 的永久配置写好 `~/.bashrc` 即可（关键是动态取网关 IP，不要写死）。

#### 排查用的两个技巧

```bash
# 1. DNS 是否解析正常
nslookup api.example.com

# 2. 跳过 DNS 直连 IP，判断问题出在 DNS 还是网络
#    先 nslookup 拿到 IP，再：
curl --resolve api.example.com:443:<上一步拿到的IP> https://api.example.com/v1/models
```

如果跳过 DNS 后请求正常，说明问题在 DNS（用修复 1）；如果仍然超时，问题在网络层（用修复 2）。
