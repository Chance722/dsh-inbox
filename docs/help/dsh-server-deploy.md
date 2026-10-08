# 把 dsh 部署到服务器常驻（SSH 隧道访问 / 移动端）

> 适用：让 dsh 的**宿主进程**长期在线。本仓库的现实动机是 `@xmanrui/dsh-im` 的微信机器人
> 不能依赖桌面端是否开着。结论来自 2026-10-08 在一台 Ubuntu 24.04 / 2C4G 云服务器上的
> 真实部署与实测；**凡未实测的方案都在标题里标了「未实测」**。

## 一句话

机器人的在线状态跟**宿主进程**走，不跟浏览器页面走。dsh-im 是宿主侧插件、微信通道是**出站**长轮询
（`https://ilinkai.weixin.qq.com/`，`DEFAULT_LONG_POLL_TIMEOUT_MS = 35s`），所以宿主常驻在服务器上
就等于机器人 24/7 在线；而 UI 只监听回环、靠 SSH 隧道看——**服务器一个公网端口都不用开**。

这条区分很重要：把 `dsh web` 从桌面挪到服务器，解决的**不是**"页面要一直开着"，而是"宿主别死"。

## 为什么不用 `--host 0.0.0.0`

- CLI **明确拒绝**，报错原文（`dsh-web-app/lib/startup.js`，0.1.5-rc.2 与 npm `latest` 0.2.0-rc.2 一字不差）：
  `error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead`
- 但 webserver 的 schema 仍然接受这个字面量：`host: z.union([z.const("127.0.0.1"), z.const("0.0.0.0")])`，
  所以 profile 的 `cordis.patch.yml` 里写 `host: 0.0.0.0` 是**能生效**的——而且 `resolveLanTrust()`
  会顺带把本机非 internal 的 IPv4 网卡地址加进 `trustedHosts`。**这正是官方警告的那条路**：
  要走它，前面必须补一层认证（反代 + basic auth / mTLS / 只在内网或 tailnet 里可达）。
- `--trusted-host <authority>` **只解决 `/api` 的 Host/Origin 围栏，不改变监听地址**，别把两个参数混为一谈。
- 云主机上还要记住：主机层 `ufw` 往往是 `inactive`，真正的门是安全组。绑 `0.0.0.0` 之后
  "有没有暴露"完全取决于安全组那一条规则。

## 鉴权模型（决定"能不能暴露"）

| 环节 | 实测事实 |
|---|---|
| 登录 | 启动时把 `http://127.0.0.1:<port>/?token=<43 字符>` 打在 stdout；**每次重启换新 token**，不落盘 |
| 会话 | 带 token 访问根路径 → `303` 到 `/` + `Set-Cookie`（HttpOnly + SameSite=Strict + HMAC 签名，绑定 authority） |
| 有效期 | `cookieMaxAgeDays` 默认 **30 天**；签名密钥持久化在凭据库（`client-connection/browser-session`） |
| 重启后 | **旧 cookie 依然有效**（实测：重启 dsh 后带旧 cookie 访问 `200`，不带 cookie `401`） |
| `/api` 围栏 | 要求 Host 是回环或 trustedHosts，且 `Sec-Fetch-Site != cross-site`、`Origin == Host` |

⇒ **没有用户名密码**，凭据就是那个 URL（或它换来的 cookie）。URL 泄漏 = 对方在你服务器上有一个 shell。
所以只有两种正经用法：**SSH 隧道**，或者**反代 + 额外一层认证**。

隧道比公网暴露**功能更全**：回环 Host 天然过围栏，连"仅允许回环"的管理端点（dsh-im 的更新与入站 TTL 管理）也能用。

## 装机：Node 放独立前缀，不动系统的

Ubuntu 24.04 自带 `node 18`，而 dsh 要 **Node ≥ 22**（dsh-im 的 `engines` 是 `>=22.19`）。
**不要**去替换系统 node（别的服务可能在用），装到独立前缀、在 systemd 单元里写绝对路径：

```bash
V=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c 'import json,sys;print([x["version"] for x in json.load(sys.stdin) if x["version"].startswith("v22")][0])')
curl -fsSL -o /tmp/node22.tar.xz "https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz"
sudo mkdir -p /opt/node22 && sudo tar -xJf /tmp/node22.tar.xz -C /opt/node22 --strip-components=1
sudo -n env PATH=/opt/node22/bin:/usr/bin:/bin npm i -g pnpm@latest @deepseek-ai/dsh@<版本>
```

