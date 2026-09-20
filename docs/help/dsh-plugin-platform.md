# dsh 插件平台实测事实

本机 dsh 版本：`@deepseek-ai/dsh@0.1.5-rc.2`（2026-09-19 实测）。
证据分两处：`C:\Users\hands\.dsh\profiles\` 下是**实际安装**的包；`.research/dsh-api/` 是从 npm 拉取的官方分发副本（已 gitignore，用完即删）。
**rc 阶段 API 会变**：与代码冲突时以 `.research/` 里的官方源码为准，并回改本文档。

## 命令与装配

- `dsh web` 只是 `--profile web` 的**别名**（证据：`.research/dsh-api/cli` 的帮助文本）。
- `dsh --profile web` 只认 4 个应用级 flag：`--host`、`--port`、`--no-open`、`--trusted-host`；该解析器**没开 `allowUnknownOption`**（证据：`profiles/node_modules/@deepseek-ai/dsh-web-app/lib/startup.js`）。启动器会把 `--inbox` 原样转给应用，因此 **`dsh web --inbox` 会报未知参数退出**。
- 可用替代：`dsh --from-default-profile web --profile inbox` 派生自己的 profile；或用启动器 `--patch` 叠加补丁层；或在自己的 patch 层替换 `web-startup` 那一行。
- 插件安装：`dsh plugin --profile <name> add <包名>`（转发 pnpm）。
- profile 组合顺序：各 bundle 的 patch（按 `dsh.profile.bundles` 顺序）→ profile 的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖层。

## 插件包的双半边

一个包可以同时是宿主侧插件和浏览器侧插件（证据：`profiles/node_modules/@deepseek-ai/dsh-client-ui-sidebar/package.json`）：

- 宿主侧：`dsh.bundle.patch` 指向自己的 `cordis.patch.yml`。
- 浏览器侧：`dsh.client`（`platform: "web"`）＋ `exports["./client"]` 指向 `lib/client.js`；host 把 bundle 挂到 `/plugins`，浏览器**惰性加载**（先注册工厂，首次使用才执行模块体）。
- 平台预置 external：React、Cordis 与若干静态 UI 库；额外依赖要在 `dsh.client.external` 里声明。

## 客户端 bundle 的真实形态

（证据：`.research/dsh-api/packages/dsh-client-ui-sidebar/lib/client.js` 头 6 行）

```js
window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-client-ui-sidebar",
  factory: (require) => { /* 模块体 */ },
});
```

**这是 tsdown 的构建产物**（官方包 `scripts.bundle = "tsdown"`），不是人写的源码。插件源码里写 Cordis 的 `apply`/`inject`，构建时包一层工厂。手写这个包装层没有意义，我们照官方链路走 tsdown。

## 可用的 UI 扩展点（官方插槽）

- **左侧栏图标列表**：root 作用域 list slot `sidebar.panellist`，注册 `{ id, order, label }` + 图标组件；标签同时用于可见文本、无障碍名与折叠态 tooltip（证据：`profiles/.../dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts`）。
- **主区域页面**：layout 的 root 作用域 `main` **keyed slot**，key = 面板 id；`ctx.layout.selectPanel(id)` 切换，`null` 回到会话；`conversation` 是保留 key；选一个没注册的 key **会抛错并保持原选中**（证据：`profiles/.../dsh-client-ui-layout/lib/types/client/service.d.ts`、`.../dsh-client-ui-layout/README.md`）。
- 官方 README 原话：**shipped composition registers no example panel**——插槽是真的，但没有现成范例可抄，M0 要自己踩。
- **对话里的工具卡片**：keyed slot `tool.call.toolview`，key = **线协议工具名**；owner props 含 `callId`/`toolName`/`block`，以及 `loadImage`（结果带持久图片时用）、`openFile`、`inspect`。未注册的工具名回落到通用卡片（证据：`profiles/.../dsh-client-ui-tool/README.md`）。
- 还有 `sidebar.workspaces`（会话浏览区）、`sidebar.settings`、`sidebar.footer.action` 等座位可供替换/填充。

## 工具与 agent preset

- 注册工具：`defineTool({ name, description, parameters, output, execute })` + `ctx.tools.register(...)`；工具 schema 会自动进系统提示（证据：`profiles/.../dsh-tools/README.md`）。
- **工具只有在会话所属的 agent preset 的 `agent.cordis.yml` 里挂了才对模型可见**；web profile 里进程级工具行由 preset 接管（证据：`profiles/.../dsh-agent-presets/README.md`）。
- 用户级 preset 根：`$DSH_HOME/.agent-presets`（`includeUserRoot` 默认 true）。官方 UI 的 preset 创建是**复制现有 preset**、不接受直接写组合文本——自动装配因此是必需项，不是锦上添花。

### 同一个插件会被加载两次，宿主半边必须是进程内单例（2026-09-20 真机咬到）

把插件装进 profile（`dsh plugin add`）**再接进 agent preset**（`init` 做的事）之后，同一个进程里会有**两个插件实例**：

1. **profile 组合**里的那一份 —— 面板与宿主半边靠它存在（客户端 bundle 也是在这条链上注册的）；
2. **会话的 agent preset** 里的那一份 —— 工具注册表是**按会话**的，只在 profile 里的插件对模型不可见。

这是设计使然，不是装错了。但它撞上存储层的硬规则：`ctx.storageDomain` **按域名只允许一次 open**
（`DomainFacility.reserved`，违反时抛 `DomainError: domain 'dsh_inbox' is already open`，
证据：`node_modules/@deepseek-ai/dsh-storage-domain/lib/index.js`）。
于是第二个实例打开失败 —— 真机现象是**面板一切正常，助手那边 `inbox_status` 报 `vault NOT open`、
`inbox_search`/`inbox_get` 全答「仓库没有打开」**（面板正是那个先打开、持有域的实例）。

修法（`src/host/vault/lease.ts`）：**进程级单例 + 引用计数**。第一个调用者 open 并成为 owner，
后来的调用者共享同一个 `Vault` 对象，最后一个释放时才 close；失败的 open 不留在注册表里，
下次加载可以重试。注册表挂在 `globalThis` 上（同一个包被装两份时也共享）。

两条值得记住的后果：

- **一把钥匙**：面板的解锁与对话里的工具现在共用同一份内存密钥（以前是两个实例、两把钥匙）。
- **启动时的那次拉取只跑一次**（由真正 open 的那个实例跑），之后靠「刷新」再拉。

**给其它插件作者的结论**：凡是在 `apply` 里 open 域，或建立别的进程级资源（端口、文件句柄、定时器、
全局缓存）的插件，都要按「我这个 `apply` 可能在同一进程里跑两遍」来写。

## 存储

- `ctx.storage` + 后端 + 域：官方定位是"不该进会话历史的应用数据"（证据：`profiles/.../dsh-storage/README.md`）。
- 本机安装的 profile 里**只有 JSON 后端**（`dsh-storage-json`，可配 `root`、`single`/`per-record` 布局、原子写）；没有 SQLite 后端包。会话历史全文检索那一支才是 SQLite（`dsh-session-query-sqlite`）。
- 我们的决定：仓库用自建 SQLite（Node ≥22 的 `node:sqlite`），与 dsh 存储层解耦。

## 附件（粘贴的图片）

- `dsh-attachment-local` 已把粘进聊天的图片/文件存到 `$DSH_HOME` 下，按内容哈希去重、**永不自动删除**；单图 ≤20MiB、单条消息 ≤20 张、消息内合计 ≤200MiB（证据：`profiles/.../dsh-attachment-local/README.md`）。
- 含义：inbox 存图片时应当**引用**这套附件而不是复制一份；同步包也必须把附件一起带走。

## 模型与图片

- `@deepseek-ai/dsh-llm-deepseek` 里有视觉模型 id `deepseek-v4-flash-vision-exp`，并带 Files API 模块（`lib/types/files-api.d.ts`、`file-store.d.ts`、`file-id.d.ts`）。
- 结论：**"dsh 看不了图片、需要另配视觉插件"是错的**。但这也意味着粘进聊天框的图会被上传给模型——所以"进 inbox 的证件照不上传"是一条需要我们主动实现的约束，而不是默认行为。

## 生态与曝光

- 官方分发里**没有任何** `dsh-market` / `dsh-daemon` / `dsh-android-app` / `dsh-visualize` 之类的第三方包；网上流传的这类名单无法验证，按"不存在"对待。
- 每次向官方 API 发请求会附带**当前激活的插件包清单** `dsh_plugin_packages`（只有 `{name, version}`，不含内容）（证据：`profiles/.../dsh-plugin-package-inventory-deepseek/README.md`）。这是"被别人/官方看见"的真实渠道。

## 内置能力，别重复造

- `web_fetch`：HTML→markdown，用于抓链接标题/摘要（`dsh-tool-web`）。
- `web_search`：代价是每次搜索等于一次完整模型请求。
- `present`：把文件声明为交付物，出回合尾卡片（`dsh-tool-present`）。

## M0 实测补充（2026-09-19，骨架 spike 亲测）

以下每一条都是踩过之后写下来的，不是读文档推断的。

### 客户端插件必须声明 `inject: ['slots']`

**症状**：bundle 进了启动图、控制台零报错、注册调用也返回了 disposer，但侧栏就是不出现条目（连 `[data-slot="sidebar.panellist"]` 节点都没有）。
**原因**：客户端插件若不声明服务依赖，Cordis 会在 `slots` 服务就绪之前先跑一次 `apply`，此时 `ctx.get('slots')` 是 `undefined`，我们直接 `return`，注册静默丢失。
**修法**：客户端半边导出 `export const inject = ['slots']`（官方 sidebar 也是这么写的）。服务就绪后 Cordis 会重新激活插件。

### 安装是自动挂载的

`dsh plugin --profile <name> add <包名或路径>` 除了装包，**还会自动把包名追加到 profile `package.json` 的 `dsh.profile.bundles`**。装一个自带 `dsh.bundle.patch` 的包即可生效，不需要手改 profile 文件。

### 客户端 bundle 的构建配方

官方用 tsdown（配置未随包发布）。我们用 esbuild 复刻同样的产物：

- `format: 'cjs'`、`platform: 'browser'`、`jsx: 'automatic'`
- `external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*']`
- 外面包一层 `window.__ModuleLoader__.load({ id: <包名>, factory: (require) => { var module={exports:{}}; var exports=module.exports; ...; return module.exports } })`

