# dsh-inbox

![dsh-inbox](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/cover.png)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的**本地收件箱插件**：把随手复制的东西收进一个仓库，需要的时候找得回来——包括**在对话里让助手替你取**。

[English](README.md) | 中文

## 它是什么

一天里复制过的东西——一条待读的链接、一张截图、一段配置、一个账号密码——散落在剪贴板历史、收藏夹和临时文件里。dsh-inbox 把它们收进一个本地仓库：粘贴即存、自动分类、侧栏里能翻能搜；要找回什么，直接问助手「我上个月存的那篇讲缓存的文章呢」。

数据全部落在本机；只有你让助手查的时候，模型才看得到内容。

## 主要功能

| 功能 | 说明 |
|---|---|
| **两个入口** | 输入框里 `/inbox <文字或链接>`（图片附在输入框上一起收），或面板里粘贴 / 拖拽 / 选择文件 |
| **自动分类** | 链接按平台与类型分（60 多个站点：B 站、YouTube、公众号、掘金、知乎…）、文本按密钥形状分、图片按比例加「疑似证件」标签；规则判不出的交给模型兜底，有每日上限 |
| **面板** | 待看 / 类目 / 标签筛选 + 跨标题正文链接备注的搜索；两种列表密度；详情里能改名称、类目、备注、标签，能标待看、删除与恢复；**跟着 dsh 的主题和语言走** |
| **每条都有名字** | 链接抓页面自己的标题（不花模型 token）、图片文件用原文件名，你自己起的名字永远优先。读不到的页面——反爬页、死链——名字位留链接本身，不猜一个 |
| **类目是谁判的** | 类目旁的颜色标签：规则判定 / 模型判定 / 手动判定（你改过的，后续不会覆盖） |
| **对话里取回** | 问「我的收件箱 / 仓库 / inbox 里有哪些还没看的链接」即可，助手按关键词/类目/标签/待看/类型查（最多 10 条 + 还剩几条，带图的直接显示缩略图），按 id 打开一条（正文最多 1000 字、链接、备注、标签、附件信息）；回答上方的「打开 ↗」会跳到右侧「仓库」里那一条 |
| **看图** | 默认图片字节不进对话；你说「帮我看这张图是什么」时，才会把那一张发给自己看（一次性、显式要） |
| **密钥安全** | 账密正文**加密落盘**（主密码派生密钥，两者都不落盘）；列表只显示你起的名字；明文永不进对话、永不发给模型 |
| **双向同步** | 配 WebDAV 目录或 S3 桶：改动后几秒自动推送，「刷新」= 先推后拉完整同步、按 `id` + 时间合并；清空回收站连云端一起删；两台机器用同一个「目录」就互通 |
| **对话卡片** | 工具结果渲染成卡片：链接可点，图片标记在本机渲染成缩略图 |
| **网关兼容** | 有些对象存储网关把 AccessKey 绑在「应用」上、按客户端标识认人——插件**按协议各存一份客户端标识** |

## 界面

![面板：左侧筛选、中间列表、右侧详情](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/panel.png?v=1)

## 两种用法

**① 存：在对话里转存**

输入框里写 `/inbox` 再跟文字或链接，图片直接附在输入框上——**这条命令不会发给模型**，只进仓库。适合存账号密码、临时链接这类东西。

**② 取：在对话里问**

不用记命令，正常说话就行：

> 我收件库里那个小程序码是哪张？
>
> 上周存的讲缓存的文章给我看看
>
> 帮我把还没看过的链接列一下

同一段对话里的两次提问（真机截图）：

![按主题查仓库——密钥那两行只显示你起的名字](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/chat1.png)

![问「有没有待看的」：按「待看」标记把那一条取回来，带链接与存入时间](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/chat2.png)

## 安装

前置：Node ≥ 22 和一个能用的 `dsh`；没装 pnpm 时安装命令会顺手装好。**目前只在 Windows 上验收过**，macOS / Linux 未验证。

```powershell
# 安装（`dsh web` 就是 `dsh --profile web`，所以装进你日常启动的那个 profile）
npx @chance722/dsh-inbox init --profile web --install-pnpm

# 全新机器（还没跑过 dsh、没有这个 profile）多带一个 --create-profile
npx @chance722/dsh-inbox init --profile web --create-profile --install-pnpm

# 更新（init 只管装和接线，重复跑不会升级；刚发布的几分钟内请写确切版本：@0.2.6）
dsh plugin --profile web add @chance722/dsh-inbox@latest
```

装完**重启 dsh**，然后照旧启动。左栏出现 **Inbox**；新会话里问「我的收件箱里有哪些还没看的链接」，助手就会去查。

`init` 还会把 dsh 自带的 `standard` preset 复制到 `~/.dsh/.agent-presets/inbox/` 并加上本插件、把默认 preset 指向它——助手能看见收件箱工具就是靠这一步。那份快照不会跟着 dsh 以后升级 `standard` 一起变；它和 profile 都能退掉（见「卸载」）。

想让日常 dsh 保持干净：`npx @chance722/dsh-inbox init --create-profile`，然后 `dsh --profile inbox --no-open --port 3102`。

其它选项：`--profile <名字>`、`--install-pnpm`、`--no-default`、`--help`。

### 从本地仓库装

```powershell
git clone <本仓库> dsh-inbox ; cd dsh-inbox
pnpm install ; pnpm build
node lib/cli.js init --package <本仓库的绝对路径>
```

### 卸载

