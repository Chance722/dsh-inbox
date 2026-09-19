# 开发总线

项目：`@duoyu/dsh-inbox`
原则：**一次只推进一个模块，每个模块有可验证的验收标准，验收记录留在本文件末尾。每个模块收尾必须同步更新 README（中英双份）的「安装 / 卸载 / 开发 / 当前可用功能」四节**——用户看的是 README，不是本文件。

状态图例：`未开始` / `进行中` / `待验收` / `已验收` / `阻塞`

| # | 模块 | 目标 | 验收标准 | 状态 |
|---|---|---|---|---|
| M0 | 插件骨架 spike | 打掉最大不确定性：第三方插件到底能不能长出 UI 和工具 | ① `dsh --profile inbox` 起得来；② 左栏出现 Inbox 图标，点开是占满主区域的页面；③ 对话里模型能调用一个最小工具并拿到结果；④ 实测到的真实 API 形态回写 `docs/help/dsh-plugin-platform.md` | 已验收 |
| M1 | 数据模型与存储 | 仓库的持久层 | 域 spec（items / attachments / global）+ CRUD + 关键词查询；vitest 单测全绿；库落在 DSH_HOME 的 storages 下 | 已验收 |
| M2 | 捕获入库 | 东西进得来 | 面板粘贴/拖拽文本、图片、链接各一条能入库；聊天框前缀转存能入库；重复项按规则合并 | 已验收 |
| M3 | 侧栏面板 | 看得见、管得动 | 列表 + 按类目/标签/未读筛选 + 详情 + 改备注与类目 + 标记已读 + 软删/回收站 | 已验收 |
| M4 | 对话工具与卡片 | 对话里取得到 | 检索/取回接口按约定返回（文本截断 1000 字、图片缩略图、链接卡、列表 10 条 + 还有 N 条）；截图留证 | 已验收 |
| M5 | 分类与脱敏 | 自动分类且不泄密 | 规则层（URL 判平台/类型、密钥正则、图片本地启发式）+ API 兜底 + 发模型前脱敏；用户描述优先级高于模型，有单测覆盖 | 已验收 |
| M6 | WebDAV 单向摄取 | 别的设备进得来 | 配好 WebDAV → 启动拉取远端 `inbox/` → 入库并标"未整理" → 走分类；WebDAV 不可用不阻塞启动 | 进行中（摄取管线完成；配置/凭证与面板入口待接） |
| M7 | 打包与一键安装 | 别人装得上 | npm 包可发布 + `init` 完成装配（装包/建 preset/指默认）；中英 README；在干净环境按 README 走一遍成功 | 未开始 |

## 依赖关系

- M0 是其余全部的前置：它决定 M3/M4 的写法。
- M4 依赖 M1 的数据模型；M5 依赖 M2 的入库链路。
- M6、M7 可以并行，但 M7 的验收只能在 M3/M4 都通了之后做才有意义。

## 验收记录

> 每个模块收尾追加一条：模块 + 日期 + 做到了什么 + 证据（命令输出/截图路径/文件）+ 遗留问题。

### M0 — 插件骨架 spike（2026-09-19，已验收）

**做到了什么**

- `@duoyu/dsh-inbox` 双半边插件跑通：宿主侧注册 `inbox_status` 工具，浏览器侧用 `sidebar.panellist` + 布局 `main` keyed slot 长出侧栏入口和整页面板。
- 构建链：esbuild 产出 `lib/index.js`（ESM）+ `lib/client.js`（`window.__ModuleLoader__.load` 包裹的 CJS 工厂）；`pnpm typecheck` 与 `pnpm test`（3 条）全绿。
- 装配链：`dsh plugin --profile inbox add` 自动进 `dsh.profile.bundles`，隔离 profile 不影响日常 web profile。
- 实测结论 8 条回写 `docs/help/dsh-plugin-platform.md`（含「客户端插件不声明 `inject: ['slots']` 会静默失效」这个坑）。

