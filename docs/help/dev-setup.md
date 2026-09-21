# 本地开发与验收流程

`@chance722/dsh-inbox` 是 dsh 插件，**必须装进一个 dsh profile 才能跑**。

## 当前这台机器（2026-09-20 实测）

| 项 | 值 |
|---|---|
| 仓库 | `<仓库路径>`（自己那个 checkout 落在哪就是哪） |
| `DSH_HOME` | `%DSH_HOME%`（profiles / storages / sessions 都在这里） |
| Node | `v22.22.x` 以上，用 `node -v` 自己确认一次 |
| dsh CLI | `0.1.5-rc.2`，npm 全局装好之后 `dsh` 就在 PATH 上，直接敲 |
| PATH 没配好时 | `node <全局 node_modules>\@deepseek-ai\dsh\lib\bin.js <参数>`（全局 root 问 `npm root -g`） |

## 命令

```powershell
cd <仓库路径>
pnpm build          # esbuild → lib/index.js + lib/client.js
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
```

> 文档里的 `<仓库路径>` / `%DSH_HOME%` 是占位：读的时候按自己机器上的实际位置替换。

## 隔离开发 profile

```powershell
# 首次：从 web 模板派生一个自己的 profile（不动原来的 web profile）
dsh --profile inbox --from-default-profile web --dump-config

# 挂载本仓库（link 安装，改完重新 build 即可生效）
dsh plugin --profile inbox add <仓库路径>

# 起服务（换端口避免和日常使用的 3080 冲突）
dsh --profile inbox --no-open --port 3102
```

浏览器打开打印出来的带 token 的 URL，左栏应出现「全局面板 → Inbox」，点击即切到插件页面。

**为什么第一步不能省**：`dsh plugin --profile <name>` 在 profile 还不存在时会**自动初始化**它，用的却是 `DEFAULT_PROFILE_BUNDLES = ["@deepseek-ai/dsh-base"]`——只有 base，**没有 web 应用**，起来就不是浏览器 UI。所以"先派生 web 模板、再 add 插件"这个顺序是必需的（`--from-default-profile` 遇到已存在的 profile 会直接报错，不会覆盖）。

