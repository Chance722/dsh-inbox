# 开发总线

项目：`@duoyu/dsh-inbox`
原则：**一次只推进一个模块，每个模块有可验证的验收标准，验收记录留在本文件末尾。每个模块收尾必须同步更新 README（中英双份）的「安装 / 卸载 / 开发 / 当前可用功能」四节**——用户看的是 README，不是本文件。

状态图例：`未开始` / `进行中` / `待验收` / `已验收` / `阻塞`

| # | 模块 | 目标 | 验收标准 | 状态 |
|---|---|---|---|---|
| M0 | 插件骨架 spike | 打掉最大不确定性：第三方插件到底能不能长出 UI 和工具 | ① `dsh --profile inbox` 起得来；② 左栏出现 Inbox 图标，点开是占满主区域的页面；③ 对话里模型能调用一个最小工具并拿到结果；④ 实测到的真实 API 形态回写 `docs/help/dsh-plugin-platform.md` | 已验收 |
| M1 | 数据模型与存储 | 仓库的持久层 | SQLite schema（items / attachments / tags / sync_state）+ CRUD + 关键词查询；vitest 单测全绿；库文件落在 DSH_HOME 下 | 未开始 |
| M2 | 捕获入库 | 东西进得来 | 面板粘贴/拖拽文本、图片、链接各一条能入库；聊天框前缀转存能入库；重复项按规则合并 | 未开始 |
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