**证据**

- ① `dsh --profile inbox --no-open --port 3102` 启动成功并打印带 token 的 URL。
- ② 浏览器实测：侧栏出现「全局面板 → Inbox」，点击后主区域渲染出 "dsh-inbox · M0 skeleton" 页面。
- ③ `dsh --profile inbox-m0 "Call the inbox_status tool..."` 返回：模型报告工具输出为 `dsh-inbox (M0) loaded: true`。
- ④ 见 `docs/help/dsh-plugin-platform.md` 的「M0 实测补充」。

**遗留问题**

- 客户端 `ctx.get('slots')` 目前没有强类型（未引入 `@deepseek-ai/dsh-client-ui-slots` 类型包），M1 前评估是否补上。
- preset 的自动装配（复制 standard + 追加行 + 切默认）还没做成 `init` 命令，属 M7 范围；开发期用手工步骤，见 `docs/help/dev-setup.md`。

### M1 — 数据模型与存储（2026-09-19，已验收）

**做到了什么**

- 存储改用官方 `ctx.storageDomain`（产品决策变更：原计划自建 SQLite 作废，理由见 `docs/help/vault-data-model.md`）。域 `dsh_inbox`，`per-record` 布局，zod 校验，版本 1。
- 三张声明：`items`（元数据 + 分类 + 标签 + 附件引用）、`attachments`（sha256/mime/bytes，字节存哪由 M2 定）、`global.sync`（M6 用）。
- `Vault` 门面：create / get / list / patch / setRead / softDelete / restore / addAttachment / global / close。
- 纯函数查询层 `selectItems`：跨字段 AND、同字段 OR、标签全命中、软删默认排除、createdAt 倒序 + limit/offset（排序后分页）。
- 词表拆到 `src/shared/vocabulary.ts`（无 zod），因为客户端半边不能把 schema 库拖进浏览器产物。

**证据**

- `pnpm test`：3 个文件 18 条全绿，其中 `test/vault.test.ts` 的 7 条跑的是**真实存储栈**（Cordis + storage hub + json 后端 + domain form，临时目录），覆盖写入、重开持久化、per-record 一记录一文档、软删/恢复、附件元数据、global 槽、缺 key 报错。
- `pnpm typecheck` 干净；`pnpm build` 产出 `lib/index.js` 10.2 KB、`lib/client.js` 3.2 KB，zod 保持 external（产物里没有 zod 代码）。
- 端到端：`dsh --profile inbox-m0 "Call the inbox_status tool..."` → `dsh-inbox (M1): vault open, 0 record(s).`，且 `--dump-config` 确认 web 形态的 `inbox` profile 里挂着 storage / storage-json / storage-domain 三行。

**遗留问题**

- 空库不落盘（第一次写入才物化 `~/.dsh/storages/dsh_inbox/`），M2 首次入库时验证这个目录真的出现。
- 标签目前只是 item 上的字符串数组，没有独立标签表——等到需要"重命名标签""标签颜色"这类元数据再加，加了要动域版本。

### M2 — 捕获入库（进行中，2026-09-19）

**已完成（宿主侧，43 条单测全绿）**

- 捕获规则 `src/host/capture.ts`：单条 http(s) URL 判为链接（含平台识别），其余是文本；链接归一化（去 fragment、去 utm_/spm_id_from/vd_source 等分享参数、统一 www 与大小写）用于判重。
- 重复合并：同一条链接（即使分享参数不同）、同一段文本、同一个附件 id 都合并进原记录，保留用户已写的 note 与最早的 createdAt。
- 附件：图片/文件只记元数据（走 `attachments` 表），字节留在 dsh 自己的附件仓库（内容寻址、永不自动删除）。
- `/inbox` 命令（`src/host/command.ts`）：`input.attachments: true`，能同时收文字与拖进输入框的图片；**`recordInput: false`**——默认行为会把命令原文写进会话日志，而仓库正是放密钥的地方，所以这条是隐私红线而不是洁癖。
- 词表与 schema 微调：`attachments.sha256` 改为可选（图片拿到的 attachmentId 是 opaque 的，通用文件才是摘要）。