**平台静态模块基线**（无需在 `dsh.client.external` 里声明）：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。其余模块请求必须声明，否则 boot 时报缺失供应商。

### 全局面板的实测行为

- `sidebar.panellist` 注册 `{ name, id, order, label }` + 图标组件后，侧栏出现一个「全局面板」分组和一行；`label` 就是可见文本。
- 点这一行时，主区域渲染 layout 的 `main` keyed slot 里**同 key** 的组件。
- 只注册 panellist、不注册 `main`，点击会抛错且保持原选中（官方文档说的行为，注意别踩）。
- 侧栏 collapsed 成 56px 轨道时面板行仍在（变成图标按钮）。

### 工具怎么才能到模型面前

两条路，都成立：

1. **宿主组合直接挂**——`base`/`headless` 这类没有 agent-presets 的组合，工具行一挂就对模型可见（M0 用 headless 实测通过）。
2. **挂进 agent preset**——web profile 的工具行由 preset 接管。用户级 preset 根是 `~/.dsh/.agent-presets/<id>/`，里面放 `preset.yml`（显示名/描述/顺序）+ `agent.cordis.yml`（组合）。把 shipped preset 整目录复制过来再追加自己的行即可。

**模型看到的工具输出是 `output.render()` 产出的内容**，不是 `execute` 返回的原始 JSON：M0 里 `execute` 返回对象，模型收到的是渲染后的文本 `dsh-inbox (M0) loaded: true`，它还特意指出"这不是 JSON"。