实测：系统 `node -v` 仍是 `v18.19.1`（`/usr/bin/node`），`/opt/node22/bin/node -v` 是新的那条，互不影响。
**服务器上的 dsh 版本要和桌面端对齐**（`npm view @deepseek-ai/dsh version` 问一次），否则两边行为可能不一致。

## 建 profile 与装插件

```bash
export PATH=/opt/node22/bin:$PATH
dsh plugin --profile web add @xmanrui/dsh-im        # 微信等 IM 桥
dsh plugin --profile web add @chance722/dsh-inbox   # 收件箱 + 同步
dsh --profile web --dump-config | grep -nE "xmanrui|chance722" -A2   # 核对组合
```

要点：

- **`web` 是 shipped 模板**：`dsh plugin --profile web add` 在 profile 目录不存在时会用模板的 bundle 列表
  初始化（`plugin-Ddi42qoW.js` 里 `PROFILE_TEMPLATES[profile]?.bundles ?? DEFAULT_PROFILE_BUNDLES`），
  所以**不会**掉进"只有 base、没有 web 应用"那个坑——那个坑属于**自定义 profile 名**，见 `dev-setup.md`。
- 装完 `package.json` 的 `dsh.profile.bundles` 应该是 `base + web-app + 你的插件`。
- `pnpm peers check` 会报一堆 `missing peer @deepseek-ai/...`：**这是正常的**——那些宿主包由 dsh 本体提供，
  不在 profile 的 `node_modules` 里。

## systemd 单元（含内存上限与提权隔离）

