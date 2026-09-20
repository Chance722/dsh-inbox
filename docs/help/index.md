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
| 2026-09-20 | `afd4594` | M7 第二十一步（**更正上一步的结论**）：微信那条的真因是 **User-Agent**——`dsh-web-fetch-http` 只发 `user-agent` + `accept`，默认自称 `deepseek-harness/…`，微信按 UA 认客户端只回空壳页；换成 `Mozilla/5.0 (compatible; dsh-inbox/0.1; +仓库地址)` 就拿到真文章（**真文章的 `<title>` 也是空的，标题只在 `og:title`**，所以上一步加的退路是关键）。UA 不是按请求可设的参数，只能改 profile 的 `cordis.patch.yml`（已写入 `profiles/inbox/` 并注明它影响该 profile 全部抓取、含模型 web 工具）；`dev-setup.md` 记下"抓不到先确认我们自称谁" |
| 2026-09-20 | `58974cc` | M7 第二十二步：**自检改成一句话 + 折叠明细**（新增纯函数 `probeVerdict`；WebDAV 也能自检——新增 `webdav/probe.ts` 一次只读 PROPFIND；未配置远端直接说"先填上"而不是报"连不上"）。同时以代码与真机磁盘为准回答了"东西存在哪 / 什么时候推送"：**全部本地**（记录 `storages\dsh_inbox\items\*.json`、字节 `~/.dsh\attachments\`、凭据 `.credentials.yaml`），**从不推送**（远端只有 GET/PROPFIND，单向拉取：启动一次 + 手动刷新）。审计发现 README 隐私段三条不实（账密加密落盘零实现、无内容出网、证件照并非"全本地判断"），按代码改写并在 AGENTS.md 第 3 条标注"加密落盘 ⚠️ 未实现" |
| 2026-09-20 | `58055e1` | M7 第二十三步：**账密加密落盘落地**（域 **v6**）——正文进 `secret`（AES-256-GCM，密钥由主密码 scrypt 派生），主密码/密钥**都不落盘**（内存持有、重启即锁、界面显式解锁），无密钥时**拒绝捕获账密**而非写明文，老明文记录在首次设置/解锁时自动转密文，判重改用 `secretDigest`（HMAC）；`global.master` 存 salt + KDF 参数 + seal 过的固定常量（不存密码哈希）。新增 `POST /api/inbox/secret`（status/set/unlock/lock）+ 面板「账密加密」块；列表侧补第二道闸：`secret` 记录不再有任何 `preview`。**用户同时拍板：推送/双向同步要做，做完才算完整、才进 M8**（顺序：加密 → 推送 → M8），已写进 `product-decisions.md` |
| 2026-09-20 | `250a2c1` | M7 第二十四步：**推送落地并真机验收**（用户 S3：`s3.cstcloud.cn/duoyu-inbox`）——`sync/items/<id>.json` + `sync/attachments/<id>`，增量靠 `global.sync.lastPushAt`（域 **v7**），附件内容寻址只传一遍，墓碑随记录上，一处失败返回 `partial` 且不拖累其余。S3 侧真坑：**PUT 必须对实际字节签名**（原来 payload 哈希写死空 body）；WebDAV 侧加 `writeFile`。面板「设置」新增**立即同步**（先推后拉）+ 结果描述。两条护栏：**拉取绝不吞 `sync/`**（否则自己的同步包会被当投放文件反复入库）、**拉取失败要带文件名**（`failed: 1` 这种数字没法处理）。真机：首次推 7 条 + 2 附件，二次推 0 条跳过 7 条，推送后拉取记录数不变。**还没做**：拉取合并（多设备互见）、远端删除；已知小缺口：失败条目因游标前进不自动重试 |
| 2026-09-20 | `9b29136` | M7 第二十五步（**用户发现的事故**）：推上去的文件全是 **0 字节**——根因是 `s3Fetch` 适配器 `fetch(url,{method,headers})` **把 `init.body` 丢了**，网关对空 body 的 PUT 也返回 200，整条链路无一处报错；**假 fetch 的单测永远看不见适配器吞字段**，新增 `test/adapters.test.ts`（stub 全局 fetch + 写读往返）才钉住。顺手加**「全部重传」**（`push {all:true}`，忽略游标）与把自检响应摘录 120→400 字符（"key 都在、对象全空"正是 120 字看不出的）。真机复验：附件 50085/80095 字节、7 条记录 JSON 277–689 字节；列表里 0 字节的 `inbox/`、`inbox/sync/`、`inbox/sync/items/` 是云盘自己的目录占位对象 |
| 2026-09-20 | `01692c7` | M7 第二十六步：用户问"`inbox/` 里那些目录名什么意思" ⇒ 新增 **`docs/help/remote-sync-layout.md`**（投放区 vs `sync/` 的分工、`items/<记录 id>.json` 与 `attachments/<附件 id>` 的命名理由、记录信封 `{format,record}`、附件为何用我们的行 id 而非 `sha256:` storeId、0 字节目录占位对象的来历、上云加密边界、以及"没有删除 / 没有合并"两个现状），并登记进本索引 |
| 2026-09-20 | `b4425c7` | M7 第二十七步（**用户发现**）：附件对象**没有扩展名**，云盘里认不出是图片——改成 `<附件 id>.<mime 推出的扩展名>`（推不出用 `.bin`），并把附件**元数据行**随字节一起推（`<id>.meta.json`：mime/字节数/原文件名/宽高/sha256），否则别的设备拉得到字节却重建不出引用它的记录。真机复验：两张图分别是 `….jpg` 50085 / 80095 字节 + 各自的 `.meta.json`；旧的无扩展名对象成为孤儿（文档写明，等"远端删除"一并清）。`remote-sync-layout.md` 同步更新 |
| 2026-09-20 | `dbcb72c` | M7 第二十八步：**云盘里要能直接看**——每条记录除 `.json`（真相、给程序）外再写一份 `<id>.txt`（**视图、给人**：标题/类目/时间/标签/待看/链接/页面标题/**附件指向**/备注/正文），拉取只读 `.json`；账密的 `.txt` 只写"正文已加密"（明文只在 `.json` 的 `secret` 密文里，测试钉住）；附件扩展名改为**先用文件原名**（`报税表.xlsx`）再查 mime 表、最后 `.bin`，所以视频/音频/PDF 本来就能直接打开。真机复验：7 条记录各 `.json`+`.txt`、两张图 `.jpg`+`.meta.json`。代价：对象数翻倍（量级上值得）。`remote-sync-layout.md`/README 中英同步 |

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条。
