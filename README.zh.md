# dsh-inbox

[English](README.md) | 中文

> **状态：pre-alpha，M0–M5 已完成。** 两个口能存、面板里能翻能管、对话里能直接问，而且**存进来的东西已经分好类**：规则判它判得准的，剩下的一次 `deepseek-flash` 兜底。下一步是同步（M6）。进度和验收记录在[开发总线](docs/feature/dev-bus.md)。

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）做的个人收件箱插件：把链接、图片、文本、账密粘进一个本地仓库，自动分类，侧栏里能翻，对话里能取回来。

## 现在能用的（M4）

| | |
|---|---|
| ✅ 侧栏入口 | 左侧「全局面板」下多出一行 **Inbox**，点它中间区域整个换成插件页面 |
| ✅ 工具到得了模型 | `inbox_status` 会报告仓库是否打开、存了多少条 |
| ✅ 两个捕获口 | 输入框里 `/inbox <文字或链接>`（图片附在输入框上一起收），或面板里粘贴/拖拽/选择文件 |
| ✅ 翻和管 | 按未读/类目/标签筛选，跨标题、正文、链接、备注搜索，详情里有图片缩略图，能改类目、描述、标签，能标已读 |
| ✅ 回收站 | 删除是软删；能恢复，也能清空（清空才真删记录） |
| ✅ 存储与合并 | 记录走 dsh 自己的存储栈持久化；同样的东西再存一次会并进原记录 |
| ✅ 对话里问 | `inbox_search` 按关键词/类目/标签/状态/类型查；`inbox_get` 按 id 打开一条（正文最多 1000 字、链接、备注、标签、附件信息） |
| 🔒 两条永不 | 密钥类记录永不返回明文；图片字节永不进**对话**——只回一个标记，由界面在本机渲染。（分类时允许把图片发给模型，这是刻意选择且有上限，见下一条） |
| ✅ 自己的对话卡片 | 工具结果渲染成 dsh-inbox 卡片：链接可点，图片标记变成在本机绘制的缩略图 |
| ✅ 规则自动分类 | B 站 `/video/` 判成视频/音频、公众号判成文章、密钥形状的粘贴判成密钥/账密（判成之后永不回显）、卡证比例的图只标"疑似证件"——全部在本机判断，不外传 |
| ✅ 你说的算 | 自己改的类目会标记成"你判的"，任何后续流程都覆盖不了 |
| ✅ 有上限的模型兜底 | 规则判不出的文字、或认得出平台的链接，会先脱敏再问一次 `deepseek-flash`。每天上限 200 次 / 10 万 token，花费记在仓库里；失败就退回规则结果。图片永不外发。 |
| ✅ 单向同步 | 配一个 WebDAV 目录，任何设备往 `inbox/` 扔文件；仓库在启动时或按需拉取、分类、重复合并。地址与用户名进 dsh 的设置，密码进 dsh 的凭证库。 |

### 你的数据存在哪

仓库是 dsh JSON 存储后端上的一个域（`dsh_inbox`），一条记录一个文档：

```
~/.dsh/storages/dsh_inbox/
```

第一次写入时才创建。这个插件不会把它发到任何地方——见下面的隐私红线。

## 它要做什么

- **收**——在 inbox 面板里粘贴或拖拽；或者在聊天框里加前缀转存（不发给模型）。
- **分**——规则优先（链接判平台和类型、账密走正则、图片走本地启发式），模型兜底；**你自己写的描述永远优先**。
- **看**——左侧栏一个切换按钮，把会话列表换成一个仓库视图：类目、标签、未读、软删。
- **取**——在对话里问，原内容回到你眼前（文本内联、图片缩略图、链接标题卡）。
- **同步（单向）**——任何设备往 WebDAV 的 `inbox/` 目录扔文件，仓库启动时拉取并分类。离开本机的内容一律加密。

## 这个项目给自己定的隐私红线

- 账密加密落盘、列表脱敏，**永不**发给模型、**永不**在对话里输出明文。
- 证件照默认全本地判断，不为"猜一下"上传任何图片。
- 仓库不会被自动塞进模型上下文——只有模型主动调工具时才看得见。

## 安装

> 还没发到 npm（M7 做 `npx @duoyu/dsh-inbox init`）。在那之前从本地仓库装。

```powershell
# 1. 构建插件
git clone <本仓库> dsh-inbox ; cd dsh-inbox
pnpm install
pnpm build

# 2. 建一个隔离 profile（已存在就跳过）
dsh --profile inbox --from-default-profile web

# 3. 挂载插件——这步会自动把包名写进 profile 的 dsh.profile.bundles
dsh plugin --profile inbox add <本仓库的绝对路径>

# 4. 跑起来
dsh --profile inbox --no-open --port 3102
```

打开打印出来的地址（带 token）。你日常的 `dsh web` profile 完全不受影响。

`dsh` 可能不在 `PATH` 上；带 Node 与 bin 完整路径的命令在 [docs/help/dev-setup.md](docs/help/dev-setup.md)。

### 卸载

```powershell
# 1. 从 profile 里摘掉（同时会从 dsh.profile.bundles 移除）
dsh plugin --profile inbox remove @duoyu/dsh-inbox

# 2. 删掉插件不再需要的东西
rm -r ~/.dsh/profiles/inbox          # 隔离 profile
rm -r ~/.dsh/.agent-presets/inbox-m0 # 只在你建过测试 preset 时才有
```

**卸载不会删掉你的仓库数据。** 如果连记录也要删：

```powershell
rm -r ~/.dsh/storages/dsh_inbox
```

插件没有装进 `dsh` 本体，也没碰任何全局状态，所以删掉 profile 目录就是彻底卸载。

## 开发

### WebDAV（手机进来的那条路）

打开面板，点右上角 **⚙ 入库设置**，填地址（例如 `https://data.cstcloud.cn/dav`）、
目录（默认 `/inbox`）、用户名和密码。保存后点 **立即拉取**。

别的设备往那个目录里扔的东西会被拉下来、分类、入库——文本类文件变成文本或链接，
其他变成附件。每次启动也会在后台拉一次，服务器挂着不会拖慢也不会阻断启动。

| 用途 | 命令 |
|---|---|
| 装依赖 | `pnpm install` |
| 构建 | `pnpm build`（esbuild → `lib/index.js` + `lib/client.js`） |
| 类型检查 | `pnpm typecheck` |
| 测试 | `pnpm test`（vitest） |
| 跑开发 profile | `dsh --profile inbox --no-open --port 3102` |

浏览器实际加载的是构建产物，所以**改完要先 build 再刷新页面**。构建会 spawn 子进程（esbuild），有些沙箱会拦。

项目规范在 [AGENTS.md](AGENTS.md)，知识文档索引在 [docs/help/index.md](docs/help/index.md)。

## 许可

MIT
