# 对象存储网关的兼容性排查（含中科院数据胶囊实测）

> 适用范围：本插件 `src/host/s3/client.ts`、`src/host/webdav/client.ts`，以及任何"自己实现 S3 签名去连非 AWS 网关"的场合。
> 结论都来自 2026-09-19 对 `s3.cstcloud.cn` / `data.cstcloud.cn/dav` 的真实请求，完整矩阵见文末。

## 一句话

**非 AWS 的 S3 网关回 401/403 时，"凭证错"只是三种可能之一**——另外两种是**签名形状不合它口味**、**它按客户端标识（`User-Agent`）认人**。这两种的响应和凭证错长得一模一样。

## 中科院数据胶囊的四条实测事实

1. **按 `User-Agent` 认客户端**。AccessKey 创建时要选一个"应用"，网关随后只接受**自称是那个应用**的请求：
   - 同一份签名（v4 + `host;x-amz-content-sha256;x-amz-date`），`User-Agent: Obsidian/1.8.7` 或 `Obsidian` → **200**；
   - 同一份签名，`User-Agent: aws-sdk-js/3.x`、`curl/8.x`、`rclone/…`、浏览器 UA，或**不发 UA** → **401**（响应体为空、无 `WWW-Authenticate`）。
   - WebDAV 门是同一套逻辑，但回 **403 `Client type mismatch.`** —— 这句话是整个排查里唯一一句有用的提示。
   - **绑定在凭证上，不是全局白名单**：换一把绑定别的应用的 key，需要的标识就跟着换（见下面那张三行矩阵）。
   - **匹配是"包含 + 不分大小写"**：`Zotero`、`Zotero/7.0.11`、`zotero/7.0.11`、`Mozilla/5.0 … Zotero/7.0.11` 全部通过，`Obsidian/1.8.7` 全部被拒。填"应用名"最省事，带版本号也行。
2. **必须 path-style，且 `x-amz-content-sha256` 要在签名头里**。region 网关似乎不校验：`us-east-1` / `cn-north-1` / `cn-northwest-1` 都能 200；但**只签 `host` + `x-amz-date` 的"精简 v4"一定 401**，而 `UNSIGNED-PAYLOAD` 可以。
3. **不支持 SigV2**：v2 请求得到 **500** `{"msg":"未知运行时异常","code":500}`（网关内部炸了，不是规规矩矩的 S3 错误）。
4. **S3 桶 == WebDAV 根**：`PROPFIND /dav/` 列出的就是 bucket 根下的对象（`/dav/duoyu-inbox/` 反而 404）；同一份存储两个门都能进。**WebDAV 门的用户名/密码就是 AccessKey ID / Secret**（控制台里另设的 WebDAV 账号在实测中一律 403）。

## 标识跟着凭证走（2026-09-19 追加实测）

同一个人可以有两个凭证：一把 S3 的 AccessKey 绑在 `Obsidian`，一个 WebDAV 账号绑在 `Zotero`，指向同一份存储。只改 `User-Agent` 一列：

| 门 / 凭证 | `Obsidian/1.8.7` | `Zotero/7.0.11` | `zotero/7.0.11` | `Mozilla/5.0 Zotero/7.0.11` | `aws-sdk-js` | 不发 UA |
|---|---|---|---|---|---|---|
| S3，key 绑 `Obsidian` | **200** | 401 | 401 | 401 | 401 | 401 |
| WebDAV，账号绑 `Zotero` | 403 | **207** | **207** | **207** | 403 | 403 |
| WebDAV，改用上面那把 S3 key | **207** | 403 | 403 | 403 | 403 | 403 |

两条结论直接决定实现：

1. **标识是"凭证的属性"**，所以必须**按协议各存一份**——否则用户换协议时另一个门的标识会静默失效，报错还长得像"密码错了"（正是本文要消灭的那类故障）。`WebdavSettings.userAgent`（S3）与 `webdavUserAgent`（WebDAV）就是这两份；面板上只有一个输入框，跟着当前协议走。
2. **同一个 key 可以走两个门**。不想维护两份应用绑定的话，用一把 key 同时走 S3 + WebDAV 是最省事的组合（上表第三行）。

## 排查顺序（省时间的那个顺序）

1. **先要一次匿名基线**：不带任何 `Authorization` 打一次同样的 URL，看状态码和响应体。
   如果**匿名得到的拒绝和带签名的一模一样**（数据胶囊就是这样：都是 401、都是空 body），那说明"状态码"这条路已经没有信息量，别再靠它猜。
