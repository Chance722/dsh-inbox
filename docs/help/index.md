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
| 同步机制（推/拉/合并） | `sync.md` | 三种触发、推什么、按 `id`+`updatedAt` 合并的规则、加密边界、出错的排查表、还没做的四件事 |
| 面板 UI 的视觉/几何验证 | `ui-visual-check.md` | 真机 token 拿不到时，用 headless Chrome 量列宽与"能否放一行" |
| 面板主题（深色/浅色） | `panel-theme.md` | 怎么问出宿主的配色方案、三个反色坑、镜像页的五个场景 |

## 维护记录

| 时间 | 维护时 HEAD | 变更摘要 |
|---|---|---|
| 2026-09-20 | `c2e621a` | M7 第二十九步：**拉取合并落地**——`remote/merge.ts` 只读 `sync/items/<uuid>.json`，按 `id` 对齐、`updatedAt` 判胜负（新的赢、无冲突副本），经新加的 `Vault.import`/`importAttachment` **原样导入**（保 id/createdAt/updatedAt，否则两边永远互相覆盖）；缺的附件按 `.meta.json` + `<id>.<ext>` 拉下来，走 dsh 附件准入，**远端行 id 保留、本机 storeId 新分配**；挂进 `runPull` ⇒ 启动/刷新/立即同步/立即拉取都会合并，`PullResult` 加 `merged`/`attachments`。真机往返：存→推→删→**清空回收站**→拉取 `merged:1`→记录回来。**新后果**：清空回收站目前只删本地，下一次拉取会把它合并回来（软删墓碑是同步的，清空不是）——这正是下一步"远端删除"。新增知识文档 **`docs/help/sync.md`**（触发/推什么/合并规则/加密边界/排查表/还没做的四件），README 中英加「远端长什么样」表 |
| 2026-09-20 | `847c9e0` | M7 第三十步：**远端删除落地**——新建 `remote/writer.ts`（设置+凭据 → 可写可删的远端 + sync 根，推送/合并/删除共用）与 `remote/remove.ts`（**定向**删除，绝不 sweep）；两个协议各加删除原语（S3 `deleteObject` 签名 DELETE、WebDAV `deleteFile`，404 当成功）。清空回收站现在连云端一起删：`items/<id>.json`、`.txt`、以及**只被它引用**的附件字节/`.meta.json`/**改名前那个无扩展名的旧名字**（推送时对旧名盲删，一次「全部重传」清完孤儿，真机 26→24 个对象）。拉取游标改为**推进到最新成功条目**，失败条目会被重试。**真机逮到两个上一轮的 bug**：推送的附件行漏了 `createdAt`，而域读取校验 ⇒ **一条坏记录让 `Vault.open` 失败**（面板全报"仓库还没打开"）——已补字段，并让 `Vault.import`/`importAttachment` **用域自己的 schema 校验后再写**（坏对象变成合并报告一行）；用户仓库里那条坏行已原地修复（旁边留 `.broken-backup`）。真机：文本记录 `remoteRemoved:2`、带图记录 `remoteRemoved:5`、清单 28→24；测试痕迹已从本地与云端清干净（本地 7 条 / 远端 22 对象） |
| 2026-09-20 | `e6afaee` | M7 第三十一步：**自动推送 + 界面减负 + 使用手册**——`remote/auto-push.ts`（进程级防抖 5s、`unref`，挂 capture/update/delete/restore 与 `/inbox`；**purge 不挂**，它已就地删远端；失败静默，真机：只存一条、不点任何按钮，8 秒后云端多出该记录的 `.json`+`.txt`）。配置面板只剩 **保存 + 自检**：删「立即同步/立即拉取」（与「刷新」重复），**「全部重传」移出 UI、接口保留**（`push` 带 `all: true`，属修故障手段）；**「刷新」升级为一次完整同步**（先推→再拉（含合并）→重读列表）。新增 **`src/client/manual.tsx`**：设置旁「使用手册」弹窗，7 节场景化说明（存/翻/名字来源/密钥/同步/对话取回/排障），每节 ≤3 行。顺手把桶与仓库逐对象对齐：6 记录×2 + 2 附件×2 + 4 占位 = `inbox/` 下 20 个，加根目录用户自传的 `IMG_0001.jpg` = 23，**没有丢东西**（此前"22"是我把记录数记成 7） |
| 2026-09-20 | `d402da1` | M7 第三十二步：**手册弹窗收进屏幕 + 口径修正**——卡片固定 `560px`（`box-sizing: border-box`，否则实测 562 且比 92vh 多 1–2px）、`maxHeight: 92vh`、标题行固定、**内容区自己滚动**（镜像页实测 560×505 / 视口 549，内容 524>450）；去掉按钮上的 `?`；删「云端长什么样」「想全量重传」两行；第 6 节改成"在对话里问助手"，并补上关键事实：**工具要在 dsh 的 agent preset 里挂上插件才对助手可见**（M8 的 `init` 自动化）。新增 **`test/manual.test.ts`**（3 条：不得出现 Codex/skill、必须写明 preset、渲染文本不得有 markdown 星号）。**实查**：这台机器 `~/.dsh/.agent-presets` 不存在、内置 standard preset 也没有本插件 ⇒ 用户会话里助手目前看不到 `inbox_search`/`inbox_get`（正是他问"我咋不知道这个用法"的原因）；挂 preset 留给 M8 的 `init`，已问用户是否现在就挂 |
| 2026-09-20 | `4bdca64` | **M8 开工（第三十三步）**：新增 `src/cli.ts` → `lib/cli.js`（`bin: dsh-inbox`，`npx @duoyu/dsh-inbox init`），一条命令做三件事且可重复运行：① `dsh plugin add` 装进 profile；② **复制** dsh 自带的 `standard` preset 到 `<DSH_HOME>/.agent-presets/<id>/`（改 `preset.yml` 的 name/description、**追加**插件行，绝不改随附原件）——AGENTS 第 2 条"工具必须挂进 preset"的自动化；③ 在 `settings.yaml` 写 `agent-presets.default`（**先备份、值没变就不写**）。`package.json` 可发布（`private:false`/`0.1.0`/`bin`/`files`），README 中英「安装/卸载/开发」按一条命令重写。真机走通（含幂等）；**剩**：新会话里让模型真调到工具。同时按用户意见清掉手册里的行话（「墓碑」改成大白话）、Codex/skill/M8/`init` 字样，`manual.test.ts` 升级为"出现 M8/init 也算失败"。另记：**助手把"我的收件箱"对上仓库靠的是工具描述**（`inbox_search` 的描述写明"the user's local dsh-inbox vault"与"whenever they ask what they saved"） |

> 表内哈希在 **2026-09-20** 因替换作者邮箱重写过一次历史（内容未变、tree 一致）后按新提交更新了最后一行；更早几行的短 id 是重写前的旧 id，只作历史记录，不再能直接 git show。dev-bus 正文里的旧短 id 同理。

> 锚点必须是**已提交的 HEAD**；每次维护最多保留 5 条。