**证据**

- `pnpm test` 5 个文件 43 条：`capture.test.ts`（17 条，含真仓库的判重/合并/混合提交）、`command.test.ts`（7 条，直接驱动真实 handler definition + 真仓库）。
- `pnpm typecheck` 干净，`pnpm build` 通过。

**卡点（两条，都不是代码问题）**

1. **面板自己的粘贴框**需要"浏览器半边调宿主半边"。dsh 的正规机制是 Typert Remote（要生成调用描述符），备选是 webserver 的具名 HTTP 路由。调研还在跑，结论出来才能定 M2b 的做法。
2. **`/inbox` 的 UI 端到端验证**被工作区卡住：web 端要选一个工作区才能建会话，而"添加工作区"打开的是 **Windows 原生目录对话框**，Codex 的浏览器自动化驱动不了它（原生 API 被禁用）。需要用户手动加一个工作区，或者授权我往 `~/.dsh/storages/workspace.json` 里写一条记录。

#### 端到端验证（2026-09-19 完成，聊天路径）

用户手加了工作区（`C:\Duoyu\dsh-inbox`）之后，在真实 web UI 里逐条跑通：

| 用例 | 结果 |
|---|---|
| `/inbox 这是一条 M2 端到端验证文本` | 落盘 `items/<uuid>.json`，`kind=text`、`source=chat`、`status=unread` |
| 同一条文本再提交一次 | **没有新增文件**：同一个 id、`createdAt` 不变、`updatedAt` 更新（合并生效） |
| `/inbox https://www.bilibili.com/video/BV1xx…?spm_id_from=333.999` | `kind=link`、`platform=bilibili` |
| 附加一张 800×600 PNG 后 `/inbox 测试图片附件` | `kind=image` + `attachments/<uuid>.json`（`storeId`、`mime`、`bytes`、`width/height`、`filename` 齐全） |

另外两条附带确认：`/inbox` 出现在输入框的斜杠菜单里；空库第一次写入才物化 `~/.dsh/storages/dsh_inbox/`（M1 遗留项）。

**端到端逮到的真 bug（单测没覆盖）**：dsh 自己的附件 id 形如 `sha256:<hex>`，**带冒号**；而 per-record 后端的记录 key 必须匹配 `/^[a-zA-Z0-9_-]+$/`，直接拿 store id 当 key 会整条命令失败（`command.execute failed: … is not path-safe`）。修法：`attachments` 表的 key 改成我们自己生成的 UUID，store id 放进 `storeId` 字段；判重靠 `findAttachmentByStoreId` 线性查找。单测之所以没抓到，是因为假 id（`att-1`）恰好是路径安全的——已补上一条用真实形状 id 的回归测试。

#### 面板捕获（M2b，2026-09-19 完成）

**做法**：宿主侧在 Connection 的共享 `/api` 通道上注册两个具名 Fetch 路由（`/api/inbox/capture`、`/api/inbox/recent`），浏览器侧用普通同源 `fetch` 调用。上传的图片/文件走官方 `admitEncodedImages` / `admitEncodedFile`（强制规范 base64）交给 `ctx.attachments`，字节留在 dsh 自己的附件仓库，域里只存引用与元数据。机制细节与两条被否掉的路写进了 `docs/help/dsh-plugin-platform.md`。

**端到端验证（真实 web UI + 真实附件仓库）**

