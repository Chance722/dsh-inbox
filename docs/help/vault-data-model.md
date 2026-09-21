# 仓库数据模型

M1 定下来的东西。改这个模型 = 改领域版本号 + 写迁移，别当普通重构做。

## 存在哪

走官方存储栈，**不自己开文件或数据库**：

```yaml
# dsh-base 已经挂好，我们一行都不用加
- id: storage-json    config: { root: ~/.dsh/storages }
- id: storage-domain  config: { backend: json }
```

域名叫 `dsh_inbox`（`defineDomain` 强制 `/^[a-z][a-z0-9_]*$/`，连字符不行），所以数据落在 `~/.dsh/storages/dsh_inbox/`。库为空时不落盘，第一次写入才物化。

## 布局：per-record

一个 item 一个文档。理由有两条，都是给个人仓库用的：写入只改被改的那一条；单条文档损坏不会拖垮整个库。

默认的"坏记录让整个 open 失败"行为**保留**（`invalidRecords` 不设 `backup-and-skip`），因为这是权威用户数据——静默跳过等于把问题藏起来。schema 只做加法演进时走 `compatibleVersions`。

## 词汇表（7 类）

| 维度 | 取值 | 说明 |
|---|---|---|
| `kind` | `text` / `link` / `image` / `file` | 这条东西**物理上**是什么 |
| `category` | `idea` / `article` / `media` / `image` / `document` / `secret` / `other` | 我们**怎么归类**它 |
| 标记 | `watchLater?: boolean` | 唯一的进度标记「待看」，用户自己打；**域 v3 起 `status: unread/read` 作废**（它声称知道软件不可能知道的事） |
| `source` | `panel` / `chat` / `webdav` / `import` | 从哪个口进来的 |

`kind` 和 `category` 分开是刻意的：一张粘进来的图，`kind` 永远是 `image`，但 `category` 可能是 `image` 也可能是 `document`（证件）。链接同理：`kind=link`，`category` 是 `article` / `media` / `other`。平台（bilibili/wechat/zhihu/…）和来源是**标签与字段**，不是类目。

## 记录结构

`items`：`id` / `kind` / `category` / `source` / `createdAt` / `updatedAt` / 可选 `title` / `linkTitle` / `linkTitleError` / `text` / `url` / `platform` / `note` / `watchLater` / `categorySource` / `deletedAt` / `tags[]` / `attachmentIds[]`。

版本演进（每次都只加可选字段，所以老记录永远还能通过校验，这正是 `compatibleVersions` 担保的东西）：

| 版本 | 加了什么 | 为什么 |
|---|---|---|
| 2 | `categorySource` | 记录类目是谁定的。优先级 **user > model > rule**——用户改过就标 `user`，谁也覆盖不了 |
| 3 | `watchLater` | 取代 `status: unread/read`；`待看` 标签在迁移里被摘掉 |
| 4 | `linkTitle` | 抓来的页面标题（`<title>`）。**与 `title` 分开**：`title` 只能是用户的字（AGENTS.md 3 那条不变式），自动抓取的东西放自己的字段，两者不会互相冒充 |
| 5 | `linkTitleError` | 抓标题失败的原因码（`no-title` / `http:404` / `not-html:text` / `network:…`）。存在的理由只有一个：**静默失败会被当成功能坏了**，详情里要能说出一句话；成功时清空 |
| 6 | `secret` / `secretDigest` | 账密**正文**从 `text` 搬进 `secret`（AES-256-GCM 信封 `v1:iv:tag:ct`），`secretDigest` 是 HMAC-SHA256 的判重摘要。`global.master` 同时记录 salt + KDF 参数 + verifier（verifier 只是 seal 过的固定字符串，**不存密码、不存密钥**） |
| 7 | `global.sync.lastPushAt` | 增量推送的游标（推什么、什么时候推见 `sync.md`）。只加一个 global 字段，记录形状没动 |
| 8 | 新表 `graves` | **清空回收站留下的墓碑**：`{ id, purgedAt }`，没有正文、没有附件、没有别的字段。理由是同步绕不开的一个洞——清空之后本机什么都不留，云端（尤其是「同时合并别的同步目录」打开时另一棵老树）那份副本没有任何**本地**东西压得住，于是每次启动拉取都把它重新塞回回收站（2026-09-21 实测：13 条，重启一次回来一次）。merge 拿 `purgedAt` 比一次：**不比它新**的副本一律不进来，真被别的设备改过（更新）的仍然按 `updatedAt` 规则赢 |