**插件是怎么挂上去的**：一个 profile 就是 `%DSH_HOME%\profiles\<name>\` 下的一个小包——`package.json` 的 `dsh.profile.bundles` 决定这个 profile 装哪些 bundle，`cordis.patch.yml` 是用户层。`plugin add` 在那个目录里把参数转发给 pnpm，把本仓库作为 **link 依赖**装进去，再把 `@chance722/dsh-inbox` 追加进 `dsh.profile.bundles`。插件自己声明了两个半边：`dsh.bundle.patch`（宿主侧 Cordis patch，工具/存储/HTTP 路由都在这边）和 `dsh.client`（浏览器侧，`platform: web`，产物 `lib/client.js`，侧栏那个 Inbox 图标就是它长出来的）。卸载：`dsh plugin --profile inbox remove @chance722/dsh-inbox`。

## 起服务前后常踩的三件事

- **要先有工作区**：web UI 得有工作区才能建会话，侧栏才会出现；一个工作区都没有时，「添加工作区」弹的是 Windows 原生目录框（自动化驱动不了，得手动点一次）。
- **端口可能被占**：`EADDRINUSE` 说明上一个实例还在跑，而它的 token 只打在启动时的 stdout、不落盘（不带 token 访问是 401）。查占用：`Get-NetTCPConnection -LocalPort 3102 -State Listen | Select-Object OwningProcess`，然后 `Stop-Process -Id <pid>`，或者干脆换个端口。
- **停服务**：就在那个终端里 `Ctrl+C`。
- **抓不到网页标题（微信这类站点）**：先看**我们自称谁**——`dsh-web-fetch-http` 只发 `user-agent` + `accept` 两个头，默认 UA 是 `deepseek-harness/…`，微信按 UA 认客户端，会给这种请求回一个空壳页（HTTP 200、`<title></title>`、正文写着「环境异常，完成验证后即可继续访问」），连 `og:title` 都没有。UA **不能按请求设置**（`WebFetchRequest` 只有 `url`），只能改 profile 的 provider 配置——在 `%DSH_HOME%\profiles\<name>\cordis.patch.yml` 里覆盖那个条目（条目按 `id` 匹配，`config` 是**整体替换**不是深合并）：

  ```yaml
  - id: web-fetch-http
    name: '@deepseek-ai/dsh-web-fetch-http'
    config:
      userAgent: 'Mozilla/5.0 (compatible; dsh-inbox/0.1; +https://github.com/Chance722/dsh-inbox)'
  ```

  实测：这条足以让微信吐真文章（真文章的 `<title>` 依然为空，标题只在 `og:title` 里，所以两件事缺一不可）。`--dump-config | Select-String web-fetch-http -Context 0,4` 可以确认 patch 生效。注意这是**整个 profile 的抓取身份**，模型自己的 web 工具也一起变了。

  **这条 UA 不是通用解**（2026-09-21 实测）：bilibili 的风控对 `Mozilla/5.0 (compatible; ...)` 这个形状几乎必拒（8/8 回「验证码_哔哩哔哩」页；浏览器形状 0/8 被拒、harness 默认 UA 5/8 被拒），而那种拒绝页**带标题**，会被当成链接的名字存进 `linkTitle`。站点拒绝的两种长相、实测矩阵与复查命令见 `docs/help/link-title-fetch.md`。

## 验证模型能调到工具（headless 路线）

**2026-09-20 起用这个配方**（它复现的正是用户真实的组合：插件既是 profile bundle、又由会话 preset 带进来，也就是那个
"域被打开两次"的场景。少了 preset 那一半，`dsh_inbox` 只 open 一次，测试会假通过）：

```powershell
dsh --profile inbox-check --from-default-profile headless --dump-config   # 派生一个 headless profile
dsh plugin --profile inbox-check add <仓库路径>              # ① profile 那半边
# ② 会话那半边：用户级默认 preset 已经是收件箱 preset（init 写过 agent-presets.default），无需额外操作
dsh --profile inbox-check "调用 inbox_status 工具，把它的原始结果原样贴给我。"
# 期望：dsh-inbox v0.1.0: vault open, 7 record(s).
# 顺带验命中：dsh --profile inbox-check "我的个人仓库里有哪些还没看的链接？"（应调用 inbox_search）
```

跑完把临时 profile 删掉（`%DSH_HOME%\profiles\inbox-check`）。**注意** `pnpm build` 之后才会带上最新代码：headless 启动时装载 `lib/`。

早期（还没有 preset 的 M0 阶段）用过 `inbox-m0` 那种"只挂 profile、工具行直接可见"的写法，现在**不足以验证**上面那条双加载场景。

## 在 web 里验证需要 agent preset

用户级 preset 根：`%DSH_HOME%\.agent-presets\<preset-id>\`（**当前这台机器上这个目录还不存在**，要自己建），两个文件：

- `preset.yml` —— `name` / `description` / `order`
- `agent.cordis.yml` —— 组合；把 `profiles\node_modules\@deepseek-ai\dsh-agent-presets\presets\standard\` 整个复制过来，再追加自己的行：

```yaml
- id: dsh-inbox
  name: '@chance722/dsh-inbox'
