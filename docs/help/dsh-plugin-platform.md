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

`package.json` 里的 `pnpm` 字段已不再被读取；`onlyBuiltDependencies` 必须写进 **`pnpm-workspace.yaml`**。否则 esbuild 的原生二进制装不上，且每次 `pnpm run` 都会因依赖状态检查失败而报 `ERR_PNPM_IGNORED_BUILDS`。