- 加密模型：密钥由主密码 scrypt 派生（N=2^15/r=8/p=1），**主密码与密钥都不落盘**，只在进程内存里 ⇒ 服务重启即锁定，界面显式解锁。没有密钥时**拒绝捕获账密**（不回退明文）；老明文记录在首次设置/解锁时自动转密文。所谓"加密落盘"只覆盖账密的**正文**：备注、类目、标签、时间与附件字节都不在内（见 README 的「加密的边界」）。

- `note` 是**用户追加的备注**——按产品决策，它一旦存在就是权威分类来源，模型不许覆盖；列表标题只在记录没有别的名字时才用它兜底。
- `title`（用户命名）> `linkTitle`（抓来的页面标题）> URL / 正文 / 文件名 / 备注：这是界面取名字的顺序，规则只写在 `src/client/heading.ts`。
- 正文和图片**不进域**，域里只放元数据 + `attachmentIds` 引用；大内容按内容哈希存文件（M2 落地）。

`attachments`：`id`（我们自己生成的 UUID，**记录 key 必须路径安全**）/ `storeId`（dsh 的附件 id，形如 `sha256:<hex>`，带冒号所以不能当 key）/ `mime` / `bytes` / `createdAt` / 可选 `filename` / `width` / `height` / `sha256`（通用文件才有）。

判重找的是 `storeId`，所以不要把 store id 和我们的 key 混用——这是 M2 端到端才暴露的坑（见 dev-bus 的 M2 记录）。

`global.sync`：`{ lastPullAt?, cursor? }`，M6 的 WebDAV 单向摄取用。

`graves`：`{ id, purgedAt }`——**清空回收站**（不是软删）时写下的一条，语义是"这个 id 我扔了"。
它是 merge 唯一会读它的一张表，也只用来回答一个问题：云端拿来一条本机没有的记录时，是不是比当初清空的时刻**更新**
（不新就不收）。它是**本机事实**，不上云、不同步：别的设备各自记自己的。**这张表不做清理**（刻意的，见 `sync.md`）：
删掉一条墓碑，那条老副本下一次拉取就进来了。

## 查询语义

官方的域是 KV，**没有查询语言**，所以筛选是内存里的一次遍历（`src/host/vault/query.ts`，纯函数、无存储依赖）。规则：

- `text`：对 `title` / `text` / `url` / `note` / `tags` 做大小写不敏感的子串匹配；空白串等于不过滤
- `categories` / `kinds` / `statuses`：**同字段内是 OR**
- `tags`：**列出的每个都要命中**（AND）
- 不同字段之间是 AND
- 软删记录默认排除，`includeDeleted: true` 才带上
- 排序固定 `createdAt` 倒序（同秒用 id 兜底保证确定性），`limit` / `offset` 在排序**之后**生效

这个规模（千级）下，遍历比建索引更划算：没有索引要维护，没有迁移要跑。

## 软删与恢复

删除只写 `deletedAt`，字节留着；恢复就是把这个字段摘掉。回收站因此不需要第二张表。

M3 起「清空回收站」会**真删记录**：连同该记录的 `attachments` 行一起删除（仍被别的记录引用的附件行会保留）。但要说清楚边界——**附件的字节仍然留在 dsh 自己的附件仓库里**（`<DSH_HOME>/attachments/v1`，内容寻址、永不自动删除）。那是 dsh 的策略，不归我们的插件管；面板上的确认框也照实写了这一点。所以「彻底抹掉一张证件照」目前做不到，M6 之后可以考虑加一个「连字节一起清」的选项。

同一次清空还会写下 `graves` 里那条 `{ id, purgedAt }`（域 v8，2026-09-21）。本机记录、附件行、我们自己那棵同步树里的对象都真的没了，
留下的只有一个 id 和时刻——这是"清空"能扛住下一次拉取的原因，细节与实测数字见 `sync.md` 的「清空之后为什么不会再回来」。

## M3 会用到的现成能力

域每次写入都会发 `domain/changed`（按写入顺序，且事件里的值等于当时的内存状态）。面板要做"边写边刷新"时用这个，不要轮询。
