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
| 2026-09-21 | `_待填_` | **M9 第五步：细节进 tooltip + 找到"家里推的没过来"的真因**——① 面板里那行常驻小字删掉，完整细节挂到**「刷新」按钮的 tooltip**（中英文案压成 `推送 0 条（7 条已是最新） · 拉取 0 条 · 云端 7 条记录 / 3 个附件（跳过 24：自己的 23、更旧 1）`，末段仅在有跳过时出现），退役的 9 条长文案一并删除；② 用户问「远端 24 项里昨天家里推的为什么被跳过」——真机证明 `inbox/sync` 的 7 条全是**本机自己推的**（`kept: 7`），而**桶根 `sync/` 里另有 19 条**从未被读（最早那版把「目录=`/`」当桶根写的）。修完"列整个桶"后这类别的树彻底不可见，于是补**有界探测**：S3 `delimiter=/` 一次性拿桶根目录（≤5 个候选），每个候选查 `<目录>/sync/items/`→退查 `<目录>/items/`（`max-keys=1000`，一次列举同时回答"是不是同步树"和"多少条记录"），结果进 `foreignSyncRoots` + `foreignRecords`。toast 只留短警告「⚠️ 另有 19 条记录在别的同步目录：sync」，tooltip 写全（含"本机 inbox/sync"）。使用手册第 5 节加「两台机器」一条；`docs/help/sync.md` 写清探测表与**三条搬过来的办法**（改目录后全量重推 / 云盘里挪到 `inbox/sync/` / 让插件加一次性迁移入口） |
| 2026-09-21 | `188a21b` | **M9 第四步：toast 瘦身**——用户指出上一轮那行太长且 toast 转瞬即逝。toast 现在只说结果：`已是最新 · 本页 7 条` 或 `推送 N 条 · 拉取 M 条`（拉取数＝投放目录新入库＋云端合并）；只有**两条例外留在 toast**（别的机器目录不一致的警告、失败计数与原因，因为它们要人行动），并把那条警告缩短为「⚠️ 另一套同步目录：{roots}（本机 {ours}）」。完整诊断移到**面板里一行常驻小字**「上次同步：…」（单行、省略号截断、hover 看全文），保留到下次刷新。实现：新增 `writtenBy()`/`arrivedFrom()`/`syncWarnings()` 纯函数决定"两个数字"与"要不要警告"，`describePush()`/`describePull()` 退居为长文本。真机（内置浏览器点「刷新」）：toast「已是最新 · 本页 7 条」＋工具栏下方一行小字（截图确认） |
| 2026-09-21 | `ae68aa0` | **M9 第三步：默认目录、换目录、以及"这条要不要拉"**——用户三问：① 不配目录的用户会不会踩 S3 那个坑（会，但与配不配目录无关，上一轮已修；两边都不配＝都 `inbox`）；② 存到别的目录能否拉到（能，`backup` ⇒ `backup/`+`backup/sync`，但两台机器必须同一个值，且**改目录＝搬家**、旧目录不会自动搬）；③ B 拉取时怎么判断某条要不要拉（**不看"是不是插件上传的"**，按记录粒度 `id`+`updatedAt`：严格更新才合并、相等即"两边一致"⇒ 自己推上去的回来不会覆盖自己；`sync/` 不当投放文件只是 drop-folder 那半边的规则）。实现：目录输入框的占位符改成「inbox（默认；留空或 / 都等于它）」（中英），两个协议分支都在右侧显示「别的设备往这里扔东西 · 同步根：{root}」；`kept`（云端有、本机已有）从 `withMerge` 一路带到 `PullResult` 与面板文案，渲染时各段用 ` · ` 连接（原来直接拼接）。真机：`merged: 0, kept: 7` ⇒ 面板说「云端的 7 条记录本机都有」。知识进 `docs/help/sync.md`（含三种结果表与改目录的注意事项） |
| 2026-09-21 | `0e5f898` | **M9 第二步：S3 拉取认错自己的树 + 提示改报记录数**——用户点刷新看到「远端列出 78 项…自己的同步对象 0 项」＋「还发现另一套同步前缀 sync、inbox/sync」，并问目录设置为什么说不一致、78 项里是不是混了描述文件。真因：`pullDropFolder` 的 S3 分支把 `settings.directory.replace(/^\//,'')` **既当列举前缀又当自己的同步根** ⇒ 目录是 `/` 时前缀成空串（**列了整个桶**，把旧版写在根目录的遗留 `sync/` 也扫进来），自己的根又是 `''`/`inbox` 而非 `inbox/sync` ⇒ **每个自己的对象都被判成别人的前缀**（所以“自己的 0 项”，且警告里那两套前缀有一套就是本机的）。WebDAV 分支一直是对的。修法：S3 同一规则——列举 `<目录>/`、自己的根 `syncRootFor(目录)`，`run.ts` 把原始 `settings.directory` 传给 `pullS3`。提示：`PullResult` 加 `remoteRecords`/`remoteAttachments`（在已经走过的那次列表里数，零额外请求），拉取行改成「云端有 N 条记录 / M 个附件（远端共列出 K 个对象）」，`messages.ts` 中英两份与 `describePull` 同步。**新增 2 条测试**（WebDAV 分类计数；S3 断言列举 `prefix=inbox%2F` 且自己的根是 `inbox/sync`），并**验证过把修复改回旧写法时后者立刻失败**。真机（用户自己的桶，走面板 pull 接口）：修前 `listed 78 / skippedSync 0 / skippedForeign 76` → 修后 **`listed 24 / skippedSync 23 / skippedOlder 1 / skippedForeign 0 / remoteRecords 7 / remoteAttachments 3`**，警告消失。知识进 `docs/help/sync.md`（目录三种写法同一含义、数字含义、根目录遗留 `sync/` 可自行删除） |
| 2026-09-20 | `67831c8` | **M9 第一步：面板跟随 dsh 的语言（中英双语）+ init 自己挑 profile**——`src/client/messages.ts`（zh/en 同键集）+ `src/client/i18n.ts`：优先接官方 `ctx.locale`（`register` 非类型化重载 + `bind`），组合里没有该服务时退到读 `<html lang>`/`navigator`，面板/dock/卡片三棵树各自 `useLocaleRevision()` 订阅；**句内碎片全部收成"整句 key + 参数"**（`detail.titleMissed`、`settings.dirS3.*` 这类），`manual.tsx` 整页也词典化，两处类目/来源列表改用面板自己的 `categoryLabel()`/`sourceLabel()`（宿主那份中文常量仍归模型与云端可读文件）。`test/i18n.test.ts` 钉住三件事：两词典键集一致、占位符一致、**客户端里零中文字面量**（不再有例外）；`test/manual.test.ts` 改成读词典断言；断言中文句子的测试用 `test/helpers/locale.ts` 显式钉语言（否则跟着跑测试那台机器的 locale 走）。**init**：不给 `--profile` 时自动挑（优先 `web`，其次唯一那个，一个都没有时配 `--create-profile` 建 `web`，多个没 web 就报错列出），抽成 `chooseProfile`/`listProfiles`；顺带修掉入口守卫的软链 bug（`import.meta.url` 是真实路径而 argv[1] 是软链路径 ⇒ 通过 pnpm junction 调用会**静默退出 0**，改成先 `realpathSync` 再比）。版本 → `0.2.0`。知识：`panel-i18n.md`（新增）、`readme-assets.md`、`dsh-plugin-platform.md`（locale 一节）、`dev-setup.md`（路径换成占位）。**未完成**：宿主侧 wire 句子（自检结论/同步与错误消息）仍是中文、安装器输出仍是中文，两条都写在 `panel-i18n.md` 末尾 |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条，**从上到下：新 → 旧**。