2. **换参考实现**：把官方 `@aws-sdk/client-s3` 装到临时目录，用**同一组参数**打同一个请求（`endpoint` + `forcePathStyle: true` + `region`）。
   - 官方也失败 → 问题不在你的签名器，去查凭证、应用绑定、客户端标识；
   - 官方成功 → 用它的请求头做基准，逐项 diff 你的 canonical request。
3. **逐个变量做矩阵**：一次跑一组请求，只改一个变量（UA / 签名版本 / region / 是否带 `x-amz-content-sha256`），把状态码和响应体片段并排打出来。**UA 要单独列一列**——这是最容易漏、也最难从状态码看出来的一维。
4. **读服务器的原话**。S3 的 `<Error><Code>`、WebDAV 的响应体（`Client type mismatch.`）通常就是完整诊断；只报 `HTTP 403` 等于把唯一的线索丢了。
5. **列目录"通了但 0 项"时，先怀疑自己的解析**：本插件曾在"目录填 `/`"时返回空列表——判断"这条是不是目录自身"用了 `endsWith(directory)`，而 `endsWith('')` 对任何路径都成立，整张列表被自己过滤光。**根目录是最常见的填法，这条路径必须有单测。**

## 结论怎么落回代码

- 客户端标识必须是**设置项**，不能写死在客户端里：它取决于用户在控制台选了哪个应用。
- 它**不进签名**（SigV4 默认只签 host / date / payload hash），所以可以自由改；`test/s3.test.ts` 里有一条断言"改标识不改签名"，就是防止以后有人顺手把它签进去。
- 网关的原文要进错误信息（S3 的 `refused()`、WebDAV 的 `refusal()`），否则用户只能看到 `HTTP 403` 去猜自己的密码。
- 不做"401 就自动换身份重试"：静默冒充别的客户端比报错更难查。
- 标识**按协议存**（一份配置里两个门各自的凭证绑的应用往往不同）；界面上可以只有一个输入框，但存储不能只有一个槽。

## 复现用的最小步骤

在临时目录（不要进本仓库）装参考实现：

```text
npm install @aws-sdk/client-s3 @smithy/signature-v4 @smithy/protocol-http @aws-crypto/sha256-js
```

用 `@smithy/signature-v4` 手签同一个 `HttpRequest`、只改 `headers['user-agent']`，就得到本文的矩阵；换成 `@aws-sdk/client-s3` 的 `ListObjectsV2Command` + `forcePathStyle: true`，等价于 Obsidian 的 remotely-save。

## 证据表（2026-09-19，实测）

| 请求 | 结果 |
|---|---|
| `GET https://s3.cstcloud.cn/duoyu-inbox?list-type=2`，**匿名** | 401，空 body |
| 同上，伪造 `Authorization`（假 AK + 假签名） | 401，空 body |
| 同上，完整 v4（自带实现），us-east-1 | 401 |
| 同上，完整 v4，cn-north-1 / cn-northwest-1 | 401 |
| 同上，精简 v4（只签 host + date） | 401 |
| 同上，v2 | 500 `{"msg":"未知运行时异常","code":500}` |
| 同上，官方 SDK v3（`us-east-1`、`forcePathStyle`） | 401 |
| 同上，官方签名 + `User-Agent: aws-sdk-js/3.1135.0` | 401 |
| 同上，官方签名 + `User-Agent: Obsidian/1.8.7` | **200** + `ListBucketResult`（1 个对象 `IMG_9270.jpg`） |
| `PROPFIND /dav/`，Basic = `chance722:<密码>`，任意 UA | 403 `Client type mismatch.` |
| `PROPFIND /dav/`，Basic = `<AccessKeyID>:<Secret>`，UA `curl/8.x` | 403 `Client type mismatch.` |
| `PROPFIND /dav/`，Basic = `<AccessKeyID>:<Secret>`，UA `Obsidian/1.8.7` | **207** + 列目录（同一张 `IMG_9270.jpg`） |
| `PROPFIND /dav/duoyu-inbox/`，同上凭证 | 404（桶名不在 WebDAV 路径里） |
| 用户自己的 WebDAV 账号（绑 `Zotero`）+ UA 含 `Zotero` | **207**，同一份目录 |
| 用户自己的 WebDAV 账号 + UA 含 `Obsidian` | 403 `Client type mismatch.` |

插件侧对应实现与验收记录见 `docs/feature/dev-bus.md` 的「M6c 收尾」一节。
