# 上架 DSH STORE：两条门禁、滚动三版窗口、只联系一次

DSH STORE（<https://dsh.store/>，仓库 `AI-Scarlett/DSH-Store`）是第三方插件市场。它把每个插件**钉在一个 40 位
commit** 上，每八小时重读**默认分支当前 HEAD**，判据全在公开的
[`registry/README.md`](https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/README.md) 与
`scripts/check-plugin-submission.mjs` 里。

本包 2026-09-21 收到过一次「作者修复请求」（[#1009](https://github.com/AI-Scarlett/DSH-Store/issues/1009)），
原因是两条：patch 文件里出现了绑定官方命名空间的 `name:`，manifest 里没有逐版本的精确兼容声明。
两条都在 **0.2.13** 修掉。本文记这两条机制、为什么那样修是等价的、以及每次 dsh 发版后要做什么。

## 一句话结论

- 门禁一是**纯文本正则**（`patchEntryIds()`），不看 YAML 语义：patch 文件里只要出现
  `name: '@deepseek-ai/…'`（**注释里也算**）就 `SUBMISSION_PATCH_PROTECTED` 拒掉。
- 门禁二看 `package.json` 的 `dsh.compatibility.dshReleases`：**窗口里至少一个精确 `compatible`**，
  否则已上架的自动 `unlisted`、还没上架的候选**直接从候选库删除**（我们就是被删的那个）。
- 通知**一个人一辈子只发一次**（按 GitHub 数字用户 ID 全局去重）⇒ **没消息 ≠ 已修好**，得自己看商城状态。
- 候选一旦被删（pruned）**不会自动恢复**：要么等自动雷达重新发现，要么重新提交上架申请。

## 门禁一：patch 是当文本扫的

`scripts/check-plugin-submission.mjs` 的 `patchEntryIds()`（2026-10-04 抄录）：

```js
if (/\bname:\s*['"]?@deepseek-ai\//i.test(patch)) {
  throw submissionError('SUBMISSION_PATCH_PROTECTED', 'Bundle Patch impersonates the protected @deepseek-ai namespace')
}
if (/@deepseek-ai\//.test(patch) && /disabled:\s*true/i.test(patch)) {
  throw submissionError('SUBMISSION_PATCH_PROTECTED', 'Bundle Patch appears to disable an official component')
}
```

受保护的 entry ID 只有两个：`ui-settings-plugin-inventory`、`dsh-safe-plugin-manager`。
`- id:` 的收集用一条正则做，多个 id 合法——**踩第一条的是 `name:`，不是 `id`**。

我们原来那行是给官方 `web-fetch-http` 那一行覆盖 UA（见 `link-title-fetch.md`），写法本身是 dsh 支持的
合法用法，但商店一律按「冒用官方命名空间」拒。

### 为什么删掉 `name:` 是等价的（读的是 loader 源码，不是猜）

`@deepseek-ai/dsh-app-boot` 的 `applyEntryPatches()`（本机 0.1.5-rc.2 的
`profiles/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js`，约 59–104 行）：

```js
const { id, insert, name, ...overrides } = patch
...
if (!id) warn('patch: id is required for non-insert patches')
const target = entryMap.get(id)                              // 只按 id 找行
if (!target) warn('patch: entry %C not found'), continue      // 找不到就跳过，永不新建
if (name && name !== target.name) warn('… name mismatch'), continue   // name 只是可选护栏
for (const [key, value] of Object.entries(overrides)) target[key] = value
```

三条要记住的：

1. 非 `insert` 的 patch **只需要 `id`**；`name` 是可选断言，不写就没有那道护栏。
2. patch **永远不建行**：找不到目标就警告并跳过 ⇒ 去掉 `name` 不会「不小心建出」一行。
3. `config` 是**整体替换**，不是深合并：覆盖官方行时只写你要的键（其余靠该插件的 schema 默认）。
   `dsh-base/cordis.patch.yml` 里那行本来就没有 `config`，所以这里没有丢东西。

失败结果与跳过是同一个：`name` 不匹配、id 找不到，都是 warning + skip。所以在删掉那一行前后，
**运行时行为逐字相同**（`docs/help/link-title-fetch.md` 里那套实测矩阵仍然成立）。

## 门禁二：滚动三版窗口 + 精确 `dshReleases`

窗口的算法写在契约里：官方 npm `@deepseek-ai/dsh` 的 **`latest` 标签 + 它之前最近两个未弃用发行版**
（按发布时间，不是 SemVer 排序）。2026-10-04 实测：

| npm dist-tag | 版本 | 发布时间 |
|---|---|---|
| `latest` / `next` | `0.2.0-rc.2` | 2026-09-29 |
| `alpha` | `0.2.1-alpha.1` | 2026-10-03 |

⇒ 按「latest 及其之前两个」算，窗口是 `0.2.0-rc.2` / `0.2.0-rc.1` / `0.1.7-rc.2`；
2026-09-21 那轮窗口是 `0.1.5-rc.2` / `0.1.6-alpha.1` / `0.1.6-alpha.2`（所以通知里列的是它们）。
两种可能的读法（含不含 `latest` **之后**发布的 `alpha`）里 `0.2.0-rc.2` 都在窗口内，所以我们的
那一个 `compatible` 两边都站得住。

规则：

- `approved` 条目在窗口里**至少一个精确 `compatible`**；三个都 `incompatible`/`unknown`/缺失 → 自动 `unlisted`。
- 候选（还没上架）：**已有别的确定性门禁失败 + 没有任何精确 `compatible`** → 直接从候选库删除。
- 形状，写在 manifest 的 `dsh` 字段里（`dsh.bundle` 的邻居）：

```json
"compatibility": {
  "dsh": "^0.1.5-rc.2 || ^0.2.0-rc.2",
  "dshReleases": { "0.2.0-rc.2": "compatible", "0.1.7-rc.2": "unknown" }
}
```

- 键必须是**完整 SemVer**（`0.1.1-rc.2` 这种）；历史别名 `rc.7`/`rc.8` 只对商店里已有条目放开。
  值只接受 `compatible` / `incompatible` / `unknown`；没写的版本商店自己记 `unknown`。
- **范围不算证据**：`peerDependencies` 是 dsh 自己的安装门禁（另一套机制，见
  `dsh-plugin-platform.md`），商店的兼容性看的是这张逐版本表。两处必须一致：`dsh.compatibility.dsh`
  写的就是 peer 区间——`test/bundle-patch-contract.test.ts` 会比对。
- `engines.node` 也会被读进去当 Node 范围（本包 `>=22`，与 README 的前置条件一致）。
- **不要为了「如实」写 `package.json.os`**：那会让 npm / pnpm 在别的系统上**直接拒绝安装**，
  而「没在 macOS/Linux 验过」不等于「不支持」。范围那句话写在 README 里就够。

## 通知与状态机：一次就是全部

- 主动联系按 **GitHub 数字用户 ID 全局去重，一个人跨所有仓库仅一次**，永久；修复、改版、重新提交、
  改名都不恢复名额。所以收不到第二次通知是正常的，别把「没消息」读成「已过期」。
- 状态词：候选侧 `reviewing`（还会复检）/ `rejected` / **pruned（已删除，不自动恢复）**；
  上架侧 `approved` / `unlisted`（商城隐藏，已装用户不受影响）/ `blocked`。
- 复检**不执行**第三方的 `install` / `prepare` / `build` / `test`，只读固定源码。
- 修复并 push 到默认分支后，八小时那一轮会读新的 HEAD；但 pruned 的候选已经不在候选库里，
  想重新上架要重新提交申请表（或在雷达重新发现它之前自己提交）。

## 每次 dsh 发版后要做的（本包维护清单）

1. 看窗口：`curl -sS https://registry.npmjs.org/@deepseek-ai/dsh` 的 `dist-tags.latest` 与 `time`，
   取 `latest` 及其之前两个未弃用发行版。
2. 在 `package.json` 的 `dsh.compatibility.dshReleases` 里补这一版；**保证窗口里至少一个 `compatible`**。
   没实测过的写 `unknown`，别把「范围覆盖」写成「兼容」。
3. `pnpm test`：`test/bundle-patch-contract.test.ts` 会拦下不合法的键/取值、patch 里的官方 `name:` 绑定，
   以及「声明了 compatible 却没有」这类回退。
4. 提 SemVer + `pnpm build`（版本号烤进 `lib/`）+ push：自动化只读默认分支 HEAD。

## 还没做的 / 未验证（别当成已通过）

- **重新上架还没做**：候选是 pruned，不是 reviewing。要重新提交上架申请才会回到扫描链里。
- **`dshOperations`（逐版本的 install/start/uninstall 证据）没有声明**：本包没有「一次性 profile 的
  安装→启动→卸载」运行验收记录，商店那边保持 `unknown`。要升这一档得真在干净 profile 上跑一遍并记下
  commit 与时间。
- **自动 `source-verified` 通道要求「无生命周期脚本和运行依赖」**：本包有 `lucide-react` + `zod`
  两个 `dependencies`，大概率只能走 `user-reviewed`。这条只从契约原文读到，**没实测**。
- 我们**没有跑过商店的脚本本体**（它要在对方的 CI 里跑）；本仓库的等价物是那条测试 + 手工比对正则。

## 证据

- 契约：<https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/README.md>
- 预检脚本：`scripts/check-plugin-submission.mjs`（`patchEntryIds()` / `inferredCompatibility()`）
- 通告单：#1009（2026-09-21 15:02 UTC 建，open，0 评论），原因原文
  `SUBMISSION_PATCH_PROTECTED: Bundle Patch impersonates the protected @deepseek-ai namespace;
  no exact compatible declaration for official DSH releases 0.1.5-rc.2, 0.1.6-alpha.1, 0.1.6-alpha.2`
- 本包失败时钉的 commit：`a5f7a5229979`（v0.2.8，2026-09-21）
- 2026-10-04 复查商店侧：`registry/catalog.json`、`catalog-index.json`、`candidates.json` 里都没有
  `Chance722` ⇒ 既不在目录、也不在候选库
- loader 语义：`@deepseek-ai/dsh-app-boot` `applyEntryPatches()`（0.1.5-rc.2）
