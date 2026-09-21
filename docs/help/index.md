# 知识文档索引

> AGENTS.md 只记「主题 → 路径」，正文一律在本目录。新增/改名/归档必须同步更新本表。

| 主题 | 路径 | 一句话 |
|---|---|---|
| dsh 插件平台实测事实 | `dsh-plugin-platform.md` | dsh 的扩展点、限制、安装机制，逐条带证据路径 |
| 已锁定的产品与架构决策 | `product-decisions.md` | 需求边界、隐私红线、分类与生命周期规则 |
| 本地开发与验收流程 | `dev-setup.md` | 建 profile、挂插件、起服务、headless 验证工具的命令 |
| 抓链接标题（外发请求） | `link-title-fetch.md` | 一次 GET 的自述身份、站点拒绝的两种长相（空壳页 / 假标题）、实测矩阵与复查命令 |
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
| 2026-09-21 | `d94d30b` | **排查：bilibili 链接的标题变成「验证码」**——用户问"外显标题显示验证码，是不是抓取需要登录态"。实测（同机器同出口、同 URL，各 8 次）：harness 默认 UA 5/8 回验证码页、`dev-setup.md` 那条 `Mozilla/5.0 (compatible; …)` **8/8 被拒**、Chrome 形状 0/8、`curl/8.4.0` 5/8；真页面 169KB 带视频名，`api.bilibili.com/x/web-interface/view` 对每种身份都 5/5 命中 ⇒ **与登录态无关**（我们一个 cookie 都不发，验证码页自己下发 `buvid3`/`v_voucher`），是"客户端身份 + 概率"的风控。新文档 `link-title-fetch.md` 记下站点拒绝的两种长相（微信式空壳页 → 判 miss；bilibili 式拒绝页**带标题** → 三道判据全过、被当成名字存进 `linkTitle`）、复查命令与四条候选修法；`dev-setup.md` 补一句"那条 UA 不是通用解"。现状：那条记录（`9cc7594f`）用户自己填了 `title`，列表按 `title` 显示所以看不见验证码，但 `linkTitle` 仍是脏值并随模型搜索负载送出去（`tools.ts:235`）；面板没有清 `linkTitle` 的入口，重贴也不会重抓（已有名字即跳过） |
| 2026-09-21 | `2054fdf` | **M9 第十步：`@latest` 被"太新"策略静默降级；0.2.6 不需要发**——用户问"这些改动要不要发 0.2.6"、"我装的是 0.2.5 为什么 `dev:status` 说 0.2.4"。① **不需要发版**：`git log 8cda385..HEAD --name-only -- src package.json cordis.patch.yml` **为空**（0.2.5 bump 之后能进包的一行都没改，只改了 `scripts/dev.mjs` 与文档）。② **他装的确实是 0.2.4**：那次 `dev:npm` 在 0.2.5 发布之前；而且即使发布后重跑，`pnpm add <包名>@latest` **依然装回 0.2.4**——pnpm 的 `minimumReleaseAge` 对刚发布的版本**静默降级**（profile 的 `pnpm-workspace.yaml` 里 `minimumReleaseAgeExclude` 只有 0.2.4），显式 `@0.2.5` 才装并追加白名单。③ 修法：`dev:npm` 先 `npm view <包名> version` 取真实 latest，再装**确切版本**；`dev:status` 同时报**范围与实际版本**（`线上包（^0.2.5），装的是 v0.2.5`）。真机：`web` profile 现在 = 线上包 0.2.5。两个 pnpm 行为写进 `dev-setup.md` |
| 2026-09-21 | `78fbdb7` | **M9 第九步：`dev:npm` 之前其实没生效**——用户报 `dev:local`／`dev:npm` 后 `dev:status` 都显示"本仓库"。两个 pnpm 行为叠加：① 依赖是 `link:` 且目标目录的包名相同 ⇒ `pnpm add <包名>` 认为名字已有解析结果，回 `Already up to date` 什么都不做（**全新 profile 上测不出来**，所以上一轮的临时 profile 验证是绿的）；② 加 `@latest` 强制换时，profile 的 **hoisted** 链接器会让 pnpm 去**仓库的** `.pnpm` 建符号链接 ⇒ Windows `ERR_PNPM_EPERM`，而且失败发生在 `remove` 之后 ⇒ **依赖行没了、链接还留着**（危险中间态）。修法（`scripts/dev.mjs`）：`dev:npm` = `dsh plugin remove` → `lstat().isSymbolicLink()` 时 `rmdirSync` 摘掉那个链接（只删链接、不碰仓库）→ `dsh plugin add <包名>@latest`；`dev:local` 不需要这套。**真机验收**（用户 `web` profile）：`dev:npm` → 依赖 `^0.2.4`、node_modules 是实体目录（0.2.4）；`dev:local` → `link:D:/Workspace/dsh-inbox` + Junction；`dsh.profile.bundles` 三行完好；测试中间态已恢复，profile 停在"本仓库"。两个 pnpm 行为写进 `dev-setup.md` |
| 2026-09-21 | `8cda385` | **M9 第八步：在“线上版”与“本地版”之间一键切换；0.2.5**——新增 `scripts/dev.mjs` + 三条 npm script（dev-only，`files` 里没有它，不进发布包）：`pnpm dev:status` 读 profile 依赖直接说现在是 `本仓库（…）` 还是 `线上包（^0.2.x）`；`pnpm dev:npm` = `dsh plugin add @chance722/dsh-inbox`（装线上版）；`pnpm dev:local` **先 `pnpm build` 再链接本仓库**（顺序刻意：profile 是 junction，忘了构建就还在跑旧产物）。`DSH_PROFILE` 换 profile（默认 `web`）。**实测**：临时 profile 上 `dev:npm` → `线上包（^0.2.4）`、`dev:local` → `本仓库（D:/Workspace/dsh-inbox）`，用完删除临时 profile。顺带记下 pnpm 的 `minimumReleaseAge` 会把刚发布的版本写进 profile 的 `pnpm-workspace.yaml` 白名单（实测装 0.2.4 时自动加一行）⇒ **发布完立刻就能装**。README 中英「开发」一节与 `dev-setup.md` 补这三条命令；版本 0.2.4 → **0.2.5** |
| 2026-09-21 | `6a68e1d` | **M9 第七步：滚动条、手册高度、同步文案、0.2.4**——① 列表/详情/手册内容区的滚动条统一 **8px**：inline style 表达不了伪元素，所以在面板根渲染一段只作用于 `dsh-inbox-scroll` 的 `<style>`；**踩到真陷阱**——Chromium 一旦看到标准属性 `scrollbar-width` 就**忽略** `::-webkit-scrollbar`（实测同时写仍是 10px），改成 `@supports not selector(::-webkit-scrollbar)` 分流：Chromium/Safari 用 webkit 8px、Firefox 用标准 `thin`；真机量得两处都是 `offsetWidth - clientWidth = 8`。② 手册弹窗 `92vh → 80vh`（真机量得卡片 = 视口 0.80，内容区仍自滚），面板不再被整块盖住。③ 手册第 5 节重排为 自动/手动/**合并**（原「冲突」并入）/**两台机器**/**上云什么**（"只有账密正文是密文"从冲突行拆出）/删除；README 中英在「云端长什么样」后加 4 条「同步怎么走」，功能表「双向同步」行补齐目录规则。④ `package.json` → **0.2.4**（随后又提到 **0.2.5**）。**同一轮的收尾**：用户问「更旧是什么含义」（= 上次拉取已经收过那份文件），改词后又要求**干脆不显示跳过明细** ⇒ tooltip 现在只说「推送 0 条（没有新改动） · 拉取 N 条 · 云端 X 条记录 / Y 个附件」＋警告，跳过计数仍留在 `PullResult` 里供排查。同时修掉两个"数字对不上"：合并 19 条里**13 条其实是墓碑**（tooltip 新增「其中 N 条是删除，会进回收站」，即 `MergeOutcome.deletions`/`PullResult.deletions`；用户原有 7 条**一条都没被删**，已按 id 核对），以及空闲推送那行**不再报条数**（它数的是含回收站的全部行 26，而面板头部是 13） |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条，**从上到下：新 → 旧**。
