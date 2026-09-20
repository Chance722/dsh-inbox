# dsh-inbox

![dsh-inbox](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/cover.png)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的**本地收件箱插件**：把随手复制的东西收进一个仓库，需要的时候找得回来——包括**在对话里让助手替你取**。

[English](README.md) | 中文

## 它解决什么问题

一天里复制过的东西——一条待读的链接、一张截图、一段配置、一个账号密码——散落在剪贴板历史、收藏夹和临时文件里，要用的时候找不到，也记不住放在哪。

**dsh-inbox 把它们收进一个本地仓库**：粘贴即存、自动分类、侧栏里能翻能搜；想找的时候不必自己翻，直接在对话里问助手「我上个月存的那篇讲缓存的文章呢」。

它只服务于你自己：数据全部落在本机，只有你让助手查的时候，模型才看得到内容。

## 主要功能

| 功能 | 说明 |
|---|---|
| **两个入口** | 输入框里 `/inbox <文字或链接>`（图片附在输入框上一起收），或面板里粘贴 / 拖拽 / 选择文件 |
| **自动分类** | 链接按平台与类型分（B 站视频、公众号文章…）、文本按密钥形状分、图片按比例加「疑似证件」标签；规则判不出的交给模型兜底，有每日上限 |
| **面板** | 待看 / 类目 / 标签筛选 + 跨标题正文链接备注的搜索；两种列表密度；详情里能改名称、类目、备注、标签，能标待看，能删除与恢复；**跟着 dsh 的深色/浅色主题走，也跟着它的语言走**（在「设置 → 常规」里把 dsh 切成 English，面板、右侧 dock、对话卡片与使用手册一起变） |
| **每条都有名字** | 链接自动抓页面标题（不花模型 token）、图片文件用原文件名；你自己起的名字永远优先。列表里显示名字本身，类型交给左侧图标（密钥就是一把钥匙） |
| **类目是谁判的** | 类目旁带颜色标签：规则判定（灰）/ 模型判定（紫）/ 手动判定（蓝）。你改过的类目，后续任何流程都不会覆盖 |
| **对话里取回** | 直接问「我的收件箱 / 仓库 / inbox 里有哪些还没看的链接」就行，助手按关键词/类目/标签/待看/类型查（最多 10 条 + 还剩几条，带图的结果直接显示缩略图），按 id 打开一条（正文最多 1000 字、链接、备注、标签、附件信息）。想直接看某一条：展开回答上方的「N 次工具调用」，记录后面的「打开 ↗」会在右侧「仓库」里停到那一条 |
| **看图** | 默认图片字节不进对话；你说「帮我看这张图是什么」时，助手才会把那张图发给自己看（一次性、显式要） |
| **密钥安全** | 账密正文**加密落盘**：主密码派生密钥，密码与密钥都不落盘；列表只显示你起的名字；明文永不进对话、永不发给模型 |
| **双向同步** | 配一个 WebDAV 目录或 S3 桶：入库后自动推送，点「刷新」做一次完整同步（先推后拉、按时间合并），清空回收站连云端一起删 |
| **对话卡片** | 工具结果渲染成 dsh-inbox 卡片：链接可点，图片标记在本机渲染成缩略图 |
| **网关兼容** | 有些对象存储网关把每把 AccessKey 绑在"应用"上并按客户端标识认人（状态码与"密码错"一样）——插件支持**按协议各存一份客户端标识** |

## 界面

![面板：左侧筛选、中间列表、右侧详情](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/panel.png)

界面都在 dsh 里：左侧栏多一个 **Inbox** 入口，点开是整页仓库管理；面板右上角有「设置」和「使用手册」（手册把常见场景讲了一遍）。

## 两种用法

**① 存：在对话里转存**

输入框里写 `/inbox` 再跟文字或链接，图片直接附在输入框上——**这条命令不会发给模型**，只进仓库。适合存账号密码、临时链接这类不该出现在对话里的东西。

**② 取：在对话里问**

不用记命令，正常说话就行：

> 我收件库里那个小程序码是哪张？
>
> 上周存的讲缓存的文章给我看看
>
> 帮我把还没看过的链接列一下

同一段对话里的两次提问（真机截图）：

![按主题查仓库：助手先给命中的那一条，再把 7 条记录列成表——密钥那两行只显示你起的名字，没有明文](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/chat1.png)

