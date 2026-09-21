# 知识文档索引

> AGENTS.md 只记「主题 → 路径」，正文一律在本目录。新增/改名/归档必须同步更新本表。

| 主题 | 路径 | 一句话 |
|---|---|---|
| dsh 插件平台实测事实 | `dsh-plugin-platform.md` | dsh 的扩展点、限制、安装机制，逐条带证据路径 |
| 已锁定的产品与架构决策 | `product-decisions.md` | 需求边界、隐私红线、分类与生命周期规则 |
| 本地开发与验收流程 | `dev-setup.md` | 建 profile、挂插件、起服务、headless 验证工具的命令 |
| 抓链接标题（外发请求） | `link-title-fetch.md` | 一次 GET 的自述身份、站点拒绝的两种长相（空壳页 / 假标题）、实测矩阵与复查命令 |
| 链接分类与平台标签 | `link-classification.md` | 平台表（62 个主机后缀）、路径优先 / 宿主习惯的判序、加一个新平台的步骤 |
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
| 2026-09-21 | `96eed94` | **M9.14 README 安装/更新压成命令块**——用户："README 太啰嗦，面向用户就直接写清楚安装命令和更新命令"。上一轮加的「更新」整节折进安装块（一条命令配一条注释：安装 / 全新机器 / 更新；"init 重复跑不会升级""刚发布时写确切版本"落成注释），平台说明与"init 做三件事"等段落合并，隐私里那条抓取身份收短。中英各 **-45/+21**、**-44/+21** 行，安装区 45 → 22 行，两份对称。只改 Markdown |
| 2026-09-21 | `75de827` | **M9.13 「更新」原来没有路径**——用户问"本地更新线上版本是不是跑 init 就行"，他只看到 `Already up to date`。答案：`init` 转发 `dsh plugin add <包名>`，profile 里的**版本范围**已被满足 ⇒ pnpm 什么都不做（同一个 pnpm 行为，这次撞在用户侧）。README 中英加「更新 / Update」一节（`@latest` 装、刚发布时要写确切版本、装完重启、**用 `inbox_status` 回显的 `dsh-inbox vX.Y.Z` 确认**），`init` 收尾提示加一行，dev-setup 第 5 条记下。顺带拉 registry 上 0.2.6 的 tarball 核对：平台表 / `refused-page` / 新 UA 都在 ⇒ **不需要 0.2.7**；用户 profile 依赖已是 `0.2.6` |
| 2026-09-21 | `69dd6b7` | **M9.12 平台映射扩到 62 个主机；重贴可补标签**——用户报"掘金链接不显示平台、公众号显示 wechat"。查证：`src/host/classify/rules.ts` 原表只有 12 条（掘金确实缺；知乎/YouTube 有平台标签但没有宿主兜底，`v.qq.com/x/cover/abc.html` 这类照样落"其它"）。改法：表加第三列"宿主主要是什么"，判序变 **路径 → 宿主习惯 → unsure（可能一次模型调用）→ 不认识**；扩到视频/音频 21 + 文章/帖子 34 + 代码/包 6（后者故意留空给模型）。顺手修两个坑：`/a/`、`/p/` 这类单字母路径段把 `github.com/a/b` 判成文章（收窄到整词）；`absorb()` 合并重复项只补 note/title、不补 platform ⇒ 老记录重贴也长不出标签，改成"只补空、不覆盖"。新文档 `link-classification.md`（完整平台表 + 加平台四步），README 中英功能表补站点示例。无 schema 变更。304 测试全绿 + tsc + build |
| 2026-09-21 | `738999a` | **M9.11 抓取身份与拒绝页**——用户拍板两件事：① **UA 换成"浏览器形状 + 自报家门"**：站点按 UA **形状**认客户端——`Mozilla/5.0 (compatible; …)` 被 bilibili 拒 20/29、harness 默认 1/6~7/10、浏览器形状 0/36（换成 mac/linux 的 OS 段、或带 `dsh-inbox/0.3` 版本号都 5/5 通过；**加 `(+url)` 括号就 5/5 掉桶**，所以不带），于是本包 `cordis.patch.yml` 覆盖 `web-fetch-http.userAgent` 为 `… (KHTML, like Gecko) dsh-inbox Safari/537.36`（该行由 `dsh-base.cordis.patch.yml:447` 声明；bundle patch 在它之后、用户 profile patch 之前，逐行"最后写入者胜"，用户永远能改回去）。② **拒绝页不取名、名字位退回原文**：bilibili 那种 200 + 真标题（「验证码_哔哩哔哩」）的壳页此前能过掉全部判据被存成名字 ⇒ 新增 `looksLikeRefusal`（**前提是"几乎没有正文"**，再看挑战标记或标题像不像拒绝——第一版把标记写成"一票否决"，当场误伤 `BV1ToGC6TEjH` 的真页面：bilibili 每页都带 `risk-captcha-sdk`/`_BiliGreyResult`/`geetest`）判到就写 `linkTitleError: refused-page`，界面照旧用 URL/文件名兜底；面板里那行「没抓到页面标题：…。可以自己起个名字。」**删掉**（用户要的是显示原文：链接就显示链接），`titleMissReason` 与 `link.*` 文案一并移除，host 侧代码保留供排查。**真机**：用户两个 profile 的 `cordis.patch.yml` 都写上了同一条 UA（`web` 跑 npm 0.2.5、自带 patch 还没这条；`inbox` 原先那条 compat UA 实测最差），各留 `.bak-<ts>` 备份。验证：300 测试全绿 + tsc + 构建；`~/.Codex/scripts/check-ts.sh` 这台机器上不存在、eslint 也不是本仓库依赖，故按等价项跑；版本 **0.2.5 → 0.2.6**（发布由用户自己走）|
| 2026-09-21 | `d94d30b` | **排查：bilibili 链接的标题变成「验证码」**——用户问"外显标题显示验证码，是不是抓取需要登录态"。实测（同机器同出口、同 URL，各 8 次）：harness 默认 UA 5/8 回验证码页、`dev-setup.md` 那条 `Mozilla/5.0 (compatible; …)` **8/8 被拒**、Chrome 形状 0/8、`curl/8.4.0` 5/8；真页面 169KB 带视频名，`api.bilibili.com/x/web-interface/view` 对每种身份都 5/5 命中 ⇒ **与登录态无关**（我们一个 cookie 都不发，验证码页自己下发 `buvid3`/`v_voucher`），是"客户端身份 + 概率"的风控。新文档 `link-title-fetch.md` 记下站点拒绝的两种长相（微信式空壳页 → 判 miss；bilibili 式拒绝页**带标题** → 三道判据全过、被当成名字存进 `linkTitle`）、复查命令与四条候选修法（补测：浏览器形状且**自报家门**的 UA 对 bilibili 15/15、微信 3/3 放行，`(compatible; …)` 与 harness 默认都进被拒桶 ⇒ 过闸看的是 UA 的**产品位**，不必冒充 Chrome）；`dev-setup.md` 补一句"那条 UA 不是通用解"。现状：那条记录（`9cc7594f`）用户自己填了 `title`，列表按 `title` 显示所以看不见验证码，但 `linkTitle` 仍是脏值并随模型搜索负载送出去（`tools.ts:235`）；面板没有清 `linkTitle` 的入口，重贴也不会重抓（已有名字即跳过） |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条，**从上到下：新 → 旧**。
