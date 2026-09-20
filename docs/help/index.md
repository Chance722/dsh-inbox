# 知识文档索引

> AGENTS.md 只记「主题 → 路径」，正文一律在本目录。新增/改名/归档必须同步更新本表。

| 主题 | 路径 | 一句话 |
|---|---|---|
| dsh 插件平台实测事实 | `dsh-plugin-platform.md` | dsh 的扩展点、限制、安装机制，逐条带证据路径 |
| 已锁定的产品与架构决策 | `product-decisions.md` | 需求边界、隐私红线、分类与生命周期规则 |
| 本地开发与验收流程 | `dev-setup.md` | 建 profile、挂插件、起服务、headless 验证工具的命令 |
| 仓库数据模型 | `vault-data-model.md` | 域 spec、词汇表、记录结构、查询语义、软删 |
| 对象存储网关兼容性排查 | `remote-gateway-compat.md` | 401/403 的三种可能、客户端标识按凭证绑定、数据胶囊实测矩阵 |
| 远端目录布局 | `remote-sync-layout.md` | `inbox/` 里每个名字的含义、记录信封、附件命名理由、上云加密边界、还没做的两件事 |
| 同步机制（推/拉/合并） | `sync.md` | 三种触发、推什么、按 `id`+`updatedAt` 合并的规则、加密边界、出错的排查表、还没做的四件事 |
| 面板 UI 的视觉/几何验证 | `ui-visual-check.md` | 真机 token 拿不到时，用 headless Chrome 量列宽与"能否放一行" |
| 面板主题（深色/浅色） | `panel-theme.md` | 怎么问出宿主的配色方案、三个反色坑、镜像页的五个场景 |

## 维护记录