### pnpm 11 的构建脚本白名单

pnpm 11 在跑任何脚本前会先做依赖状态检查，一看到「ignored build scripts」就**非零退出**——`pnpm build` / `pnpm test` / `pnpm typecheck` 全部失效。`pnpm-workspace.yaml` 里要同时写两条：

- `onlyBuiltDependencies: [esbuild]`——允许构建脚本（`package.json` 里的 `pnpm` 字段已不再被读取）
- `verifyDepsBeforeRun: false`——关掉那个前置检查

实测即使提示被拦，esbuild 的二进制照样能用（`node scripts/build.mjs` 直接跑是成功的），所以拦住的是检查本身，不是工具。两条都补上之后 README 里写的 `pnpm build/test/typecheck` 才真的可用。

## M1 实测补充（存储栈，2026-09-19）

### 存储三件套不用我们挂

`dsh-base` 已经挂了 `storage` + `storage-json`（`root: dshHomePath('storages')`）+ `storage-domain`（`backend: json`）。第三方插件只要声明 `inject: ['storageDomain']`，就能直接 `await ctx.storageDomain.open(spec)`——**零配置**，数据落在 `~/.dsh/storages/<域名>/`。

### 域名规则是硬的

`defineDomain` 在**模块加载时**就校验，域名必须匹配 `/^[a-z][a-z0-9_]*$/`——**连字符会被拒**（`dsh-inbox` 直接抛错，`dsh_inbox` 才行）。表名同规则。同理它会拒绝"接受 null 的 global schema"（因为后端用 `null` 当"从未写入"的哨兵）。

