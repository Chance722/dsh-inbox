# 抓链接标题：外发身份、站点拒绝的两种长相、怎么排查

代码只有一处：`src/host/link-title.ts`；触发点在 `src/host/capture.ts:334`。抓取身份是 profile 的
`web-fetch-http.userAgent`（配置姿势见 `dev-setup.md`）。

## 这一抓什么时候发生

- 只在**本机捕获**的 `kind=link` 上触发（`capture.ts:334`）：WebDAV 拉回来的链接不抓。
- 记录**已经有名字就不再抓**——`title` 或 `linkTitle` 任一非空即返回（`link-title.ts:131`）。所以
  「重贴同一个链接」是唯一的再抓机会（`capture.ts:329`），而且对已经存过 `linkTitle` 的记录无效。
- 只发两个头：`user-agent` + `accept`（`dsh-web-fetch-http` 的实测事实，`lib/index.js:496` 就是全部）。没有
  cookie、没有 referer；UA 只能按 profile 配，**不能按请求配**（`WebFetchRequest` 只有 `url`）——所以
  「身份」这一层是**本包 `cordis.patch.yml` 里覆盖 `web-fetch-http` 的 `userAgent`**（浏览器形状 + 自报家门，
  用户自己的 profile patch 优先），细节见下面第 4 节。
- 写的是 `linkTitle`，**永不写 `title`**（`AGENTS.md` 3）。判 miss 时写 `linkTitleError`（代码，不是句子）；
  名字位则由界面自己兜底（列表/dock/详情都退回 URL 或文件名，`src/client/heading.ts`）。
- 失败解释走 `ctx.logger.info`，实测**默认不落 stdout**——诊断看记录字段，别指望日志。

## 站点拒绝的三种长相

| 长相 | 例子 | 我们的行为 |
|---|---|---|
| **空壳页** | 微信：200 + `text/html` + `<title></title>` 空 | 判 miss → `linkTitleError: no-title`，名字留 URL |
| **伪装的正常页** | bilibili 风控：200 + `text/html` + **有标题**「验证码_哔哩哔哩」，正文 1360 字节 | `looksLikeRefusal` 判成拒绝页 → `refused-page`，名字留 URL |
| **普通错误页** | 404 / 403 / 不是 HTML / 连不上 | 早有判据（状态码、content kind）→ `http:…` / `not-html:…` / `network:…` |

第二种是这条链上唯一的坏结局——状态码 < 400、是 HTML、标题非空，前四道判据全过，于是「站点拒绝服务」被
记成了这条链接的名字（2026-09-21 咬到：一条 bilibili 记录的标题成了「验证码_哔哩哔哩」）。实测页面：

```html
<!-- Dejavu Release Version 64940-->
<script>window._BiliGreyResult = { method: "direct", versionId: "64940", }</script>
...
<title>验证码_哔哩哔哩</title>
<script>window._riskdata_ = { 'v_voucher': 'voucher_...' }</script>
... risk-captcha-app / risk-captcha-sdk ...
```

判据实现在 `src/host/link-title.ts` 的 `looksLikeRefusal`，两条**任一成立**即算拒绝页：

1. **挑战标记**（精确的那一半）：文档里出现 `risk-captcha` / `_BiliGreyResult` / `cf-chl` /
   `challenge-platform` / `geetest` —— 这些字符串本身就是"要人机验证"的意思；
2. **没正文 + 标题像拒绝**：去掉 `<script>/<style>/标签/注释` 后可见文字 < 200 字符，且标题命中
   `验证码|人机验证|安全验证|环境异常|访问异常|captcha|just a moment|attention required|access denied|forbidden`。

两边都**故意偏严**：判错成拒绝页的代价是"这条链接显示自己的地址"（诚实、随手就能自己起名），判漏的代价是
"一个错误的名字永久留在列表里"。所以一页讲验证码的**长文**（有正文、没有挑战标记）不会被误伤——有测试钉着
这条边界（`test/link-title.test.ts`）。

## 这不是登录态问题（2026-09-21 实测）

同一台机器、同一条出口、同一个 URL，只改 `user-agent`，多个身份轮转着跑（避免"某一时段整批被拒"的
干扰）。**bilibili 视频页**：