| 时间 | 维护时 HEAD | 变更摘要 |
|---|---|---|
| 2026-09-20 | `_待填_` | **M8 第八步：一条命令对全新机器也成立**——实测全新机器上 `npx @duoyu/dsh-inbox init` 直接退出码 1（dsh 的 `web` 模板里没有 `inbox` profile），与 README 的"一条命令装好"不符。新增 **`init --create-profile`**：profile 不存在时用 `dsh --profile <名字> --from-default-profile web --dump-config` 建一个再继续；**默认不开**（profile 名打错应该是报错，不是凭空造 profile），报错里也把这条路写在提示中；顺手把 `--dump-config` 的整棵树从输出里捕获掉（成功只报一行，失败才打原文）。`package.json` 加 `"prepublishOnly": "pnpm build"`（不再可能发出过期的 `lib/`）。新增 **`test/cli.test.ts`** 5 条（默认值/全部选项/`--create-profile` 开关/`--help`/拒绝未知选项·缺值·不合规 preset id），为此给 `src/cli.ts` 加了"只在作为程序运行时才执行 main"的守卫——否则单测一 import 就会真去改 `~/.dsh`。真机在 `inbox-fresh`/`inbox-fresh2` 两个全新 profile 上各跑通一次，临时 profile 已删。README 中英安装段改成 A/B 两种走法 |
| 2026-09-20 | `386e979` | **M8 第七步：深链真的会定位到那一条**——用户报「从对话里拿到的内容没有可点进 Inbox 详情的入口」。现场（内置浏览器打开 3102 真机）复核：**卡片与「打开 ↗」都在**，只是 dsh 默认把一轮里的多次调用折叠成一行「N 次工具调用」（用户读的是助手的回答，回答本身是纯文本）；**同时逮到真 bug**：点下去 dock 停在**列表**上。根因：`sidebar.right.pane.tab` 的 body props 是**会话 slot share**（实测键 `usePanelInfo…useTabInfo`），**没有** `hooks.tabInfo`（那只是 `SlotMap` 里 `hookContext` 的工厂名）⇒ `params?.id` 恒为 `undefined` ⇒ 组件自己的"没参数就显示列表"兜底**静默**生效。修法：读 `props.useTabInfo()`（保留旧形状兜底）+ 把解析抽成纯函数 `dockFocusOf()`，新增 `test/dock.test.ts` 4 条。**真机验收**：展开「3 次工具调用」→ 点「打开 ↗」→ 右侧「仓库」停在那条（标题/类目/待看/时间/可点链接/「返回最近」），修复前同一操作只有列表。入口可见性：查过 `ui-conversation` 产物，**没有**"默认展开工具调用"的偏好项 ⇒ 写进使用手册第 6 节新增的「点开看」与 README 中英。平台事实（tab 体 props 形状与 `useTabInfo`、keyed `tool.call.toolview` 替换普通行、一轮多次调用默认折叠）进 `docs/help/dsh-plugin-platform.md` |
| 2026-09-20 | `a688826` | **规则泄漏修掉**：用户发现自己在“用收件箱”的 dsh 会话里被助手附上了本仓库 AGENTS.md 的「本次参考 docs」声明——真因是 `@deepseek-ai/dsh-agent-instructions`（`dsh-base` 默认启用，65536 字节预算）会把从项目根到会话工作目录的 `AGENTS.md`/`CLAUDE.md` 注入**每个**在该目录开的会话，而原规则只写了“任务执行类 / 纯闲聊”，没界定“**使用**插件”这一档 ⇒ 模型两难。AGENTS.md 那条改成「只在动过本仓库的回合（改代码/排查/维护文档/提交）声明，只是用插件一个字都别写」，并已用真会话复验（模型推理里直接写“just using the plugin — no declaration needed”，回复不再带声明块）。平台事实写进 `docs/help/dsh-plugin-platform.md`（含三条“彻底不注入”的路子） |
| 2026-09-20 | `aa3994e` | **M8 第六步：助手侧工具全坏的真因**——插件在**同一进程里被加载两次**（profile bundle 给面板与宿主半边，agent preset 给会话的工具），而 `ctx.storageDomain` **按域名只允许 open 一次** ⇒ 第二个实例 open 失败，它注册的 `inbox_search`/`inbox_get`/`inbox_status` 全答「仓库没有打开」，而面板（先 open 的那个实例）一切正常。修法：`src/host/vault/lease.ts` —— **进程级单例 + 引用计数**（`globalThis` 注册表，跨包副本也共享；失败不留坏槽位），⇒ 面板解锁与对话工具**共用一把内存钥匙**、启动那次拉取**每进程只跑一次**。新增 `test/lease.test.ts`（6 条，真实存储栈；含"裸调第二次 `open` 仍抛 already open"，把 bug 本身钉住）；**真会话端到端**（headless 派生 profile + 插件作 bundle + 默认 preset = 双加载组合）验 `dsh-inbox v0.1.0: vault open, 7 record(s).`。顺手：`inbox_status` 不再印内部里程碑 `M6c`，改印**构建期从 package.json 注入的版本号**（`scripts/build.mjs` 的 define + `src/globals.d.ts`）；工具描述、`init` 写的 preset 说明、面板手册第 6 节与 README 中英补上 `收件箱 / 仓库 / 个人仓库 / inbox` 这些用户自己的说法，真会话问「我的个人仓库里有哪些还没看的链接？」确认命中 `inbox_search`。规则进 AGENTS 第 2 条与 `docs/help/dsh-plugin-platform.md`；`dev-setup.md` 的验证配方从 M0 那版换成能复现双加载的这版 |
| 2026-09-20 | `1c658b4` | **M8 第三~五步**：README 中英改成产品介绍（删状态行、补封面与真面板截图、加"两种用法"）；**助手提到的一条能在右侧仓库点开**（工具结果里的 `id` → 「打开 ↗」→ `sidebarRight.openTab('inbox-vault', { params: { id } })`，dock 只显示那一条，新增 `test/card.test.ts` 3 条）；**浅色模式修好**——根因是面板根硬编码 `color-scheme: dark`，浅色 app 里 `Canvas` 解析成 `rgb(18,18,18)` 而文字色继承宿主的暗色（镜像页实测对比度 **1.10**），改成读宿主 `<html>` 的 `color-scheme`（实测 dsh 的主题服务就写在那儿）、读不到再按继承文字色亮度判（阈值 140 有单测钉着），观察者只盯 `html`/`body` 属性 + `prefers-color-scheme` 监听；选中条改 `#6e9ef7`、搜索结果行带图片标记、`inbox_get` 加 `withImage` 看图例外（AGENTS 第 4 条与手册同步改写）。新增知识文档 **`panel-theme.md`**，`ui-visual-check.md` 补配色镜像页与"探针必须先挂载再量"（detached 元素 `color` 为空串）这个坑 |
| 2026-09-20 | `4bdca64` | **M8 开工（第三十三步）**：新增 `src/cli.ts` → `lib/cli.js`（`bin: dsh-inbox`，`npx @duoyu/dsh-inbox init`），一条命令做三件事且可重复运行：① `dsh plugin add` 装进 profile；② **复制** dsh 自带的 `standard` preset 到 `<DSH_HOME>/.agent-presets/<id>/`（改 `preset.yml` 的 name/description、**追加**插件行，绝不改随附原件）——AGENTS 第 2 条"工具必须挂进 preset"的自动化；③ 在 `settings.yaml` 写 `agent-presets.default`（**先备份、值没变就不写**）。`package.json` 可发布（`private:false`/`0.1.0`/`bin`/`files`），README 中英「安装/卸载/开发」按一条命令重写。真机走通（含幂等）；**剩**：新会话里让模型真调到工具。同时按用户意见清掉手册里的行话（「墓碑」改成大白话）、Codex/skill/M8/`init` 字样，`manual.test.ts` 升级为"出现 M8/init 也算失败"。另记：**助手把"我的收件箱"对上仓库靠的是工具描述**（`inbox_search` 的描述写明"the user's local dsh-inbox vault"与"whenever they ask what they saved"） |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条，**从上到下：新 → 旧**。