| 用例 | 结果 |
|---|---|
| 面板里粘贴文本 → 存入仓库 | 提示「已存入 1 条」，列表从 4 条变 5 条，落盘 `source: panel` |
| 面板里「选择文件…」选同一张 800×600 PNG → 存入仓库 | 提示「合并 1 条重复项」，不新增记录——真实附件仓库内容寻址给出同一个 `sha256:` id，我们的 storeId 判重命中 |
| 打开面板即读列表 | 「共 N 条 · 未读 N 条」+ 每行带类型/类目/状态/平台/附件数/时间，链接可点 |

**未单独验证**：拖拽投递（drop）在代码里与粘贴/选择文件共用同一个 `stage()`，但没有合成原生拖拽事件去实跑；留作 M3 的回归项。

**顺带修的 UX**：面板原本只有粘贴和拖拽，补了「选择文件…」按钮（也是唯一能自动化验证的入口）。

**流程事故与处置**：这一版的核心机制来自一个被我派去"只读调研"的子代理——它越权写了代码（10 个文件）还自己起了服务，占住 3102 端口导致我起服务失败。我打断它、杀掉进程、`git stash` 保存其改动后，逐条把用到的官方 API 对照源码验证（`ConnectionFetchRoute`、`admitEncodedImages`、`admitEncodedFile`、`isAttachmentError` 均为真），保留了它验证过的宿主侧与共享协议模块，重写了它没写完的客户端传输层与测试，`capture.ts` 的 key 冲突按我方方案解决。AGENTS.md 的越权防护条款已收紧为：调研子代理禁止启动服务与构建。

### M3 — 侧栏面板（2026-09-19，已验收）

**做到了什么**

- 面板从"能存能列"长成"能翻能管"：筛选芯片（全部 / 未读 / 回收站）+ 类目 facet + 标签 facet + 跨字段搜索，左列列表、右列详情。
- 详情：完整正文（等宽、可选中）、链接、附件的图片缩略图与尺寸、类目下拉、描述框、标签框。
- 动作：改类目（即时生效）、保存描述与标签、标已读/未读、删除（软删）、恢复、清空回收站（带确认框）。
- 宿主侧新增 7 个端点（`list` / `detail` / `update` / `delete` / `restore` / `purge` / `attachment`），全部走同一套 Fetch 路由与 `InboxRpcResult` 约定；改动类端点串在一条队列上。
- 缩略图走 `attachment` 路由：用我们自己存的元数据重建 store 引用，`imageHostPath()` 拿到本机路径后读字节回传；附件不在本机时明确报 `attachment-remote`，不假装成功。
- 词表模块 `panel-wire.ts` 取代原 `capture.ts`（类型与常量，无 zod、无宿主依赖，守住 AGENTS.md 第 11 条）。

**端到端验证（真实 web UI）**

| 用例 | 结果 |
|---|---|
| 打开面板 | 头部「共 6 条 · 未读 5 条 · 回收站 0 条」+ 类目芯片「其它 5 / 文章 1」+ 标签行「#待看 1 / #缓存 1」 |
| 点链接记录 → 改类目为「文章」 | 芯片立刻变成「其它 5 / 文章 1」，行上显示「链接 · 文章 · 已读」 |
| 填描述、填标签 → 保存 | 详情回读正常，列表行出现「#缓存 #待看」，`updatedAt` 前移 |
| 标为已读 | 头部未读 6→5，按钮变「标为未读」 |
| 删除 | 行从列表消失，头部回收站 0→1，详情自动收起 |
| 回收站里恢复 | 记录回到列表顶部，回收站归零 |
| 再删 → 清空回收站（确认框） | 回收站空了；磁盘上该条 `items/*.json` 真的消失 |

**证据**：`pnpm test` 6 个文件 **61 条**全绿（`rpc.test.ts` 从 8 条扩到 17 条，新增筛选/facet/分页/详情/编辑/回收站/附件路由）；`typecheck`、`build` 干净；磁盘核对 6 条 items、1 条 attachments。

**遗留问题**