| UA | 结果 |
|---|---|
| `deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)`（harness 默认） | 验证码页：三次采样 5/8、1/6、7/10 |
| `Mozilla/5.0 (compatible; dsh-inbox/0.1; +https://github.com/Chance722/dsh-inbox)`（dev-setup 里给微信用的那条） | 验证码页：跨四次采样 20/29（8/8、5/6、3/5、4/10） |
| `Mozilla/5.0 (Windows NT 10.0; ...) AppleWebKit/537.36 (KHTML, like Gecko) dsh-inbox Safari/537.36`（**本包现在用的那条**） | **真页面 15/15** |
| `Mozilla/5.0 (Windows NT 10.0; ...) Chrome/140.0.0.0 Safari/537.36` | **真页面 36/36** |
| 上一条的 Chrome 名字**后面**再缀 ` dsh-inbox/0.2 (+...)` | 验证码 3/5（n 小，仅作提示） |
| 同形状但换成 macOS 或 Linux 的 OS token | **真页面 各 5/5**（所以 OS 那一段不重要，用了 Windows 的） |
| 同形状但把 `dsh-inbox` 换成 `dsh-inbox (+https://…)` | 验证码 5/5（**括号一加就掉桶**，所以不带联系方式） |
| 同形状、带 `dsh-inbox/0.3` 版本号 | **真页面 5/5**（带不带版本都行；不带，就不会随发版过期） |
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
   冒充 Chrome**——把 `dsh-inbox` 写在那个产品位同样 15/15（这是爬虫界的常规写法，Googlebot 也长这样），
   而且**括号里加联系方式就会被拒**（`dsh-inbox (+url)` 5/5 掉桶）。
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

**已落地（2026-09-21）**：

1. **拒绝页不取名**（`looksLikeRefusal`）+ 记录只留 `linkTitleError: refused-page`；
2. **名字位退回原文**：`title`/`linkTitle` 都空时，列表、dock 与详情本来就用 URL（图片/文件用文件名）兜底
   （`src/client/heading.ts`）；详情里那行「没抓到页面标题：…。可以自己起个名字。」**删掉了**——它正是
   "显示这一条没有名字"，用户要的是显示原文；面板现在只显示记录本身（链接就在名称框上方）。理由串仍留
   在记录里，供直接读仓库的人排查；
3. **身份换成浏览器形状 + 自报家门**：本包 `cordis.patch.yml` 覆盖 `web-fetch-http.userAgent` 为
   `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) dsh-inbox Safari/537.36`。
   为什么这么写、为什么不能加括号/版本/后缀，见上表。**代价要记住**：这是**整个 profile 的抓取身份**，
   模型的 web 工具一起变（README 已披露）；用户自己的 `cordis.patch.yml` 在这层之后应用，所以谁都能改回去。

还没做、各有代价的：

4. **疑似拒绝页时重试**——非浏览器 UA 的失败率约 60–93%，重试只提高概率，且让"一次抓取"变成一串请求；
5. **bilibili 走 JSON API**——命中率 100% 且无登录，但那是按站点特殊化 + 第二个 host，与「只 GET 用户
   贴的那一个 URL」的约束直接冲突（`AGENTS.md`「对外请求只走官方 seam」）。

一个**已知的残留**：那条老记录（`9cc7594f-...`，2026-09-21 12:40 捕获）的 `linkTitle` 仍是
「验证码_哔哩哔哩」——面板没有清 `linkTitle` 的入口，重贴也不会重抓（记录已经有名字），而它还会进模型的
搜索负载（`src/host/tools.ts:235`、`src/host/rpc.ts:263`）；只有记录没有 `title` 时它才会成为模型看到的
标题（`src/host/tools.ts:104`）。那条记录用户自己填了真名，所以界面上看不出来。

**浏览器形状不等于我们是浏览器**：我们只发 `user-agent` + `accept`，没有 cookie、不跑 JS、指纹也不是
Chrome 的。所以这一层只对"只看 UA"的站点有效；真做指纹的风控（Cloudflare 那类）里"浏览器形状 + 非浏览器
指纹"反而更醒目，而那类站点的拦截页同样带标题（本机未实测，属于已知形态）——这也是为什么第 1 条不能省：
**UA 决定"多容易被拦"，拒绝页判据决定"被拦时会不会污染名字"**。
