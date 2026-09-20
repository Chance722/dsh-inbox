# 知识文档索引

> AGENTS.md 只记「主题 → 路径」，正文一律在本目录。新增/改名/归档必须同步更新本表。

| 主题 | 路径 | 一句话 |
|---|---|---|
| dsh 插件平台实测事实 | `dsh-plugin-platform.md` | dsh 的扩展点、限制、安装机制，逐条带证据路径 |
| 已锁定的产品与架构决策 | `product-decisions.md` | 需求边界、隐私红线、分类与生命周期规则 |
| 本地开发与验收流程 | `dev-setup.md` | 建 profile、挂插件、起服务、headless 验证工具的命令 |
| 仓库数据模型 | `vault-data-model.md` | 域 spec、词汇表、记录结构、查询语义、软删 |
| 对象存储网关兼容性排查 | `remote-gateway-compat.md` | 401/403 的三种可能、客户端标识按凭证绑定、数据胶囊实测矩阵 |
| 面板 UI 的视觉/几何验证 | `ui-visual-check.md` | 真机 token 拿不到时，用 headless Chrome 量列宽与"能否放一行" |

## 维护记录

| 时间 | 维护时 HEAD | 变更摘要 |
|---|---|---|
| 2026-09-19 | `2982c36` | M7 第十三步：选中态去掉左侧强调条；紧凑行改成一行（图标 34px，图标/标题/元信息/待看胶囊四心对齐）；详情表单去掉三个 label、控件占满 354px、动作文案改「保存以上」且三等分占满；时间戳改为绝对定位在**详情卡片内**距下沿 16px；模式按钮图标居中；`待看` 改成标题旁的 `#6e9ef7` 高亮胶囊；基线表更正"内容宽 354（不是 356）" |
| 2026-09-19 | `9f50b5e` | M7 第十四步：新建 `src/client/heading.ts`（密钥记录叫「密钥 / 账密（描述）」，描述截 24 字符 + 省略号；列表与 dock 共用，顺手堵掉 dock 用 `preview` 泄密文的老路）；详情列改成有界滚动列（内容是滚动口、留白用 margin、每行 `flex: none`，否则正文框会被压成 0）；AGENTS.md 第 3 条补一句说明描述可以露 |
| 2026-09-19 | `0efd4df` | M7 第十五步：两列卡片一律 94px、图标 38px、预览位变成自己的按钮（点它开灯箱、不选中记录；卡片改 `div[role=button]`）；`thumbnailId` → `previewId` + `previewMime`（宿主挑"能渲染的第一个附件"，媒体链接给播放瓦片并在浏览器里播）；附件路由服务 video/audio + 支持 `Range`，并改为**白名单 + nosniff**（堵掉同源 svg 注入面，AGENTS.md 安全节新增这条规则）；`WireFile.mediaType` 让面板粘的文件带上真实类型（只保留 video/audio） |
| 2026-09-20 | `618820b` | M7 第十六步：判定来源 `· 规则/你/模型` → 带色胶囊 **规则判定（灰）/ 模型判定（紫）/ 手动判定（蓝）**（`CATEGORY_SOURCE_LABELS` + `CATEGORY_SOURCE_HINTS`；不用「自判定」是因为 `自` 会被读成 `自动`）；新增 `CONTROL_HEIGHT = calc(1.6em + 12px)`，搜索框 / 模式组 / 刷新 / 窄屏「筛选」一律 34.39px 且模式图标居中，`buttonStyle` 统一改成 flex 行；列表标题跟着筛选走（`listTitle`，含「回收站 · #标签」）；**再次粘进回收站里的东西会被取回**（`CaptureOutcome.restored`，面板与 `/inbox` 改说「从回收站取回 N 条」）；toast 移到视口正中 + `pointer-events: none`；`ui-visual-check.md` 补本轮基线与镜像页的列表标题行 |
| 2026-09-20 | `3edceaa` | M7 第十七步：上传的照片/文件不再叫「（无标题）」——`EntrySummary` 新增 `attachmentName`（宿主挑预览图所属附件，否则第一个有文件名的），名字链加一环 `标题 → 链接 → 正文 → 文件名 → （无标题）`，无名记录沿用「名字（描述）」形状（描述第一次出现在列表里）；详情新增**名称**字段写 `title`，`Vault.patch` 把空串当"没有"（否则空串会赢 `??` 链、行变空白）；`MAX_TITLE_CHARS` 挪进 `shared/panel-wire.ts`；`dev-setup.md` 同步改成当前机器的路径与命令（`C:\nvm4w\nodejs`、全局 dsh、profile 挂载机制、base-bundles 那个坑） |
| 2026-09-20 | `be7fb82` | M7 第十八步：**密钥/账密记录的改名也生效了**——`heading.ts` 的密钥分支原来写死「密钥 / 账密（描述）」、从不读 `title`（M3/M4 那条规则的遗留），现在括号里**优先名字、没名字才用描述**，前缀保留；AGENTS.md 第 3 条补一条不变式：**`title` 只能由用户填**，规则/模型/抓标题等自动路径都不许写它（那是"列表把密文当标题"老漏洞的成因） |
| 2026-09-20 | `d917790` | M7 第十九步：**图标按类目**（`kindGlyph` 删除，`categoryGlyph(category,size)` 一处函数供 rail 与卡片共用，账密=钥匙）；**名字直接外显**（去掉「密钥 / 账密（…）」，取名顺序 = 用户名 → 抓来的标题 → 链接/正文/文件名 → 备注，备注退到 hover tooltip，「描述」UI 文案改「备注」）；**新增抓链接标题**：`src/host/link-title.ts` 走 `ctx.web` 读 `<title>` 存进新字段 `linkTitle`（域 **v4**，`compatibleVersions:[1,2,3]`），0 token、入库后异步、只对本机捕获的 link、只对还没有名字的记录；这是插件第一个自己发起的对外请求，隐私与安全条款同时落到 `product-decisions.md` 与 AGENTS.md；`vault-data-model.md` 顺手补齐域 v2–v4 演进并删掉过期的 `status` 行 |
| 2026-09-20 | `7b2b3a3` | M7 第二十步：**抓不到标题要说清楚**——微信对匿名请求只回「环境异常」拦截页（HTTP 200 + 空 `<title>`），于是 `titleFromHtml` 补 `og:title`/`twitter:title` 退路，失败原因记进新字段 `linkTitleError`（域 **v5**）由详情显示；日志只记 host 不记整条 URL（写进 AGENTS.md）。**列表空白**的真凶是"面板还站在刚清空的回收站上"：实测 160 次 list 全部一致排除服务端，改为入库后自动离开回收站、延迟刷新走 `refreshRef`（避免陈旧闭包写回旧货架）、list 响应形状校验（畸形响应不再白屏） |

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条。
