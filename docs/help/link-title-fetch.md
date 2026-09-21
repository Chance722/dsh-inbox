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

同一台机器、同一条出口、同一个 URL，只改 `user-agent`，多个身份轮转着跑（避免"某一时段整批被拒"的
干扰）。**bilibili 视频页**：

| UA | 结果 |
|---|---|
| `deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)`（harness 默认） | 验证码页：三次采样 5/8、1/6、7/10 |
| `Mozilla/5.0 (compatible; dsh-inbox/0.1; +https://github.com/Chance722/dsh-inbox)`（dev-setup 里给微信用的那条） | 验证码页：跨四次采样 20/29（8/8、5/6、3/5、4/10） |
| `Mozilla/5.0 (Windows NT 10.0; ...) AppleWebKit/537.36 (KHTML, like Gecko) dsh-inbox/0.2 Safari/537.36` | **真页面 15/15** |
| `Mozilla/5.0 (Windows NT 10.0; ...) Chrome/140.0.0.0 Safari/537.36` | **真页面 36/36** |
| 上一条的 Chrome 名字**后面**再缀 ` dsh-inbox/0.2 (+...)` | 验证码 3/5（n 小，仅作提示） |
| `curl/8.4.0` | 验证码 5/8 |

**微信文章**（`mp.weixin.qq.com`，仓库里另一条记录）：

| UA | 结果 |
|---|---|
| harness 默认 | 空壳页 18KB，`<title>` 空、连 `og:title` 都没有 |
| `Mozilla/5.0 (compatible; ...)` | 真文章 3.56MB + `og:title` |
| 浏览器形状 + 自报家门（上表那条） | 真文章 3.56MB + `og:title`，3/3 |

bilibili 真页面 169KB，`<title>` 就是视频名。公开 JSON `api.bilibili.com/x/web-interface/view?bvid=...`
对上面**每一种身份都 5/5 命中**，同样不需要登录。全部请求都没带 cookie——验证码页反而自己往下发
`buvid3` 和 `v_voucher`（那是发给匿名客户端的挑战票据，不是会话）。

四条结论：

1. **风控看客户端身份（UA 形状）+ 概率**，不是会话：一个 cookie 都不发的同一个身份，有时也拿得到真页面。
2. **「礼貌的爬虫 UA」不是通用解**：`Mozilla/5.0 (compatible; ...)` 在 bilibili 最差（bilibili 认的是
   UA 里的**产品位**：`(KHTML, like Gecko) <谁>/<版本> Safari/…` 的形状才过闸，`(compatible; …)`
   和"Chrome 后面再缀名字"都算不过），在微信够用。
3. **浏览器形状在两个站点上都是超集**：bilibili 从"常被拒"变成"稳定放行"，微信照旧放行。想过闸**不必
   冒充 Chrome**——写 `dsh-inbox/0.2` 在那个产品位同样 15/15（这是爬虫界的常规写法，Googlebot 也长这样）。
4. **真页面不需要登录态**：不送任何凭据也能拿到完整 HTML。

样本的边界：都在一天之内、一个 IP 上，而且同一个身份的通过率随时段漂移（harness 默认 1/6 → 5/8 → 7/10）。
所以「哪种形状进哪个桶」是可复现的排序，不是永久保证。

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
3. **把 profile 的 UA 换成浏览器形状**——本机最有效（0/36 被拒）。两种写法：浏览器形状**+ 自报家门**
   （`... (KHTML, like Gecko) dsh-inbox/0.2 Safari/537.36`，实测与 Chrome 同档且仍说明自己是谁）或直接
   冒充 Chrome（没有额外收益）。代价有三条：① 这是**整个 profile 的抓取身份**，模型的 web 工具一起变；
   ② `WebFetchRequest` 只有 `url`，没法只给抓标题这一个请求换身份，要随插件发布只能让本包的 bundle patch
   去覆盖 `web-fetch-http` 那行（bundle 顺序在我们之后是必需的），安装即改动用户整个 profile 的对外身份，
   必须在 README 披露；③ 我们发的**不是**浏览器请求（只有 `user-agent` + `accept`，没有 cookie、不跑 JS、
   指纹也不是 Chrome 的），所以"浏览器形状 + 非浏览器指纹"在真做指纹的风控那里反而更醒目——那类站点的
   拦截页同样带标题（本机未实测，属于已知形态）；
4. **bilibili 走 JSON API**——命中率 100% 且无登录，但那是按站点特殊化 + 第二个 host，与「只 GET 用户
   贴的那一个 URL」的约束直接冲突（`AGENTS.md`「对外请求只走官方 seam」）。