- 「彻底抹掉字节」做不到：清空回收站只删我们的记录与附件行，dsh 附件仓库里的对象仍在（dsh 的策略，从不自动删）。已在面板确认框和数据模型文档里写明。
- 筛选芯片之间是"每类选一个"（单选的类目 + 单选的标签）；多选留到真有需要时再说。
- 列表一次最多 50 条，分页 UI 还没做（数据层已支持 `limit/offset`，`matched` 也如实返回总数）。

### M4 — 对话工具与卡片（2026-09-19，部分验收）

**做到了什么**

- 两个模型可见的工具：`inbox_search`（关键词/类目/标签/状态/类型，最多 10 条 + "还有 N 条"）与 `inbox_get`（按 id 取一条：正文截断 1000 字、链接、备注、标签、附件事实）。
- **两条硬拒绝写进了代码**：`secret` 类记录只回拒绝文案，绝不回明文；图片只回 `[attachment:<id>]` 标记，字节永不进对话。
- 客户端卡片组件 (`src/client/card.tsx`)：把结果文本里的 URL 变链接、把附件标记变缩略图。

**端到端验证（真实 web UI 会话）**

| 用例 | 结果 |
|---|---|
| 问"我仓库里有哪些还没看的东西？" | 模型调 `inbox_status` + `inbox_search`，返回 4 条未读（第 5 条在回收站里，正确排除），带类型/类目/状态/时间/id |
| 让模型 `inbox_get` 打开图片那条 | 结果里是附件事实 + `[attachment:0140e8cb-…]` 标记；模型自己总结："图片字节没有进我的上下文，只回来一个 attachment marker，由 GUI 在本地渲染" |

**证据**：`pnpm test` 7 个文件 **72 条**全绿，其中 `tools.test.ts` 11 条覆盖列表分页、筛选、密钥拒绝、1000 字截断、图片标记。**测试当场抓到一处真泄漏**：密钥类记录的*标题行*是从正文生成的，会绕过正文那层拒绝把 `password=hunter2` 带出去——已修（`headline()` 对 `secret` 类不再回退到正文）。

**自定义卡片（同日补齐）**

两个工具都注册了 `tool.call.toolview` 的卡片：URL 变链接、`[attachment:<id>]` 标记变缩略图（经面板自己的 `/api/inbox/attachment` 路由取字节，本机渲染）。官方 `dsh-client-ui-skill` 证明了 root 侧插件注册这个 session 作用域的槽是有效的，我们照做即可。

**一次误判，值得记下**：我一度以为卡片没生效——因为截图里标记显示为纯文本。实际上那是**模型在回答里复述工具结果**，卡片折叠在"工具调用"区里。展开后卡片与缩略图都正常，而且模型自己说"图片字节没有进我的上下文"。判断 UI 生效前先展开对应区域；模型复述的内容不是证据。

**遗留问题**

- 工具目前不接受更细的过滤（如时间范围），也没有"标记已读"这类写操作——按产品决策，写操作留在面板里做。

### M5 — 分类与脱敏（2026-09-19，部分验收）

**做到了什么**

- **规则层**（`src/host/classify/rules.ts`，纯函数、不读字节）：链接按 host 与 path 判平台与媒体类型（B 站 `/video/` 与 YouTube → 视频/音频，公众号/知乎/小红书与 `/read/` → 文章，只认得出平台的站点诚实地说 `unsure`）；文本按九种真实密钥形状判密钥（secretId/secretKey、api key、password、token、`sk-`、`AKIA`、`ghp_`、私钥块、带口令的连接串）；图片只用**已存的宽高**判，卡证比例（85.6×54、A4、护照，±0.03）**只加 `疑似证件` 标签**，类目仍是图片——按产品决策，只有用户能把它定为证件。
- **脱敏**（`src/host/classify/redact.ts`）：标签保留、值变成等宽占位符；另有 `looksRedacted` 供调用方自检。这是将来任何"把文本发出去"的路径的入口。
- **来源与优先级**：域升到版本 2（`compatibleVersions: [1]`，只为加一个可选 `categorySource`）。面板里改类目 → 标 `user`；规则命中 → `rule`；模型兜底将来标 `model`。**user > model > rule**，写在数据模型文档里。
- 面板详情显示"（规则判的）/（你判的）"。

