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
| 2026-09-19 | `d255cef` | M7 第十二步（第九~十一步未单独记锚点，其变更也落在上一行到本次之间）：列表只留两种密度（`rows` 下线、默认 `grid`、旧值回落）、详情列加宽到 320–380 让三个动作按钮排一行、时间戳绝对定位到面板底部、图片附件去框居中、分页按钮居中、窄屏阈值 900→960；新增 `docs/help/ui-visual-check.md`（headless Chrome 量几何）；README 中英把"未读/状态"改回代码里的"待看" |
| 2026-09-19 | `2982c36` | M7 第十三步：选中态去掉左侧强调条；紧凑行改成一行（图标 34px，图标/标题/元信息/待看胶囊四心对齐）；详情表单去掉三个 label、控件占满 354px、动作文案改「保存以上」且三等分占满；时间戳改为绝对定位在**详情卡片内**距下沿 16px；模式按钮图标居中；`待看` 改成标题旁的 `#6e9ef7` 高亮胶囊；基线表更正"内容宽 354（不是 356）" |
| 2026-09-19 | `9f50b5e` | M7 第十四步：新建 `src/client/heading.ts`（密钥记录叫「密钥 / 账密（描述）」，描述截 24 字符 + 省略号；列表与 dock 共用，顺手堵掉 dock 用 `preview` 泄密文的老路）；详情列改成有界滚动列（内容是滚动口、留白用 margin、每行 `flex: none`，否则正文框会被压成 0）；AGENTS.md 第 3 条补一句说明描述可以露 |
| 2026-09-19 | `0efd4df` | M7 第十五步：两列卡片一律 94px、图标 38px、预览位变成自己的按钮（点它开灯箱、不选中记录；卡片改 `div[role=button]`）；`thumbnailId` → `previewId` + `previewMime`（宿主挑"能渲染的第一个附件"，媒体链接给播放瓦片并在浏览器里播）；附件路由服务 video/audio + 支持 `Range`，并改为**白名单 + nosniff**（堵掉同源 svg 注入面，AGENTS.md 安全节新增这条规则）；`WireFile.mediaType` 让面板粘的文件带上真实类型（只保留 video/audio） |
| 2026-09-20 | `618820b` | M7 第十六步：判定来源 `· 规则/你/模型` → 带色胶囊 **规则判定（灰）/ 模型判定（紫）/ 手动判定（蓝）**（`CATEGORY_SOURCE_LABELS` + `CATEGORY_SOURCE_HINTS`；不用「自判定」是因为 `自` 会被读成 `自动`）；新增 `CONTROL_HEIGHT = calc(1.6em + 12px)`，搜索框 / 模式组 / 刷新 / 窄屏「筛选」一律 34.39px 且模式图标居中，`buttonStyle` 统一改成 flex 行；列表标题跟着筛选走（`listTitle`，含「回收站 · #标签」）；**再次粘进回收站里的东西会被取回**（`CaptureOutcome.restored`，面板与 `/inbox` 改说「从回收站取回 N 条」）；toast 移到视口正中 + `pointer-events: none`；`ui-visual-check.md` 补本轮基线与镜像页的列表标题行 |

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条。
