# dsh-inbox

[English](README.md) | 中文

> **状态：pre-alpha，M0 与 M1 已完成。** 插件骨架能跑了，仓库也能存能查了。粘贴和分类还没做。进度和验收记录在[开发总线](docs/feature/dev-bus.md)。

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）做的个人收件箱插件：把链接、图片、文本、账密粘进一个本地仓库，自动分类，侧栏里能翻，对话里能取回来。

## 现在能用的（M1）

| | |
|---|---|
| ✅ 侧栏入口 | 左侧「全局面板」下多出一行 **Inbox**，点它中间区域整个换成插件页面 |
| ✅ 工具到得了模型 | `inbox_status` 会报告仓库是否打开、存了多少条 |
| ✅ 存储与查询 | 记录走 dsh 自己的存储栈持久化；筛选、软删、恢复都已实现并有单测 |
| ❌ 还没有 | 捕获、分类、仓库列表界面、同步——M2–M6 才做 |

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