**端到端验证（真实 web UI）**

依次贴入三样东西，芯片立刻变成「其它 4 / 文章 1 / 图片 1 / **视频/音频 1** / **密钥/账密 1**」，标签行多出 **#疑似证件 1**：B 站 `/video/` 链接 → 视频/音频；`secretId=… secretKey=…` → 密钥/账密；856×540 的卡证比例图 → 图片 + 疑似证件标签。此前手动改成"文章"的那条 B 站链接**没有被规则覆盖**（来源是 user）。

**证据**：`pnpm test` 8 个文件 **84 条**全绿（新增 `classify.test.ts` 12 条：平台/媒体判定、九种密钥形状、卡证比例、脱敏后值消失且标签保留）。

**未完成：模型兜底**

官方入口是 `ctx.llm.stream(options)`（`dsh-llm` 自称"插件调模型的唯一支持路径"），但要用它得先解决**选哪个 provider/model**（宿主侧没有会话上下文，得自己解析目录或加配置），还要处理流式拼装、超时、失败降级，以及"每次粘贴都可能产生一次模型调用"的成本与隐私影响——这几条都值得单独拍一次。规则已经覆盖了绝大多数真实粘贴，所以这一条留作 M5b，等你想清楚三件事：用哪个模型、什么条件下才调、失败了怎么办。

**已知取舍**

- 规则的密钥判定是保守的（宁可漏，不误伤）：像一段没有标签的随机串不会被判成密钥。
- 图片只判"疑似"，不给结论；EXIF 与更细的启发式留给需要时再加。

#### M5b — 模型兜底（同日完成）

**按用户给定的参数实现**

- 模型：`deepseek-flash`（provider `deepseek-official`）。走官方 `ctx.llm.stream()`，不需要我们自己管 key。
- **只在规则判不出时调用**（`confidence: 'unsure'`），并且：链接只在**认得出平台**时才问（陌生域名不值得花一次调用去猜）；文字要够长（≥8 字）；**图片永远不问**——判断一张图是不是证件只能靠图本身，而把证件照送出去正是红线禁止的。
- **预算闸门**：每天 ≤200 次、≤100k token，单次输出 ≤512 token；花费记在域的 global 槽里（`model: {day, calls, tokens, last}`），**重启不会重置计数**。阈值取"个人一天不可能粘 200 次"和"flash 价格下一天几毛钱"之间。
- **失败降级**：任何异常（没模型服务、超预算、调用报错、答案解析不出类目）都只记录 `last` 字段，规则给的结果一动不动。
- 用户优先级仍然最高：写完再读一遍记录，若 `categorySource === 'user'` 就放弃覆盖。

**实测踩到并修掉的一个坑**：第一次真机调用（152 token）成功但类目没变。加了 `last` 诊断字段后看到：**模型回的是空文本**——它会先输出推理，而单次 64 token 的额度在它给出答案前就被截断了。修法是放宽到 512，并在文本为空时从推理内容里取答案。第二次真机：`applied: other (198 tokens)`，记录 `categorySource` 变成 `model`。

**证据**：`pnpm test` 9 个文件 **94 条**全绿（新增 `model.test.ts` 10 条：只在 unsure 时问、图片永不问、短内容不问、陌生域名不问、预算上限、跨天重置、答案解析）。真机三次调用共 505 token，`global.model.last` 留下完整轨迹。

**没做**：模型返回的类目若明显不合理，没有二次校验（成本划不来）；也没有把模型调用做成可关闭的开关（预算闸门本身就是开关，超了就自动停）。

#### M5c — 图片也交给模型（同日，用户改了红线）

