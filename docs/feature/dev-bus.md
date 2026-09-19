# 开发总线

项目：`@duoyu/dsh-inbox`
原则：**一次只推进一个模块，每个模块有可验证的验收标准，验收记录留在本文件末尾。每个模块收尾必须同步更新 README（中英双份）的「安装 / 卸载 / 开发 / 当前可用功能」四节**——用户看的是 README，不是本文件。

状态图例：`未开始` / `进行中` / `待验收` / `已验收` / `阻塞`

| # | 模块 | 目标 | 验收标准 | 状态 |
|---|---|---|---|---|
| M0 | 插件骨架 spike | 打掉最大不确定性：第三方插件到底能不能长出 UI 和工具 | ① `dsh --profile inbox` 起得来；② 左栏出现 Inbox 图标，点开是占满主区域的页面；③ 对话里模型能调用一个最小工具并拿到结果；④ 实测到的真实 API 形态回写 `docs/help/dsh-plugin-platform.md` | 已验收 |
| M1 | 数据模型与存储 | 仓库的持久层 | 域 spec（items / attachments / global）+ CRUD + 关键词查询；vitest 单测全绿；库落在 DSH_HOME 的 storages 下 | 已验收 |
| M2 | 捕获入库 | 东西进得来 | 面板粘贴/拖拽文本、图片、链接各一条能入库；聊天框前缀转存能入库；重复项按规则合并 | 已验收 |
| M3 | 侧栏面板 | 看得见、管得动 | 列表 + 按类目/标签/未读筛选 + 详情 + 改备注与类目 + 标记已读 + 软删/回收站 | 未开始 |
| M4 | 对话工具与卡片 | 对话里取得到 | 检索/取回接口按约定返回（文本截断 1000 字、图片缩略图、链接卡、列表 10 条 + 还有 N 条）；截图留证 | 未开始 |
| M5 | 分类与脱敏 | 自动分类且不泄密 | 规则层（URL 判平台/类型、密钥正则、图片本地启发式）+ API 兜底 + 发模型前脱敏；用户描述优先级高于模型，有单测覆盖 | 未开始 |
| M6 | WebDAV 单向摄取 | 别的设备进得来 | 配好 WebDAV → 启动拉取远端 `inbox/` → 入库并标"未整理" → 走分类；WebDAV 不可用不阻塞启动 | 未开始 |
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
