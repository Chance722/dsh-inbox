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
| 面板的中英双语 | `panel-i18n.md` | 接官方 `ctx.locale`（不是自造开关）、服务缺席时的 `<html lang>` 退路、哪一层文本归谁、为什么"句内碎片"要整句成 key |
| README 图片资产（封面与截图） | `readme-assets.md` | 封面没有源文件：量出来的字体/字距/几何，改名时怎么只改徽章那一小块 |

## 维护记录

| 时间 | 维护时 HEAD | 变更摘要 |
|---|---|---|
| 2026-09-21 | `_待填_` | **M9 第二步：S3 拉取认错自己的树 + 提示改报记录数**——用户点刷新看到「远端列出 78 项…自己的同步对象 0 项」＋「还发现另一套同步前缀 sync、inbox/sync」，并问目录设置为什么说不一致、78 项里是不是混了描述文件。真因：`pullDropFolder` 的 S3 分支把 `settings.directory.replace(/^\//,'')` **既当列举前缀又当自己的同步根** ⇒ 目录是 `/` 时前缀成空串（**列了整个桶**，把旧版写在根目录的遗留 `sync/` 也扫进来），自己的根又是 `''`/`inbox` 而非 `inbox/sync` ⇒ **每个自己的对象都被判成别人的前缀**（所以“自己的 0 项”，且警告里那两套前缀有一套就是本机的）。WebDAV 分支一直是对的。修法：S3 同一规则——列举 `<目录>/`、自己的根 `syncRootFor(目录)`，`run.ts` 把原始 `settings.directory` 传给 `pullS3`。提示：`PullResult` 加 `remoteRecords`/`remoteAttachments`（在已经走过的那次列表里数，零额外请求），拉取行改成「云端有 N 条记录 / M 个附件（远端共列出 K 个对象）」，`messages.ts` 中英两份与 `describePull` 同步。**新增 2 条测试**（WebDAV 分类计数；S3 断言列举 `prefix=inbox%2F` 且自己的根是 `inbox/sync`），并**验证过把修复改回旧写法时后者立刻失败**。真机（用户自己的桶，走面板 pull 接口）：修前 `listed 78 / skippedSync 0 / skippedForeign 76` → 修后 **`listed 24 / skippedSync 23 / skippedOlder 1 / skippedForeign 0 / remoteRecords 7 / remoteAttachments 3`**，警告消失。知识进 `docs/help/sync.md`（目录三种写法同一含义、数字含义、根目录遗留 `sync/` 可自行删除） |
| 2026-09-20 | `67831c8` | **M9 第一步：面板跟随 dsh 的语言（中英双语）+ init 自己挑 profile**——`src/client/messages.ts`（zh/en 同键集）+ `src/client/i18n.ts`：优先接官方 `ctx.locale`（`register` 非类型化重载 + `bind`），组合里没有该服务时退到读 `<html lang>`/`navigator`，面板/dock/卡片三棵树各自 `useLocaleRevision()` 订阅；**句内碎片全部收成"整句 key + 参数"**（`detail.titleMissed`、`settings.dirS3.*` 这类），`manual.tsx` 整页也词典化，两处类目/来源列表改用面板自己的 `categoryLabel()`/`sourceLabel()`（宿主那份中文常量仍归模型与云端可读文件）。`test/i18n.test.ts` 钉住三件事：两词典键集一致、占位符一致、**客户端里零中文字面量**（不再有例外）；`test/manual.test.ts` 改成读词典断言；断言中文句子的测试用 `test/helpers/locale.ts` 显式钉语言（否则跟着跑测试那台机器的 locale 走）。**init**：不给 `--profile` 时自动挑（优先 `web`，其次唯一那个，一个都没有时配 `--create-profile` 建 `web`，多个没 web 就报错列出），抽成 `chooseProfile`/`listProfiles`；顺带修掉入口守卫的软链 bug（`import.meta.url` 是真实路径而 argv[1] 是软链路径 ⇒ 通过 pnpm junction 调用会**静默退出 0**，改成先 `realpathSync` 再比）。版本 → `0.2.0`。知识：`panel-i18n.md`（新增）、`readme-assets.md`、`dsh-plugin-platform.md`（locale 一节）、`dev-setup.md`（路径换成占位）。**未完成**：宿主侧 wire 句子（自检结论/同步与错误消息）仍是中文、安装器输出仍是中文，两条都写在 `panel-i18n.md` 末尾 |
| 2026-09-20 | `712b6f4` | **M8 第九步：包名换成 `@chance722/dsh-inbox`**——用户的 npm 用户名是 `chance722`，当时用的那个 scope 不是他的（只读核对：那个 scope 下无公开包、也没有发布过同名包；scope 归属只能账号本人确认），于是改成**用户名 scope**（自动归本人，不必建组织）。改动落在 `package.json` / `cordis.patch.yml` / `src/cli.ts` / `src/shared/constants.ts`（也决定 dock tab id）/ `test/cli.test.ts` / README 中英 / `AGENTS.md` / `dev-setup.md` / `product-decisions.md`；**更早的条目里包名用 `<旧包名>` 指代**（当时的事实）。**顺手修掉"改名必踩"的坑**：`init` 原来按**包名**判断 preset 里有没有自己那行 ⇒ 改名后旧名还在 ⇒ 判成"没有" ⇒ **追加第二行**（指向解析不到的包，会让 preset 挂载失败）；现在**按 id 认行并改写名字**，抽成纯函数 `ensurePresetRow()`（added/unchanged/renamed），`test/cli.test.ts` +4 条（含"改完仍只有一行"与引号风格容忍）。真机：两个 profile 的依赖与 bundles 已换名、旧 junction 清掉；`init` 对 inbox 报"把 preset 里那行的来源改成 @chance722/..."、对 web 报"跳过"；preset 只有一行新名；服务重启后首页 200、客户端产物是 `@chance722/dsh-inbox/client.js`、`/api/inbox/list` 仍 7 条；`--dump-config` 出现 `# == @chance722/dsh-inbox`。**发布前记得**：`npx @chance722/dsh-inbox init`、`dsh plugin ... remove @chance722/dsh-inbox` |
| 2026-09-20 | `9937dd7` | **M8 第八步：一条命令对全新机器也成立**——实测全新机器上 `npx <当时的包名> init` 直接退出码 1（dsh 的 `web` 模板里没有 `inbox` profile），与 README 的"一条命令装好"不符。新增 **`init --create-profile`**：profile 不存在时用 `dsh --profile <名字> --from-default-profile web --dump-config` 建一个再继续；**默认不开**（profile 名打错应该是报错，不是凭空造 profile），报错里也把这条路写在提示中；顺手把 `--dump-config` 的整棵树从输出里捕获掉（成功只报一行，失败才打原文）。`package.json` 加 `"prepublishOnly": "pnpm build"`（不再可能发出过期的 `lib/`）。新增 **`test/cli.test.ts`** 5 条（默认值/全部选项/`--create-profile` 开关/`--help`/拒绝未知选项·缺值·不合规 preset id），为此给 `src/cli.ts` 加了"只在作为程序运行时才执行 main"的守卫——否则单测一 import 就会真去改 `~/.dsh`。真机在 `inbox-fresh`/`inbox-fresh2` 两个全新 profile 上各跑通一次，临时 profile 已删。README 中英安装段改成 A/B 两种走法 |
| 2026-09-20 | `386e979` | **M8 第七步：深链真的会定位到那一条**——用户报「从对话里拿到的内容没有可点进 Inbox 详情的入口」。现场（内置浏览器打开 3102 真机）复核：**卡片与「打开 ↗」都在**，只是 dsh 默认把一轮里的多次调用折叠成一行「N 次工具调用」（用户读的是助手的回答，回答本身是纯文本）；**同时逮到真 bug**：点下去 dock 停在**列表**上。根因：`sidebar.right.pane.tab` 的 body props 是**会话 slot share**（实测键 `usePanelInfo…useTabInfo`），**没有** `hooks.tabInfo`（那只是 `SlotMap` 里 `hookContext` 的工厂名）⇒ `params?.id` 恒为 `undefined` ⇒ 组件自己的"没参数就显示列表"兜底**静默**生效。修法：读 `props.useTabInfo()`（保留旧形状兜底）+ 把解析抽成纯函数 `dockFocusOf()`，新增 `test/dock.test.ts` 4 条。**真机验收**：展开「3 次工具调用」→ 点「打开 ↗」→ 右侧「仓库」停在那条（标题/类目/待看/时间/可点链接/「返回最近」），修复前同一操作只有列表。入口可见性：查过 `ui-conversation` 产物，**没有**"默认展开工具调用"的偏好项 ⇒ 写进使用手册第 6 节新增的「点开看」与 README 中英。平台事实（tab 体 props 形状与 `useTabInfo`、keyed `tool.call.toolview` 替换普通行、一轮多次调用默认折叠）进 `docs/help/dsh-plugin-platform.md` |
| 2026-09-20 | `a688826` | **规则泄漏修掉**：用户发现自己在“用收件箱”的 dsh 会话里被助手附上了本仓库 AGENTS.md 的「本次参考 docs」声明——真因是 `@deepseek-ai/dsh-agent-instructions`（`dsh-base` 默认启用，65536 字节预算）会把从项目根到会话工作目录的 `AGENTS.md`/`CLAUDE.md` 注入**每个**在该目录开的会话，而原规则只写了“任务执行类 / 纯闲聊”，没界定“**使用**插件”这一档 ⇒ 模型两难。AGENTS.md 那条改成「只在动过本仓库的回合（改代码/排查/维护文档/提交）声明，只是用插件一个字都别写」，并已用真会话复验（模型推理里直接写“just using the plugin — no declaration needed”，回复不再带声明块）。平台事实写进 `docs/help/dsh-plugin-platform.md`（含三条“彻底不注入”的路子） |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条，**从上到下：新 → 旧**。
