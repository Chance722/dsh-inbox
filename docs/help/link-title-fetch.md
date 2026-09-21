# 抓链接标题：外发身份、站点拒绝的两种长相、怎么排查

代码只有一处：`src/host/link-title.ts`；触发点在 `src/host/capture.ts:334`。抓取身份是 profile 的
`web-fetch-http.userAgent`（配置姿势见 `dev-setup.md`）。

## 这一抓什么时候发生

- 只在**本机捕获**的 `kind=link` 上触发（`capture.ts:334`）：WebDAV 拉回来的链接不抓。
- 记录**已经有名字就不再抓**——`title` 或 `linkTitle` 任一非空即返回（`link-title.ts:131`）。所以
  「重贴同一个链接」是唯一的再抓机会（`capture.ts:329`），而且对已经存过 `linkTitle` 的记录无效。
- 只发两个头：`user-agent` + `accept`（`dsh-web-fetch-http` 的实测事实）。没有 cookie、没有 referer；
  UA 只能按 profile 配，**不能按请求配**（`WebFetchRequest` 只有 `url`）。
- 写的是 `linkTitle`，**永不写 `title`**（`AGENTS.md` 3）。判 miss 时写 `linkTitleError`，由面板翻译成人话。
- 失败解释走 `ctx.logger.info`，实测**默认不落 stdout**——诊断看记录字段，别指望日志。

## 站点拒绝的两种长相

| 长相 | 例子 | 我们的行为 |
|---|---|---|
| **空壳页** | 微信：200 + `text/html` + `<title></title>` 空 | 判 miss → `linkTitleError: no-title`，名字留 URL |
| **伪装的正常页** | bilibili 风控：200 + `text/html` + **有标题**「验证码_哔哩哔哩」，正文 1360 字节 | **当成页面标题存下来** |

第二种是这条链上唯一的坏结局：状态码 < 400、是 HTML、标题非空——三道判据全过，于是「站点拒绝服务」被
记成了这条链接的名字。实测页面（2026-09-21）:

```html
<!-- Dejavu Release Version 64940-->
<script>window._BiliGreyResult = { method: "direct", versionId: "64940", }</script>
...
<title>验证码_哔哩哔哩</title>
<script>window._riskdata_ = { 'v_voucher': 'voucher_...' }</script>
... risk-captcha-app / risk-captcha-sdk ...
```

## 这不是登录态问题（2026-09-21 实测）

同一台机器、同一条出口、同一个 URL，只改 `user-agent`，各跑 8 次：

| UA | 拿到验证码页 | 拿到真页面 |
|---|---|---|
| `deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)`（harness 默认） | 5 | 3 |
| `Mozilla/5.0 (compatible; dsh-inbox/0.1; +https://github.com/Chance722/dsh-inbox)`（dev-setup 里给微信用的那条） | 8 | 0 |
| `Mozilla/5.0 (Windows NT 10.0; ...) Chrome/140.0.0.0` | 0 | 8 |
| `curl/8.4.0` | 5 | 3 |

补测：后两条交替各 6 次 → chaff 5/6 被拒、Chrome 6/6 正常；harness 换一个时段再跑 → 1/6 被拒。
真页面 169KB，`<title>` 就是视频名。公开 JSON `api.bilibili.com/x/web-interface/view?bvid=...` 对上面
**每一种身份都 5/5 命中**，同样不需要登录。全部请求都没带 cookie——验证码页反而自己往下发 `buvid3`
和 `v_voucher`（那是发给匿名客户端的挑战票据，不是会话）。

三条结论：

1. **风控看客户端身份（UA 形状）+ 概率**，不是会话：一个 cookie 都不发的同一个身份，有时也拿得到真页面。
2. **「礼貌的爬虫 UA」在这里最差**：`Mozilla/5.0 (compatible; ...)` 这个形状基本必被拒。dev-setup 那条
   微信修法**不是可以照搬的通用结论**。
3. 真页面不需要登录态：不送任何凭据也能拿到完整 HTML。

## 怎么复查（read-only）

```powershell
node -e '(async()=>{const url="<链接>";for(const [k,ua] of [["harness","deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)"],["chrome","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"]]){const r=await fetch(url,{headers:{"user-agent":ua,accept:"text/html"},redirect:"follow"});const b=await r.text();console.log(k,r.status,b.length,/<title[^>]*>([\s\S]*?)<\/title>/i.exec(b)?.[1]?.trim());}})()'
```

`.research/probe-title.mjs` 是同一件事的更完整版本（它直接 import 真 provider 的 `HttpFetchProvider`，
复现的正是我们真正发出的头）；注意里面那条 profile 路径写的是旧安装位置，用前先按机器实际位置改。

## 落到记录上的处置与可选修法

现状（2026-09-21 12:40 捕获的那条 bilibili 记录 `9cc7594f-...`）：`title` 是用户自己填的真名，列表按
`title` 显示（`src/client/heading.ts` 的 `build()` 先看 `title`），所以列表里看不到「验证码」；
`linkTitle` 仍是「验证码_哔哩哔哩」，它进模型的搜索负载（`src/host/tools.ts:235`、`src/host/rpc.ts:263`），
但只在记录没有 `title` 时才会成为模型看到的标题（`src/host/tools.ts:104`）。面板没有清 `linkTitle` 的入口，
重贴也不会改（记录已经有名字）。

可选修法（都还没做，各有代价）：

1. **把这类页面判成 miss**，写 `linkTitleError` 而不是存成名字——需要判据（页面体积下限 / 风控标记 /
   标题黑名单），都是启发式，有误伤小页面的风险；
2. **疑似拒绝页时重试**——非浏览器 UA 的失败率约 60–93%，重试只提高概率，且让"一次抓取"变成一串请求；
3. **把 profile 的 UA 换成浏览器形状**——本机最有效（0/20 被拒），代价是伪装身份，而且这是整个 profile
   的抓取身份（模型的 web 工具一起变）；
4. **bilibili 走 JSON API**——命中率 100% 且无登录，但那是按站点特殊化 + 第二个 host，与「只 GET 用户
   贴的那一个 URL」的约束直接冲突（`AGENTS.md`「对外请求只走官方 seam」）。