### 域 API 的真实形状

- `domain.table(name)` → `get(key)` / `entries()` / `keys()` / `size` / `put(key, value)` / `delete(key)` / `update(key, fn)`
- `domain.global.get()` / `set(value)`
- 读是**同步**的（来自内存）；写排队走单条写链 → **先落盘** → 再改内存 → 发 `domain/changed`
- 没有查询语言，没有索引，没有跨表事务
- 域记录的 schema 用 **zod**（`^4.4.3`），而插件的 `Config` 用 schemastery——两套库并存，别搞混

### per-record 的记录 key 有硬约束

后端把 key 直接当文件名用，所以 key 必须匹配 `/^[a-zA-Z0-9_-]+$/`，**冒号、斜杠、点一律不接受**，不合法时整次写入抛 `per-record key '…' is not path-safe`。

这条和 dsh 自己的附件 id 直接冲突：用户在输入框里附的图片，`attachmentId` 是 `sha256:<hex>` 形状。**把外部 id 直接当记录 key 是一个陷阱**——要么自己生成 UUID 当 key、把外部 id 放进字段里（我们的做法），要么先做一次字符替换。

单测用假 id（`att-1`）时不会暴露这个问题，只有跑真实的附件引用才会炸。

## M2 实测补充：浏览器半边怎么调宿主半边

这是整个项目最贵的一个答案。**结论：走 Connection 的具名 Fetch 路由，浏览器侧用普通 `fetch` 即可，客户端不需要任何服务。**

### 宿主侧注册一个端点

```ts
ctx.inject(['connection', 'attachments'], (scoped) => {
  scoped.effect(() => scoped.connection.fetch.register({ path, methods, requestBody, fetch }), label)
})
```