```ini
[Unit]
Description=DeepSeek Harness (dsh) web host - dsh-im WeChat bridge + dsh-inbox
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<运行用户>
Group=<运行用户>
WorkingDirectory=/home/<运行用户>
Environment=DSH_HOME=/home/<运行用户>/.dsh
Environment=PATH=/opt/node22/bin:/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production
ExecStart=/opt/node22/bin/node /opt/node22/lib/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --no-open --port 3080
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
MemoryHigh=640M
MemoryMax=1G
TasksMax=512
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

三个必须记住的点：

1. **`[Install]` 不能忘**。少了它 `systemctl enable` 只把服务标成 `static`——现在能跑，**重启机器不会自启**。
   现象：`systemctl is-enabled dsh` 回 `static` 而不是 `enabled`。
2. **内存上限是"不影响同机其他服务"的关键**。dsh 空闲实测很小（本机空 home ≈ **185 MB RSS**；
   服务器上带两个插件 idle ≈ **190–280 MB**），但**它能拉起任意子进程**——一句"帮我重新构建项目"
   就是 `mvn`/`npm` 级别的内存尖峰。`MemoryHigh/MemoryMax` 把账算在 dsh 自己头上（cgroup 内 OOM），
   而不是让 OOM killer 去挑 RSS 最大的 MySQL。
3. **`NoNewPrivileges=true` 会挡掉 agent 用 sudo**，这是刻意的隔离（防止它在服务器上动别人的服务）；
   需要放开就删掉这一行，代价自负。

## 访问：SSH 隧道

服务器上只监听 `127.0.0.1:3080`，本机把端口接过来即可：

```powershell
ssh -N -L 3081:127.0.0.1:3080 <ssh-alias>   # 本机 3081 → 服务器 3080
ssh <ssh-alias> "journalctl -u dsh -n 400 --no-pager | grep -o 'http://127.0.0.1:3080/?token=[A-Za-z0-9_-]*' | tail -1"
# 浏览器开 http://127.0.0.1:3081/?token=<上一条取到的>
```

（本仓库 `scripts/` 下有个本机小工具把这套做成一键：建隧道 + 取 token + 开浏览器；它**不在版本库里**，
见 `.gitignore` 末段。）

实测过、值得先知道的四件事：

1. **本地端口用 3081 而不是 3080**：你本机自己的 dsh 就占着 3080。
2. **页面没有写死端口**：抓回来的首页里 `3080` 出现 **0 次**，`__DSH_BOOT__` 里的插件地址全是相对路径
   （`plugins/??pkg/client.js&rev=…`），所以换端口映射不会让 UI 连错地址。
3. **`/api` 围栏按"是不是回环"判断，与端口无关**：经 3081 访问得到的是 `404`（路径不存在）而不是 `403`（被围栏拒）。
4. **隧道只是通道**：关掉隧道只是你看不见界面，服务器上的宿主与机器人在跑；反过来，**重启宿主不影响已登录的浏览器**（cookie 30 天）。

管服务的四条命令：

```powershell
ssh <ssh-alias> "systemctl status dsh"
ssh <ssh-alias> "sudo systemctl restart dsh"    # 改了宿主侧插件/配置必须重启
ssh <ssh-alias> "sudo systemctl stop dsh"
ssh <ssh-alias> "journalctl -u dsh -f"
```

**Windows 上写这类脚本有个坑**：Windows PowerShell 5.1 按 **ANSI/GBK** 读 `.ps1`，
UTF-8 无 BOM 的中文注释会把脚本解析炸掉（`.cmd` 里的中文 `REM` 甚至会被当成命令执行）。
运维脚本**写成纯 ASCII** 最省事（本仓库那个就是），或者存成 UTF-8 with BOM。
另外别用单字母函数名：`h` 是 `Get-History` 的别名，调用时会把参数（可能是密钥）回显进报错。

## 移动端访问（未实测）

手机不能像桌面那样随手开 SSH 隧道，三条路：

| 路线 | 前提 | 代价 |
|---|---|---|
| 手机 SSH 客户端做本地转发（Termius / JuiceSSH / Termux） | 手机上装能配 local forward 的客户端 | 每次要开转发；与桌面小工具同机制 |
| Tailscale / ZeroTier + 绑 `0.0.0.0` | dsh 绑 `0.0.0.0`（走 patch）；tailnet 网卡地址会被自动加进 trustedHosts；安全组只放行 tailnet | 机器上确实多了一个全网卡监听，全靠防火墙兜住 |
| 反代 + 额外认证（nginx + `--trusted-host <域名>`） | 域名 + 证书 + basic auth / mTLS / Access 类网关 | 对外暴露面最大，认证层必须真的拦住 |

共同点：**`?token=` 那条 URL 仍然是唯一的登录凭据**，手机浏览器的 cookie 一样是 30 天；
换手机或清 cookie 就回服务器 `journalctl` 里再取一次。

## 排查备忘

- **自检 401/403 全形状都失败，而另一台机器同样配置能用** → 先怀疑**凭据值本身**（粘贴带进的
  首尾空白、长度差一位），别先怀疑网关。数据胶囊（`s3.cstcloud.cn`）对"签名不对 / 凭据不对 /
  客户端标识不对"一律回 **401 空 body**，状态码没有信息量；详见 `remote-gateway-compat.md`。
  跨机器比对**不要打印密钥**，比 `长度` + `sha256` 前缀即可：
  `sha256(" " + 正确值)` 与出问题那台的值指纹相同 ⇒ 就是多了个前导空格。
- **日志里的 token 是凭据**：贴日志、写文档、做诊断输出前一律
  `sed -E "s/token=[A-Za-z0-9_-]+/token=<已隐藏>/g"`。
- **微信通道别双绑**：桌面端与服务器同时用同一个绑定做长轮询会互相踢；迁移时先停桌面那份。
  换机器后凭据是新的一条（ref 名里带账号标识，如 `DSH_WEIXIN_BOT_TOKEN_<账号>`），老的那份记得停掉。

## 复现路径（本仓库这次实际做的事）

1. 只读体检：`nproc` / `free -m` / `ip -4 -o addr` / `sudo ss -lntp` / 已装 node 版本 / 出网到
   `nodejs.org`、`registry.npmjs.org`、`ilinkai.weixin.qq.com`。
2. 装 `/opt/node22` + pnpm + dsh（版本与桌面端对齐）。
3. `dsh plugin --profile web add` 两个插件，`--dump-config` 核对组合。
4. 写 systemd 单元 → `daemon-reload` → `enable --now` → 核对 `is-active` / `is-enabled` /
   `MemoryCurrent` / `ss -lntp`。
5. 本机开隧道，验 `无 token → 401` / `带 token → 303 + Set-Cookie` / `带 cookie → 200`。
6. 重启服务再验一次 cookie（`200`），确认不需要重新取 token。
7. 客户端在 UI 里扫码绑定微信、配同步端点与主密码（这两步只能人做）。

## 当前没有的东西

- 没有 systemd 之上的进程守护（`Restart=on-failure` 之外不额外套 supervisor）。
- 没有自动化部署脚本：本文是一次手工部署的记录，路径/用户名按各人环境替换。
- 移动端三条路线均未实测（见上表标注）。