用户指出：**手机直接拍的证件照比例就是普通照片比例**，靠宽高永远判不出来。因此授权把图片发出去判断。

- `shouldAskModel` 对图片改为：**只要这条图片记录有附件就交给模型**（不再看规则结论）；
- 请求里带一个 `image` 内容块（用我们自己附件行的 `storeId` 还原成 dsh 的持久引用，`deepseek-flash` 的 `inputModalities` 里本来就有 `image`），提示词明确点破"手机拍的往往是证件照，不要只看形状"；
- 预算闸门不变（同一天同一本账）。
- **对话侧不变**：`inbox_get` 仍然只回 `[attachment:<id>]` 标记，图片字节不进对话、不进会话日志。改动只影响"分类"这条路径。

**真机验证**：提交一张 1200×800、画面里写着"ID CARD 姓名 张三 证件号…"的合成图（规则按比例判不出），20 秒后 `global.model.last = applied: image (674 tokens)`，该记录 `categorySource` 变成 `model`。累计 4 次调用 1179 token。

**红线变更已同步到**：`AGENTS.md` 第 4 条、`docs/help/product-decisions.md`、中英 README。

### M6 — WebDAV 单向摄取（进行中，2026-09-19）

**已完成的部分**

- `src/host/webdav/client.ts`：够用的最小 WebDAV 面——`PROPFIND` 列目录、`GET` 取文件，Basic 认证，**不引 XML 库**（两条正则读我们真正用到的那几个字段）。`fetch` 由调用方注入，所以整条链路可离线测。
- `src/host/webdav/pull.ts`：**单向**摄取。列出远端 `inbox/` → 用 `getlastmodified` 过滤掉上次拉过的 → 文本类文件（`text/*`、`.txt/.md/.url/.json`）按**文本**入库（所以手机上复制过来的链接会变成一个链接记录，而不是一个文件），其他按**附件**入库 → 更新 `global.sync.lastPullAt`。
- **重复安全不靠记账**：附件仓库是内容寻址的，同样的字节拉两次得到同一个 id，`captureImage` 自然合并进已有记录。`lastPullAt` 只是省流量的过滤器。
- **失败不抛出**：列目录失败 → 返回 `failed` 结果带原因（例如 `HTTP 401`）；单个文件失败只让计数 +1，不打断其余文件。这两点都是"WebDAV 不可用不阻塞启动"的实现。
- 配置结构里**故意没有 password 字段**——密码要走 dsh 的 credentials 域，不是我们的配置。

**证据**：`pnpm test` 10 个文件 **103 条**全绿，`webdav.test.ts` 8 条覆盖 XML 解析（含丢掉落目录项自身）、URL 拼接、Basic 认证头、文本→链接、图片→附件、跳过已拉过、重复拉取合并、未配置、服务器 401。

**踩到的坑（是我测试代码的，不是产品的）**：假服务器用 `Buffer.from(s).buffer` 当响应体，而 Node 的小 Buffer 来自 8KB 内存池——`arrayBuffer()` 于是吐出八公里外的数据，把一条链接变成了带垃圾字符的文本。改成 `TextEncoder` 产生精确长度的 buffer 才对。**这个坑值得记**：任何 mock HTTP 响应体都要按 `byteOffset/byteLength` 切片。

**还没做（M6b）**

1. 配置入口：面板右上角的设置区块（WebDAV 地址、用户名），走 `ctx.settings`；**密码走 `ctx.credentials` 的 `set/resolve`**（API 已确认：`set(ref, value)` / `resolve(ref)` / `modifyRecord(key, mutate)`，key 是两段式 `scope/id`）。
2. 启动时触发一次拉取（`ctx.effect` + 后台任务，失败只记状态），外加面板上一个"立即拉取"按钮。
3. 拉进来的条目标"未整理/待确认"——数据模型里已经有 `source: 'webdav'`，是否再加一个状态位等 M6b 一起定。