```

加完 preset 要**重启 dsh**（preset 在启动时扫描）。会话只有为空时才能切 preset。

## 环境上的坑

- **在仓库目录里跑 `npx @chance722/dsh-inbox …` 会报「'dsh-inbox' 不是内部或外部命令」**（2026-09-20 实测）：npm/npx 在项目目录里
  会先判断「本地这个项目是不是就叫这个包」——本仓库的 `package.json` 名字正是 `@chance722/dsh-inbox`，版本也对得上，
  于是它**不装包、直接拿本地那份**，再去 `node_modules\.bin` 找 `dsh-inbox`；而我们从未在仓库里 link 过自己的 bin ⇒ cmd 报错。
  **模拟新用户请先换到中性目录**（`Set-Location $env:TEMP`）；非要在仓库里跑，就用
  `pnpm dlx @chance722/dsh-inbox@<版本> init …` 或 `npm exec --yes --package=@chance722/dsh-inbox@<版本> -- dsh-inbox init …`。
- **刚发布完的几分钟内，pnpm 可能按缓存的 packument 解析 `latest`**（实测 0.2.1 发出后，profile 里看到的仍是 `0.2.0` 的元数据；过一会儿自己就好了）。
  验证刚发的版本时**把版本号写死**：`dsh plugin add @chance722/dsh-inbox@<版本>`、`npx @chance722/dsh-inbox@<版本> …`。
- **一个"新用户"演练的标准姿势**：`$env:DSH_HOME` 指到一个空目录（profiles / presets / settings 全空，等价于新机器），**不碰日常 home**；
  起服务时换端口（`dsh web --no-open --port 3103`）；web UI 建会话要先有工作区（临时 home 是空的，添加工作区会弹原生目录框，得手点一次）。
- **`dsh plugin add` 需要 PATH 上有 pnpm**（2026-09-20 用户实测）：它在 dsh 内部转发给 pnpm，没装 pnpm 的机器会以 cmd 原文报
  `'pnpm' 不是内部或外部命令,也不是可运行的程序`——看着像插件的问题，其实是环境缺件。装 `npm i -g pnpm`（或 `corepack enable pnpm`）即可；
  0.2.2 起 `init` 会**先检查再动手**，并给出这句话。注意 Codex 自己的运行时里那份 pnpm（`.cache\codex-runtimes\...`）**不在用户 PATH 上**，
  所以在沙箱里"跑得通"不代表用户机器上跑得通。

- **构建**：早先的记录写着"esbuild spawn 子进程，沙箱里必 `EPERM`，要提权"。2026-09-20 在这台机器上**沙箱内直接 `pnpm build` 就过了**（`pnpm install` 也过，pnpm 把 store 落在仓库内 `.pnpm-store/`，未跟踪、未 gitignore）。所以先按普通方式跑，真报 `EPERM` 再提权。
- **改完代码怎么生效**（2026-09-20 实测，不是猜的）：

  | 改了什么 | 要做什么 |
  |---|---|
  | `src/client/**`（含 `shared/`） | `pnpm build` 就行，**不用重启**：`dsh-client-hmr` 在 watch 插件的 `lib/client.js`，会调 `clientModules.rebuilt(id)` 并走 SSE 让页面自己重载 |
  | `src/host/**` | `pnpm build` + **重启服务**（宿主半边在启动时装载） |

  验证方式（可复现）：改一句会进 bundle 的字符串 → `pnpm build` → 等约 5 秒 → 请求带 token 的首页，看预加载 combo URL 里的 `&rev=` 变没变（内容哈希，12 位）。实测：改 → `86ac2681f7eb` 变 `216cdfc827d9`；改回 → 变回 `86ac2681f7eb`。

  **坑**：只给某个模块**加一个没人用的导出**再 build，`rev` 不会变——esbuild 的 tree-shaking 把它删了，bundle 字节没变。要探就用会进产物的字符串（这也是 `rg 中文` 搜不到 `lib/client.js` 的原因，中文被转义成 `\uXXXX`）。

- **开发期间不需要重装插件**：profile 里的 `node_modules/@chance722/dsh-inbox` 是指回仓库的 **junction**（`dsh plugin add <仓库路径>` 装的就是这个链接，实测 `Get-FileHash` 两边一致），
  `pnpm build` 改的就是它读的那份产物。只有换机器、换 profile、或改了 `package.json` 里的 `dsh.bundle` / `dsh.client` 声明时才需要再跑一次 `node lib/cli.js init --package <仓库路径>`（可重复运行）。

- **在"线上发布版"和"本仓库"之间来回切**（2026-09-21 起有脚本 `scripts/dev.mjs`）：

  | 命令 | 作用 |
  |---|---|
  | `pnpm dev:status` | 看默认 profile（`web`）现在用哪一侧：`本仓库（…）` 或 `线上包（^0.2.x）` |
  | `pnpm dev:npm` | 切到 npm 上发布的版本（就是"装线上版体验"） |
  | `pnpm dev:local` | 切回**当前仓库**：**先 `pnpm build`** 再 `dsh plugin add <仓库>`——顺序是刻意的，忘了 build 就还在跑上一次的产物 |

  换 profile：加环境变量，`$env:DSH_PROFILE='inbox'; pnpm dev:npm`。切完**重启 dsh**（宿主半边启动时装载；只改 `src/client` 会热更新）。
  实测（临时 profile 与真 `web` profile 各一次）：`dev:npm` → `线上包（^0.2.4）`、`dev:local` → `本仓库（D:/Workspace/dsh-inbox）`，两个方向都对。

  **为什么 `dev:npm` 不是简单的 `dsh plugin add <包名>`（2026-09-21 踩到的两个 pnpm 行为）**：

  1. **只写包名 = 什么都不做**。当前依赖是 `link:…`，而那个目录的 `package.json` 名字正是 `@chance722/dsh-inbox`，
     pnpm 认为这个名字已经有解析结果，回一句 `Already up to date` 就结束了（实测：`dev:status` 依旧是"本仓库"）。
     要它去 registry 取，必须给显式说明符：`@chance722/dsh-inbox@latest`。
  2. **带 `@latest` 也可能 `EPERM`**。profile 用的是 pnpm 的 **hoisted** 链接器（profile 自己的 `pnpm-workspace.yaml` 里
     `nodeLinker: hoisted`），而"把 link 换成 registry 包"时 pnpm 会去**仓库的** `node_modules/.pnpm/…` 里建符号链接
     ⇒ Windows 上 `ERR_PNPM_EPERM: symlink ...`，而且失败后依赖行会被 `remove` 掉、链接却还留着（危险中间态）。

  所以 `dev:npm` 的顺序是：**`dsh plugin remove` → 摘掉 `node_modules/@scope/name` 那个链接（只删链接，不动仓库）→
  `dsh plugin add <包名>@latest`**。`dev:local` 方向不需要这套：`pnpm add <仓库路径>` 会直接把版本行改回 `link:`。
  真机结果：`dev:npm` → 依赖 `^0.2.4`、`node_modules/@chance722/dsh-inbox` 是**实体目录**（版本 0.2.4）；
  `dev:local` → 依赖回到 `link:D:/Workspace/dsh-inbox`、node_modules 是 **Junction**；`dsh.profile.bundles` 三行完好。
  细节：pnpm 的 `minimumReleaseAge` 会把"刚发布的版本"写进 profile 的 `pnpm-workspace.yaml` 白名单（实测装 0.2.4 时自动加了一行），所以发布完可以立刻 `dev:npm`。

  3. **`@latest` 会被"太新"策略静默降级**（2026-09-21 第二个坑）。pnpm 的供应链策略里有
     `minimumReleaseAge`（刚发布的版本先别装），而它遇到这种版本**不报错、直接装上一个允许的版本**：
     实测 0.2.5 已发布的情况下，`pnpm add @chance722/dsh-inbox@latest` 依然装回 0.2.4，一句提示都没有
     （profile 的 `pnpm-workspace.yaml` 里那行 `minimumReleaseAgeExclude` 只写了 0.2.4）。
     用**确切版本**去装就正常：pnpm 会把该版本追加进 `minimumReleaseAgeExclude` 然后照装。
     所以 `dev:npm` 先 `npm view <包名> version` 拿 registry 上真正的 latest，再 `add <包名>@<那个版本>`；
     取不到才退回 `@latest`。

  4. **`dev:status` 同时报"范围"和"实际版本"**：`profile「web」：线上包（^0.2.5），装的是 v0.2.5`。
     只报范围会误导——用户看到 `^0.2.4` 就以为装的是 0.2.5（范围里允许，不代表 lockfile 里解析到）。
