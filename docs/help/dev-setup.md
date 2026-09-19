# 本地开发与验收流程

`@duoyu/dsh-inbox` 是 dsh 插件，**必须装进一个 dsh profile 才能跑**。本机 dsh 安装在 `C:\Users\hands\.dsh\profiles\node_modules\@deepseek-ai\dsh`，用 Node 22（`C:\Users\hands\AppData\Local\nvm\v22.22.3\node.exe`）运行。

## 命令

```powershell
$node = 'C:\Users\hands\AppData\Local\nvm\v22.22.3\node.exe'
$dsh  = 'C:\Users\hands\.dsh\profiles\node_modules\@deepseek-ai\dsh\lib\bin.js'

# 构建 + 校验（在仓库根）
pnpm build          # esbuild → lib/index.js + lib/client.js
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
```

## 隔离开发 profile

```powershell
# 首次：从 web 模板派生一个自己的 profile（不动原来的 web profile）
& $node $dsh --profile inbox --from-default-profile web --dump-config

# 挂载本仓库（link 安装，改完重新 build 即可生效）
& $node $dsh plugin --profile inbox add 'C:\Duoyu\dsh-inbox'

# 起服务（换端口避免和日常使用的 3080 冲突）
& $node $dsh --profile inbox --no-open --port 3102
```

浏览器打开打印出来的带 token 的 URL，左栏应出现「全局面板 → Inbox」，点击即切到插件页面。

## 验证模型能调到工具（headless 路线）

web profile 的工具行由 agent preset 接管，最省事的验证是另开一个 headless 派生 profile——它没有 agent-presets，工具行直接对模型可见：

```powershell
& $node $dsh --profile inbox-m0 --from-default-profile headless --dump-config
& $node $dsh plugin --profile inbox-m0 add 'C:\Duoyu\dsh-inbox'
& $node $dsh --profile inbox-m0 "Call the inbox_status tool and paste its raw result."
```

## 在 web 里验证需要 agent preset

用户级 preset 根：`C:\Users\hands\.dsh\.agent-presets\<preset-id>\`，两个文件：

- `preset.yml` —— `name` / `description` / `order`
- `agent.cordis.yml` —— 组合；把 `profiles\node_modules\@deepseek-ai\dsh-agent-presets\presets\standard\` 整个复制过来，再追加自己的行：

```yaml
- id: dsh-inbox
  name: '@duoyu/dsh-inbox'
```

加完 preset 要**重启 dsh**（preset 在启动时扫描）。会话只有为空时才能切 preset。

## 环境上的两个坑

- **构建需要提权**：esbuild 会 spawn 子进程，在 Codex 沙箱里直接 `EPERM`，必须带 `require_escalated` 跑构建。
- **改完客户端代码要重新 build**：`dsh plugin add` 用的是 link 依赖，但浏览器加载的是 `lib/client.js`，源码改了不构建等于没改。构建后重载页面即可（HMR 也会跟进，但重启一次最干净）。