- `ConnectionFetchRoute`：`{ path, methods: ('GET'|'HEAD'|'POST')[], requestBody: 'buffered'|'streaming', fetch(request): Promise<Response> }`；`register` 返回**异步** disposer（证据：`dsh-client-connection/lib/types/rpc.d.ts`）。
- 路由挂在共享 `/api` 通道上，**在物理载体已经做完信任与鉴权之后**才被调用——原话是 "Handle one request after the physical carrier has applied its trust and authentication policy"。

### 浏览器侧为什么不用做任何事

页面用带 token 的根 URL 打开时，`BrowserAuth.authorizeIndex` 会用启动 token**铸一个签名的浏览器 cookie**（`browser-auth.d.ts`：`authenticatedUrl` → `authorizeIndex` → `isAuthenticated` 校验 Host+Cookie）。之后同源的 `fetch` 自动带上这个 cookie，所以面板里一句 `fetch('/api/inbox/capture', {method:'POST', ...})` 就够了，**不需要注入任何客户端服务**。

### 上传字节走官方入口

`@deepseek-ai/dsh-attachment` 提供 `admitEncodedImages(store, images)` / `admitEncodedFile(store, file)`，官方注释写着"The shared entry for every RPC endpoint accepting browser uploads"。它们强制**规范 base64**（非规范直接抛 `AttachmentError`），再交给 `ctx.attachments.saveImages/saveFile` 落盘并返回 `sha256:<hex>` 形状的引用。图片的字节**不进我们的域**，域里只存引用和元数据。

### 两条被否掉的路（子代理调研得出，未独立复现）

- `ctx.connection.rpc.handle`：0.1.5-rc.2 里它解析 HTTP 路由用的是 Connection 服务自己的 context，而那个 context 只声明了 `credentials`，于是抛 `cannot get property "webServer" without inject`。
- `ctx.connection.rpc.intercept('/api', …)`：那条通道已经有一个拦截器（Typert gateway），只允许一个。

如果将来要放弃 Fetch 路由改用 RPC，**先复现这两条**再定。

## M4 实测补充：工具与自定义卡片

- 模型能看见并调用宿主侧注册的工具：在 web 会话里问"我仓库里有哪些没看的"，模型直接调了 `inbox_status` + `inbox_search` 并给出结果。**"工具必须挂进 preset 才可见"的担心不成立**——宿主组合里的注册对所有会话可见。
- 工具结果原样进入对话（`output.render` 的文本就是模型看到的内容），带 id，模型可以拿 id 继续调 `inbox_get`。
- **`tool.call.toolview` 虽然声明为 `scope: 'session'`，但 root 侧插件注册它是有效的**（证据：官方 `dsh-client-ui-skill` 就是 root 插件，用 `ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({name, key:'skill'}, Row))` 注册自己的卡片）。我们照做，卡片正常渲染。

**一条给自己和后来者的教训**：我一度以为卡片没生效——因为截图里 `[attachment:…]` 标记显示为纯文本。其实那是**模型在回答里引用了工具结果**，卡片本身折叠在"工具调用"区里。展开后卡片和缩略图都正常。**判断 UI 是否生效前，先把对应区域展开**；模型复述的内容不是证据。

### 在单测里跑真实存储栈

不用起 dsh，直接在 vitest 里组一个 Cordis 应用即可（实测可行）：

```ts
const ctx = new Context()
await ctx.plugin(Storage).await()                            // 默认导出就是 Service 类
await ctx.plugin(storageJson, { root: tmpdir }).await()      // 命名空间对象（apply/inject/Config）
await ctx.plugin(storageDomain, { backend: 'json' }).await()
const vault = await Vault.open(ctx)
```

注意 `@deepseek-ai/dsh-storage` 是**默认导出**（Service 类），另外两个是带 `apply` 的插件对象——传错形状 TypeScript 会当场报 `Plugin` 不匹配。

宿主半边的构建要把 `zod` 也设为 external：它是我们自己的运行时依赖，打两份 zod 进产物既浪费又可能出现两个实例。