```powershell
# 1. 从你装进去的那个 profile 里摘掉（同时会从 dsh.profile.bundles 移除）
dsh plugin --profile <你装的 profile> remove @chance722/dsh-inbox

# 2. 删掉 init 建的东西
rm -r ~/.dsh/.agent-presets/inbox      # 那个 preset 副本
# 默认 preset：把 ~/.dsh/settings.yaml 里 agent-presets.default 删掉（继承部署默认），
# 或改成 standard；init 每次都留了 settings.yaml.bak-* 备份，也可以直接还原

# 3. 想连这个 profile 一起删（只为这个插件建过才需要）
rm -r ~/.dsh/profiles/<你装的 profile>
```

**卸载不会删掉你的仓库。** 连记录一起删：`rm -r ~/.dsh/storages/dsh_inbox`。

## 东西存在哪

全部在 `%DSH_HOME%` 下（Windows 上就是 `C:\Users\<你>\.dsh`）：

| 什么 | 在哪 |
|---|---|
| 记录：文本、链接、类目、备注、标签、待看… | `storages\dsh_inbox\items\*.json`（一条一个文件） |
| 附件索引（mime / 尺寸 / 原文件名） | `storages\dsh_inbox\attachments\*.json` |
| 图片 / 视频 / 文件的**字节** | `attachments\`（dsh 自己的附件仓库，按内容寻址，永不自动删） |
| 远端密码 / S3 AccessKey Secret | dsh 的凭证库 `.credentials.yaml` |
| 远端设置（地址、桶、客户端标识…） | dsh 的 settings |

### 云端长什么样

配了远端（WebDAV 目录或 S3 桶）、目录填 `/inbox` 时：

| 远端路径 | 是什么 |
|---|---|
| `inbox/<你扔的文件>` | **投放区**：任何设备往这儿扔文件，本机拉取时读它们并入库 |
| `inbox/sync/items/<记录 id>.json` | 一条记录的**机器可读版**（同步的真相来源） |
| `inbox/sync/items/<记录 id>.txt` | 同一条记录的**可读版**（云盘里直接能看：正文、备注、附件指向） |
| `inbox/sync/attachments/<附件 id>.<扩展名>` | 附件**字节**（图片 / 视频 / PDF 直接能打开） |
| `inbox/sync/attachments/<附件 id>.meta.json` | 附件元数据（原文件名、宽高、字节数、摘要） |
| 0 字节、以 `/` 结尾的 key | 云盘自己建的目录占位，不是插件写的 |

### 同步怎么走

- **自动**：入库或改动后几秒推一次（防抖）；「刷新」= 先推 → 再拉 → 重读列表。
- **合并**：按 `id` + 更新时间逐条判——谁新谁赢，不留冲突副本；需要的附件字节一起下来。
- **两台机器**：用同一个「目录」就互通（留空 / `/` / `inbox` 同义）。换过目录的机器留在别处的记录，可以在设置里打开「**同时合并别的同步目录**」一起拉回来。
- **删除**：「删除」只进回收站，别的设备会知道它被删了；「清空回收站」才连云端那份一起删。

## 隐私与安全

- **账密加密落盘**：账密正文以密文保存（AES-256-GCM，密钥由主密码派生）。主密码和密钥都不落盘——每次重启都要在「设置 → 账密加密」解锁一次；密码忘了就解不开，没有找回。没设主密码时，账密**不会被存进去**。
- **加密的边界**：只加密账密的**正文**。备注、类目、标签、时间与附件的**字节**不在内——附件里装着密钥，它就是明文。
- **列表与对话脱敏**：密钥类记录在列表里只显示你起的名字；明文永不进对话、永不发给模型。
- **图片**：分类时会把图片发给模型判断；对话里默认只回 `[attachment:id]` 标记。只有你明确让助手「看这张图」时，它才会把那一张发给自己看。
- **模型看不到你的仓库**，除非你让它查（它调工具时才读得到），且分类请求先过脱敏。
- **云端要有访问控制**：同步上去的内容里只有账密正文是密文，其余（文本、链接、备注、附件字节）是明文；主密码与密钥从不同步。
- **装它会改到面板之外的一处**：抓链接标题是本插件唯一的对外请求（一次 GET，只在本机捕获的链接上发，同步拉进来的不抓）。它用的是**浏览器形状**的身份，由本包的 `cordis.patch.yml` 覆盖 `web-fetch-http.userAgent` 写成。这层身份是整个 profile 的，模型的 web 工具也一起用；**你自己的 `cordis.patch.yml` 覆盖得掉**。细节见 [docs/help/link-title-fetch.md](docs/help/link-title-fetch.md)。

## 开发

```powershell
pnpm install
pnpm build        # lib/index.js（宿主）+ lib/client.js（面板）+ lib/cli.js（init）+ lib/types
pnpm typecheck
pnpm test         # vitest
```

改客户端代码：`pnpm build` 后页面会自己重载（dsh 的 client-hmr）；改宿主代码要重启服务。细节见 [docs/help/dev-setup.md](docs/help/dev-setup.md)，阶段记录在[开发总线](docs/feature/dev-bus.md)。

日常想在**线上发布版**和**本地改动**之间切换（默认 profile 是 `web`，换 profile 加 `DSH_PROFILE`）：

```powershell
pnpm dev:status    # 现在用的是哪一个：本仓库 / 线上包
pnpm dev:npm       # 切到 npm 上发布的版本（体验发布版）
pnpm dev:local     # 切回当前仓库（会先 pnpm build 再链接）
```

## 许可

MIT
