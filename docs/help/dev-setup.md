# 本地开发与验收流程

`@duoyu/dsh-inbox` 是 dsh 插件，**必须装进一个 dsh profile 才能跑**。

## 当前这台机器（2026-09-20 实测，取代旧的 `C:\Users\hands\...` 记录）

| 项 | 值 |
|---|---|
| 仓库 | `D:\Workspace\dsh-inbox` |
| `DSH_HOME` | `%DSH_HOME%`（profiles / storages / sessions 都在这里） |
| Node | `v22.22.2`，即 `C:\nvm4w\nodejs\node.exe`（机器级 `NVM_SYMLINK=C:\nvm4w\nodejs`） |
| dsh CLI | `0.1.5-rc.2`，npm 全局装在 `C:\nvm4w\nodejs\node_modules\@deepseek-ai\dsh`；`dsh` / `dsh.cmd` / `dsh.ps1` 落在 `C:\nvm4w\nodejs` ⇒ **已经在 PATH 上**，直接敲 `dsh` |
| PATH 没配好时 | `node C:\nvm4w\nodejs\node_modules\@deepseek-ai\dsh\lib\bin.js <参数>` |

## 命令

```powershell
cd D:\Workspace\dsh-inbox
pnpm build          # esbuild → lib/index.js + lib/client.js
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
```

> 旧记录里 `C:\Users\hands\.dsh\...`、`C:\Duoyu\dsh-inbox` 是上一台开发机的路径，与当前机器无关。

## 隔离开发 profile

```powershell
# 首次：从 web 模板派生一个自己的 profile（不动原来的 web profile）
dsh --profile inbox --from-default-profile web --dump-config

# 挂载本仓库（link 安装，改完重新 build 即可生效）
dsh plugin --profile inbox add D:\Workspace\dsh-inbox

# 起服务（换端口避免和日常使用的 3080 冲突）
dsh --profile inbox --no-open --port 3102
```

浏览器打开打印出来的带 token 的 URL，左栏应出现「全局面板 → Inbox」，点击即切到插件页面。

**为什么第一步不能省**：`dsh plugin --profile <name>` 在 profile 还不存在时会**自动初始化**它，用的却是 `DEFAULT_PROFILE_BUNDLES = ["@deepseek-ai/dsh-base"]`——只有 base，**没有 web 应用**，起来就不是浏览器 UI。所以"先派生 web 模板、再 add 插件"这个顺序是必需的（`--from-default-profile` 遇到已存在的 profile 会直接报错，不会覆盖）。

**插件是怎么挂上去的**：一个 profile 就是 `%DSH_HOME%\profiles\<name>\` 下的一个小包——`package.json` 的 `dsh.profile.bundles` 决定这个 profile 装哪些 bundle，`cordis.patch.yml` 是用户层。`plugin add` 在那个目录里把参数转发给 pnpm，把本仓库作为 **link 依赖**装进去，再把 `@duoyu/dsh-inbox` 追加进 `dsh.profile.bundles`。插件自己声明了两个半边：`dsh.bundle.patch`（宿主侧 Cordis patch，工具/存储/HTTP 路由都在这边）和 `dsh.client`（浏览器侧，`platform: web`，产物 `lib/client.js`，侧栏那个 Inbox 图标就是它长出来的）。卸载：`dsh plugin --profile inbox remove @duoyu/dsh-inbox`。

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

## 验证模型能调到工具（headless 路线）

**2026-09-20 起用这个配方**（它复现的正是用户真实的组合：插件既是 profile bundle、又由会话 preset 带进来，也就是那个
"域被打开两次"的场景。少了 preset 那一半，`dsh_inbox` 只 open 一次，测试会假通过）：

```powershell
dsh --profile inbox-check --from-default-profile headless --dump-config   # 派生一个 headless profile
dsh plugin --profile inbox-check add D:\Workspace\dsh-inbox              # ① profile 那半边
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
  name: '@duoyu/dsh-inbox'
```

加完 preset 要**重启 dsh**（preset 在启动时扫描）。会话只有为空时才能切 preset。

## 环境上的坑

- **构建**：早先的记录写着"esbuild spawn 子进程，沙箱里必 `EPERM`，要提权"。2026-09-20 在这台机器上**沙箱内直接 `pnpm build` 就过了**（`pnpm install` 也过，pnpm 把 store 落在仓库内 `.pnpm-store/`，未跟踪、未 gitignore）。所以先按普通方式跑，真报 `EPERM` 再提权。
- **改完代码怎么生效**（2026-09-20 实测，不是猜的）：

  | 改了什么 | 要做什么 |
  |---|---|
  | `src/client/**`（含 `shared/`） | `pnpm build` 就行，**不用重启**：`dsh-client-hmr` 在 watch 插件的 `lib/client.js`，会调 `clientModules.rebuilt(id)` 并走 SSE 让页面自己重载 |
  | `src/host/**` | `pnpm build` + **重启服务**（宿主半边在启动时装载） |

  验证方式（可复现）：改一句会进 bundle 的字符串 → `pnpm build` → 等约 5 秒 → 请求带 token 的首页，看预加载 combo URL 里的 `&rev=` 变没变（内容哈希，12 位）。实测：改 → `86ac2681f7eb` 变 `216cdfc827d9`；改回 → 变回 `86ac2681f7eb`。

  **坑**：只给某个模块**加一个没人用的导出**再 build，`rev` 不会变——esbuild 的 tree-shaking 把它删了，bundle 字节没变。要探就用会进产物的字符串（这也是 `rg 中文` 搜不到 `lib/client.js` 的原因，中文被转义成 `\uXXXX`）。

- **开发期间不需要重装插件**：profile 里的 `node_modules/@duoyu/dsh-inbox` 是指回仓库的 **junction**（`dsh plugin add <仓库路径>` 装的就是这个链接，实测 `Get-FileHash` 两边一致），
  `pnpm build` 改的就是它读的那份产物。只有换机器、换 profile、或改了 `package.json` 里的 `dsh.bundle` / `dsh.client` 声明时才需要再跑一次 `node lib/cli.js init --package <仓库路径>`（可重复运行）。