![问「有没有待看的」：按「待看」标记把那一条取回来，带链接与存入时间](https://raw.githubusercontent.com/Chance722/dsh-inbox/main/docs/assets/chat2.png)

## 安装

前置：Node ≥ 22、一个能用的 `dsh`（`@deepseek-ai/dsh`），以及 **pnpm**——dsh 的 `plugin add` 是转发给 pnpm 的；没有就先 `npm i -g pnpm`（`init` 会明确告诉你并**在动手之前**停下）。

**平台**：目前只在 **Windows** 上做过完整验收；macOS / Linux **尚未验证**（代码里没有平台特定依赖，欢迎试用后反馈）。

`dsh web` 就是 `dsh --profile web`，所以直接装进你日常启动的那个 profile：

```powershell
npx @chance722/dsh-inbox init --profile web
```

然后照旧启动——`dsh web`。左栏出现 **Inbox**；新会话里问「我的收件箱里有哪些还没看的链接」，助手就会去查。

全新机器（从没跑过 dsh，还没有 `web` 这个 profile）加 `--create-profile` 让它先建：

```powershell
npx @chance722/dsh-inbox init --profile web --create-profile
```

`init` 做三件事，重复运行是安全的：

1. 把插件装进这个 profile——面板和宿主半边都从这里来
2. 复制 dsh 自带的 `standard` preset 到 `~/.dsh/.agent-presets/inbox/` 并加入本插件——**这一步决定助手能不能看到收件箱工具**
3. 把你**用户级**的默认 preset 指向它（会先备份 `~/.dsh/settings.yaml`），于是所有 profile 的新会话都带上这套工具

有两件事跟你的设置有关，先说清楚：插件会进你点名的那个 profile；你的默认 agent preset 变成「收件箱」那份——**它是 `standard` 的副本快照，dsh 以后升级 standard 不会自动跟着变**。两件都能退（见「卸载」）。

**想让日常 dsh 保持干净？** 给插件单独一个 profile 和端口：

```powershell
npx @chance722/dsh-inbox init --create-profile     # 建一个隔离的 inbox profile
dsh --profile inbox --no-open --port 3102          # 在那个 profile 里起
```

其它选项：`--profile <名字>` 装到别处，`--no-default` 不动默认 preset，`--help` 列全。装进哪个 profile 只决定**面板跑在哪儿**——agent preset 是所有 profile 共享的（`~/.dsh/.agent-presets/inbox/`），装第二个 profile 只会补上缺的那行。

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

全部在本机（`%DSH_HOME%`，Windows 上就是 `C:\Users\<你>\.dsh`）：

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

## 隐私与安全

- **账密加密落盘**：账密正文以密文保存（AES-256-GCM，密钥由你设的主密码派生）。**主密码和密钥都不落盘**——服务每次重启都要在「设置 → 账密加密」解锁一次；密码忘了就解不开已有密文，没有找回。没设主密码时，账密**不会被存进去**。
- **加密的边界**：只加密账密的**正文**。备注、类目、标签、时间与附件的**字节**不在内——附件里装着密钥，它就是明文。别把"账密加密"理解成"整个仓库加密"。
- **列表与对话脱敏**：密钥类记录在列表里只显示你起的名字；明文永不进对话、永不发给模型。
- **图片**：分类时会把图片发给模型判断（手机拍的证件照比例与普通照片无异）；对话里默认只回 `[attachment:id]` 标记，字节不进对话。**唯一的例外**：你明确让助手「看这张图」时，它会把那一张发给自己看——每次都要显式要求，默认永不发。
- **模型看不到你的仓库**，除非你让它查（它调工具时才读得到），且分类请求先过脱敏。
- **云端要有访问控制**：同步上去的内容里只有账密正文是密文，其余（文本、链接、备注、附件字节）是明文；主密码与密钥从不同步。

## 开发

```powershell
pnpm install
pnpm build        # lib/index.js（宿主）+ lib/client.js（面板）+ lib/cli.js（init）+ lib/types
pnpm typecheck
pnpm test         # vitest
```

改客户端代码：`pnpm build` 后刷新页面即可（dsh 的 client-hmr 会自己重载）；改宿主代码要重启服务。细节见 [docs/help/dev-setup.md](docs/help/dev-setup.md)，阶段与验收记录在[开发总线](docs/feature/dev-bus.md)。

## 许可

MIT
