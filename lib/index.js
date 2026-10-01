// src/host/index.ts
import z5 from "@deepseek-ai/schemastery";
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

// src/shared/constants.ts
var PACKAGE_NAME = "@chance722/dsh-inbox";
var VERSION = true ? "0.2.11" : "0.0.0-dev";
var DEFAULT_USER_AGENT = "dsh-inbox";

// src/shared/vocabulary.ts
var KINDS = ["text", "link", "image", "file"];
var CATEGORIES = [
  "idea",
  "article",
  "media",
  "image",
  "document",
  "secret",
  "other"
];
var SOURCES = ["panel", "chat", "webdav", "import"];
var CATEGORY_SOURCES = ["rule", "model", "user"];
var CATEGORY_LABELS = {
  idea: "\u7075\u611F/\u5F85\u529E",
  article: "\u6587\u7AE0",
  media: "\u89C6\u9891/\u97F3\u9891",
  image: "\u56FE\u7247",
  document: "\u8BC1\u4EF6",
  secret: "\u5BC6\u94A5/\u8D26\u5BC6",
  other: "\u5176\u5B83"
};
var KIND_LABELS = {
  text: "\u6587\u672C",
  link: "\u94FE\u63A5",
  image: "\u56FE\u7247",
  file: "\u6587\u4EF6"
};

// src/host/classify/redact.ts
var ASSIGNMENT = /\b((?:secret|access)[-_]?(?:id|key)|api[-_]?key|apikey|password|passwd|pwd|token|bearer)\b(\s*[:=]\s*)("[^"]{4,}"|'[^']{4,}'|\S{4,})/gi;
var TOKENS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bmongodb(\+srv)?:\/\/[^\s:@]+:[^\s:@]+@/gi
];
var PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
function mask(value) {
  const length = Math.max(4, Math.min(24, value.length));
  return "\u2022".repeat(length);
}
function redact(text) {
  let out = text.replace(PRIVATE_KEY, "\xAB\u79C1\u94A5\u5DF2\u8131\u654F\xBB");
  out = out.replace(
    ASSIGNMENT,
    (_match, label, separator, value) => `${label}${separator}${mask(value)}`
  );
  for (const pattern of TOKENS) {
    out = out.replace(pattern, (match) => mask(match));
  }
  return out;
}

// src/host/classify/model.ts
var PROVIDER = "deepseek-official";
var MODEL = "deepseek-flash";
var DEFAULT_BUDGET = {
  maxCallsPerDay: 200,
  maxTokensPerDay: 1e5,
  maxTokensPerCall: 512
};
function today(now = /* @__PURE__ */ new Date()) {
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}
function freshSpend(now = /* @__PURE__ */ new Date()) {
  return { day: today(now), calls: 0, tokens: 0 };
}
function rollSpend(spend, now = /* @__PURE__ */ new Date()) {
  if (spend === void 0 || spend.day !== today(now)) return freshSpend(now);
  return spend;
}
function withinBudget(spend, budget = DEFAULT_BUDGET) {
  return spend.calls < budget.maxCallsPerDay && spend.tokens < budget.maxTokensPerDay;
}
function spendOf(spend, tokens) {
  return { day: spend.day, calls: spend.calls + 1, tokens: spend.tokens + Math.max(0, tokens) };
}
function shouldAskModel(verdict, item, minimumChars = 8) {
  if (item.kind === "image") return item.attachmentIds.length > 0;
  if (verdict.confidence !== "unsure") return false;
  if (item.kind === "link") {
    return verdict.platform !== void 0;
  }
  if (item.kind !== "text") return false;
  const subject = item.text ?? item.url ?? "";
  return subject.trim().length >= minimumChars;
}
function parseCategory(answer) {
  const normalized = answer.toLowerCase();
  return CATEGORIES.find((category) => normalized.includes(category));
}
async function classifyWithModel(ctx, vault, item, verdict, budget = DEFAULT_BUDGET) {
  if (!shouldAskModel(verdict, item)) {
    return { kind: "skipped", reason: "\u89C4\u5219\u5DF2\u7ECF\u5B9A\u4E86\uFF0C\u6216\u8005\u5185\u5BB9\u592A\u77ED" };
  }
  const llm = ctx.get("llm");
  if (llm === void 0) {
    const reason = "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u6A21\u578B\u670D\u52A1";
    await vault.setModelSpend(rollSpend(vault.global.model), `skipped: ${reason}`);
    return { kind: "skipped", reason };
  }
  const spend = rollSpend(vault.global.model);
  if (!withinBudget(spend, budget)) {
    const reason = "\u4ECA\u5929\u7684\u6A21\u578B\u9884\u7B97\u7528\u5B8C\u4E86";
    await vault.setModelSpend(spend, `skipped: ${reason}`);
    return { kind: "skipped", reason };
  }
  const subject = redact((item.text ?? item.url ?? "").slice(0, 2e3));
  const image = item.kind === "image" ? firstImage(vault, item) : void 0;
  if (item.kind === "image" && image === void 0) {
    const reason = "\u8FD9\u6761\u56FE\u7247\u8BB0\u5F55\u6CA1\u6709\u53EF\u7528\u7684\u9644\u4EF6";
    await vault.setModelSpend(rollSpend(vault.global.model), `skipped: ${reason}`);
    return { kind: "skipped", reason };
  }
  let answer = "";
  let reasoning = "";
  let tokens = 0;
  try {
    const stream = llm.stream({
      provider: PROVIDER,
      model: MODEL,
      maxTokens: budget.maxTokensPerCall,
      temperature: 0,
      system: `\u4F60\u5728\u7ED9\u4E00\u4E2A\u4E2A\u4EBA\u6536\u85CF\u5939\u5206\u7C7B\u3002\u53EA\u56DE\u4E00\u4E2A\u8BCD\uFF0C\u4ECE\u8FD9\u4E9B\u91CC\u9009\uFF1A${CATEGORIES.join(" / ")}\u3002\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u6807\u70B9\u3002`,
      messages: [
        {
          role: "user",
          content: [
            ...image === void 0 ? [] : [image],
            {
              type: "text",
              text: image === void 0 ? `\u8FD9\u6BB5\u4E1C\u897F\u5C5E\u4E8E\u54EA\u4E00\u7C7B\uFF1F

${subject}` : "\u8FD9\u5F20\u56FE\u5C5E\u4E8E\u54EA\u4E00\u7C7B\uFF1F\uFF08\u624B\u673A\u62CD\u7684\u7167\u7247\u5F80\u5F80\u662F\u8BC1\u4EF6\u7167\uFF0C\u6240\u4EE5\u4E0D\u8981\u53EA\u770B\u5F62\u72B6\uFF0C\u770B\u56FE\u91CC\u6709\u4EC0\u4E48\uFF09"
            }
          ]
        }
      ]
    });
    for await (const chunk of stream) {
      if (chunk.type === "text-delta") answer += chunk.text;
      else if (chunk.type === "reasoning-delta") reasoning += chunk.text;
      else if (chunk.type === "usage") {
        tokens = (chunk.usage?.inputTokens ?? 0) + (chunk.usage?.outputTokens ?? 0);
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vault.setModelSpend(spendOf(spend, tokens), `failed: ${reason}`);
    return { kind: "failed", reason };
  }
  const after = spendOf(spend, tokens);
  const category = parseCategory(answer) ?? parseCategory(reasoning);
  if (category === void 0) {
    const said = answer.trim() || reasoning.trim();
    const reason = `\u6A21\u578B\u6CA1\u7ED9\u51FA\u53EF\u7528\u7C7B\u76EE\uFF0C\u5B83\u8BF4\u7684\u662F\uFF1A${said.slice(0, 60) || "\uFF08\u7A7A\uFF09"}`;
    await vault.setModelSpend(after, `failed: ${reason}`);
    return { kind: "failed", reason };
  }
  const current = vault.get(item.id);
  if (current === void 0 || current.categorySource === "user") {
    const reason = "\u8BB0\u5F55\u5DF2\u7ECF\u4E0D\u5728\uFF0C\u6216\u8005\u7528\u6237\u81EA\u5DF1\u5B9A\u4E86\u7C7B\u76EE";
    await vault.setModelSpend(after, `skipped: ${reason}`);
    return { kind: "skipped", reason };
  }
  await vault.patch(item.id, { category, categorySource: "model" });
  await vault.setModelSpend(after, `applied: ${category} (${String(tokens)} tokens)`);
  return { kind: "applied", category, tokens };
}
function firstImage(vault, item) {
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId);
    if (record === void 0 || !record.mime.startsWith("image/")) continue;
    return {
      type: "image",
      attachment: {
        attachmentId: record.storeId,
        mediaType: record.mime,
        bytes: record.bytes,
        width: record.width ?? 0,
        height: record.height ?? 0,
        ...record.filename === void 0 ? {} : { name: record.filename }
      }
    };
  }
  return void 0;
}

// src/host/link-title.ts
var MAX_LINK_TITLE_CHARS = 200;
var FETCH_TIMEOUT_MS = 8e3;
var ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};
var REFUSAL_MARKER = /(risk-captcha|_BiliGreyResult|cf-chl|challenge-platform|geetest)/i;
var REFUSAL_TITLE = /(验证码|人机验证|安全验证|环境异常|访问异常|请完成验证|正在验证|captcha|just a moment|attention required|access denied|forbidden)/i;
var REFUSAL_TEXT_FLOOR = 200;
function visibleTextLength(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
}
function looksLikeRefusal(html, title) {
  if (visibleTextLength(html) >= REFUSAL_TEXT_FLOOR) return false;
  return REFUSAL_MARKER.test(html) || REFUSAL_TITLE.test(title);
}
function decodeEntities(text) {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      return Number.isInteger(code) && code > 0 && code <= 1114111 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}
function metaContent(html, keys) {
  for (const key of keys) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i").exec(html)?.[0];
    if (tag === void 0) continue;
    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content !== void 0 && content.trim().length > 0) return content;
  }
  return void 0;
}
function titleFromHtml(html) {
  const candidates = [
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1],
    metaContent(html, ["og:title", "twitter:title"])
  ];
  for (const candidate of candidates) {
    if (candidate === void 0) continue;
    const flat = decodeEntities(candidate).replace(/\s+/g, " ").trim();
    if (flat.length === 0) continue;
    return flat.length > MAX_LINK_TITLE_CHARS ? flat.slice(0, MAX_LINK_TITLE_CHARS) : flat;
  }
  return void 0;
}
async function fetchLinkTitle(vault, id, web, log = () => {
}) {
  const filed = vault.get(id);
  if (filed === void 0 || filed.kind !== "link" || filed.url === void 0) return void 0;
  if (filed.title !== void 0 || filed.linkTitle !== void 0) return void 0;
  const host = (() => {
    try {
      return new URL(filed.url).host;
    } catch {
      return "\uFF08\u65E0\u6CD5\u89E3\u6790\u7684\u5730\u5740\uFF09";
    }
  })();
  let result;
  try {
    result = await web.fetch({ url: filed.url }, AbortSignal.timeout(FETCH_TIMEOUT_MS));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await miss(vault, id, `network:${reason}`);
    log(`${host}\uFF1A\u8BF7\u6C42\u5931\u8D25\uFF08${reason}\uFF09`);
    return void 0;
  }
  if (result.statusCode >= 400) {
    await miss(vault, id, `http:${String(result.statusCode)}`);
    log(`${host}\uFF1AHTTP ${String(result.statusCode)}`);
    return void 0;
  }
  if (result.body.kind !== "html") {
    await miss(vault, id, `not-html:${result.body.kind}`);
    log(`${host}\uFF1A\u4E0D\u662F HTML\uFF08${result.body.kind}\uFF09`);
    return void 0;
  }
  const title = titleFromHtml(result.body.content);
  if (title === void 0) {
    await miss(vault, id, "no-title");
    log(`${host}\uFF1A\u9875\u9762\u91CC\u6CA1\u6709 <title>\uFF08${String(result.body.content.length)} \u5B57\u7B26\uFF09`);
    return void 0;
  }
  if (looksLikeRefusal(result.body.content, title)) {
    await miss(vault, id, "refused-page");
    log(`${host}\uFF1A\u6293\u5230\u7684\u662F\u62D2\u7EDD\u9875\uFF0C\u4E0D\u5F53\u540D\u5B57`);
    return void 0;
  }
  const current = vault.get(id);
  if (current === void 0 || current.title !== void 0 || current.linkTitle !== void 0) {
    log(`${host}\uFF1A\u6293\u5230\u4E86\u6807\u9898\uFF0C\u4F46\u8BB0\u5F55\u5DF2\u7ECF\u6709\u540D\u5B57\u4E86`);
    return void 0;
  }
  await vault.patch(id, { linkTitle: title, linkTitleError: "" });
  log(`${host}\uFF1A\u6807\u9898\u300C${title}\u300D`);
  return title;
}
async function miss(vault, id, reason) {
  const current = vault.get(id);
  if (current !== void 0 && current.title === void 0 && current.linkTitle === void 0) {
    await vault.patch(id, { linkTitleError: reason });
  }
}

// src/host/classify/rules.ts
var PLATFORMS = [
  // 视频 / 音频
  ["bilibili.com", "bilibili", "media"],
  ["b23.tv", "bilibili", "media"],
  ["youtube.com", "youtube", "media"],
  ["youtu.be", "youtube", "media"],
  ["vimeo.com", "vimeo", "media"],
  ["youku.com", "youku", "media"],
  ["v.qq.com", "tencentvideo", "media"],
  ["iqiyi.com", "iqiyi", "media"],
  ["mgtv.com", "mgtv", "media"],
  ["douyin.com", "douyin", "media"],
  ["iesdouyin.com", "douyin", "media"],
  ["kuaishou.com", "kuaishou", "media"],
  ["ixigua.com", "xigua", "media"],
  ["tiktok.com", "tiktok", "media"],
  ["twitch.tv", "twitch", "media"],
  ["dailymotion.com", "dailymotion", "media"],
  ["music.163.com", "netease-music", "media"],
  ["y.qq.com", "qq-music", "media"],
  ["spotify.com", "spotify", "media"],
  ["soundcloud.com", "soundcloud", "media"],
  ["ximalaya.com", "ximalaya", "media"],
  // 文章 / 帖子
  ["mp.weixin.qq.com", "wechat", "article"],
  ["weixin.qq.com", "wechat", "article"],
  ["zhihu.com", "zhihu", "article"],
  ["juejin.cn", "juejin", "article"],
  ["csdn.net", "csdn", "article"],
  ["cnblogs.com", "cnblogs", "article"],
  ["jianshu.com", "jianshu", "article"],
  ["segmentfault.com", "segmentfault", "article"],
  ["v2ex.com", "v2ex", "article"],
  ["sspai.com", "sspai", "article"],
  ["36kr.com", "36kr", "article"],
  ["infoq.cn", "infoq", "article"],
  ["toutiao.com", "toutiao", "article"],
  ["weibo.com", "weibo", "article"],
  ["weibo.cn", "weibo", "article"],
  ["douban.com", "douban", "article"],
  ["xiaohongshu.com", "xiaohongshu", "article"],
  ["xhslink.com", "xiaohongshu", "article"],
  ["maimai.cn", "maimai", "article"],
  ["yuque.com", "yuque", "article"],
  ["medium.com", "medium", "article"],
  ["substack.com", "substack", "article"],
  ["dev.to", "devto", "article"],
  ["news.ycombinator.com", "hackernews", "article"],
  ["reddit.com", "reddit", "article"],
  ["stackoverflow.com", "stackoverflow", "article"],
  ["arxiv.org", "arxiv", "article"],
  ["developer.mozilla.org", "mdn", "article"],
  ["x.com", "twitter", "article"],
  ["twitter.com", "twitter", "article"],
  ["instagram.com", "instagram", "article"],
  ["threads.net", "threads", "article"],
  ["bsky.app", "bluesky", "article"],
  ["t.me", "telegram", "article"],
  ["linkedin.com", "linkedin", "article"],
  // 代码 / 包：认得出站点，说不准"文章还是视频"，交给模型
  ["github.com", "github"],
  ["gitlab.com", "gitlab"],
  ["gitee.com", "gitee"],
  ["npmjs.com", "npm"],
  ["pypi.org", "pypi"],
  ["huggingface.co", "huggingface"]
];
var SECRET_PATTERNS = [
  [/\b(secret|access)[-_]?(id|key)\b\s*[:=]/i, "\u51FA\u73B0 secretId / secretKey \u8D4B\u503C"],
  [/\b(api[-_]?key|apikey)\b\s*[:=]/i, "\u51FA\u73B0 api key \u8D4B\u503C"],
  [/\b(password|passwd|pwd)\b\s*[:=]\s*\S/i, "\u51FA\u73B0\u5BC6\u7801\u8D4B\u503C"],
  [/\b(token|bearer)\b\s*[:=]\s*\S/i, "\u51FA\u73B0 token \u8D4B\u503C"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/, "\u51FA\u73B0 sk- \u5F62\u5F0F\u7684\u5BC6\u94A5"],
  [/\bAKIA[0-9A-Z]{16}\b/, "\u51FA\u73B0 AWS access key id"],
  [/\bghp_[A-Za-z0-9]{20,}\b/, "\u51FA\u73B0 GitHub token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "\u51FA\u73B0\u79C1\u94A5\u5757"],
  [/\bmongodb(\+srv)?:\/\/[^\s]+:[^\s]+@/i, "\u51FA\u73B0\u5E26\u53E3\u4EE4\u7684\u8FDE\u63A5\u4E32"]
];
function findSecret(text) {
  for (const [pattern, reason] of SECRET_PATTERNS) {
    if (pattern.test(text)) return reason;
  }
  return void 0;
}
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return void 0;
  }
}
function ruleFor(url) {
  const host = hostOf(url);
  if (host === void 0) return void 0;
  for (const rule of PLATFORMS) {
    const [suffix] = rule;
    if (host === suffix || host.endsWith(`.${suffix}`)) return rule;
  }
  return void 0;
}
function platformOf(url) {
  return ruleFor(url)?.[1];
}
function pathSaysMedia(path) {
  return /\/video\/|\/watch\b|\/audio\/|\/podcast|\/shorts\/|\/v_show\/|\/playlist\b/.test(path);
}
function pathSaysArticle(path) {
  return /\/article\/|\/articles\/|\/post\/|\/posts\/|\/blog\/|\/read\/|\/story\/|\/item\b/.test(path);
}
function classifyLink(url) {
  const rule = ruleFor(url);
  const platform = rule?.[1];
  const habit = rule?.[2];
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return void 0;
    }
  })();
  if (parsed === void 0) {
    return { category: "other", confidence: "unsure", reason: "\u94FE\u63A5\u89E3\u6790\u4E0D\u4E86" };
  }
  const path = parsed.pathname;
  const base = platform === void 0 ? {} : { platform };
  if (pathSaysMedia(path)) {
    return { ...base, category: "media", confidence: "decided", reason: "\u94FE\u63A5\u6307\u5411\u89C6\u9891/\u97F3\u9891\u9875" };
  }
  if (pathSaysArticle(path)) {
    return { ...base, category: "article", confidence: "decided", reason: "\u94FE\u63A5\u6307\u5411\u6587\u7AE0\u9875" };
  }
  if (habit !== void 0) {
    return {
      ...base,
      category: habit,
      confidence: "decided",
      reason: habit === "media" ? `${String(platform)} \u4E0A\u7684\u89C6\u9891/\u97F3\u9891\u9875` : `${String(platform)} \u4E0A\u7684\u6587\u7AE0\u9875`
    };
  }
  if (platform !== void 0) {
    return { ...base, category: "other", confidence: "unsure", reason: `\u8BA4\u5F97\u51FA\u5E73\u53F0\u662F ${platform}\uFF0C\u4F46\u8BF4\u4E0D\u51C6\u662F\u6587\u7AE0\u8FD8\u662F\u89C6\u9891` };
  }
  return { category: "other", confidence: "unsure", reason: "\u4E0D\u8BA4\u8BC6\u7684\u7AD9\u70B9\uFF0C\u5148\u653E\u5176\u5B83" };
}
function classifyText(text) {
  const reason = findSecret(text);
  if (reason !== void 0) {
    return { category: "secret", confidence: "decided", reason };
  }
  return {
    category: "other",
    confidence: "unsure",
    reason: "\u6CA1\u547D\u4E2D\u89C4\u5219\uFF0C\u6682\u65F6\u653E\u5176\u5B83"
  };
}
var DOCUMENT_RATIOS = [
  [85.6 / 54, "\u8EAB\u4EFD\u8BC1/\u94F6\u884C\u5361\uFF0885.6\xD754\uFF09"],
  [1.4142, "A4 \u7AD6\u7248\uFF081:\u221A2\uFF09"],
  [1.42, "\u62A4\u7167\u6570\u636E\u9875"]
];
function classifyImage(dimensions) {
  const { width, height } = dimensions;
  if (width === void 0 || height === void 0 || width <= 0 || height <= 0) {
    return { category: "image", confidence: "unsure", reason: "\u6CA1\u6709\u5C3A\u5BF8\u4FE1\u606F\uFF0C\u53EA\u80FD\u5148\u5F53\u56FE\u7247" };
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  for (const [target, label] of DOCUMENT_RATIOS) {
    if (Math.abs(ratio - target) <= 0.03) {
      return {
        category: "image",
        confidence: "unsure",
        reason: `\u957F\u5BBD\u6BD4 ${ratio.toFixed(2)} \u63A5\u8FD1${label}\uFF0C\u5148\u6807\u7591\u4F3C\uFF0C\u7B49\u4F60\u786E\u8BA4`,
        tags: ["\u7591\u4F3C\u8BC1\u4EF6"]
      };
    }
  }
  return { category: "image", confidence: "decided", reason: "\u5E38\u89C4\u7167\u7247\u6BD4\u4F8B" };
}

// src/host/capture.ts
var TRACKING_PARAMS = [
  "spm_id_from",
  "vd_source",
  "share_source",
  "share_medium",
  "from",
  "from_source",
  "share_token"
];
function parse(raw) {
  try {
    return new URL(raw);
  } catch {
    return void 0;
  }
}
function sniff(raw) {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed) || !/^https?:\/\//i.test(trimmed)) {
    return { kind: "text" };
  }
  if (parse(trimmed) === void 0) return { kind: "text" };
  const platform = platformOf(trimmed);
  return { kind: "link", url: trimmed, ...platform === void 0 ? {} : { platform } };
}
function normalizeLink(raw) {
  const url = parse(raw);
  if (url === void 0) return raw.trim();
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const param of [...url.searchParams.keys()]) {
    if (param.startsWith("utm_") || TRACKING_PARAMS.includes(param)) url.searchParams.delete(param);
  }
  const search = url.searchParams.toString();
  const path = url.pathname.replace(/\/$/, "");
  return `${url.protocol}//${url.host}${path}${search.length === 0 ? "" : `?${search}`}`;
}
function mergedNote(current, incoming) {
  if (incoming === void 0 || incoming.length === 0) return current.note;
  return current.note ?? incoming;
}
async function absorb(vault, existing, incoming) {
  const patched = await vault.patch(existing.id, {
    note: mergedNote(existing, incoming.note),
    ...existing.title === void 0 && incoming.title !== void 0 ? { title: incoming.title } : {},
    /*
          A repeat is the cheap chance to fill in what the rules learned since.
    
          `platform` is derived from the host, and the table grows (掘金 was added
          after a record for it already existed), so an old record can sit there
          with no platform while a fresh paste of the same URL knows it. This only
          ever *fills*: a record that already names a platform keeps it, because
          that value may be what the user corrected by hand.
        */
    ...existing.platform === void 0 && incoming.platform !== void 0 ? { platform: incoming.platform } : {}
  });
  const restored = existing.deletedAt !== void 0;
  const item = restored ? await vault.restore(existing.id) : patched;
  return {
    item,
    merged: true,
    restored,
    verdict: {
      category: item.category,
      confidence: "decided",
      reason: "\u5408\u5E76\u5230\u5DF2\u6709\u8BB0\u5F55\uFF0C\u4E0D\u91CD\u590D\u5206\u7C7B"
    }
  };
}
async function captureText(vault, raw, source, note) {
  const sniffed = sniff(raw);
  const verdict = sniffed.kind === "link" ? classifyLink(raw.trim()) : classifyText(raw);
  const platform = verdict.platform ?? sniffed.platform;
  const sealed = verdict.category === "secret" ? vault.sealSecret(raw) : void 0;
  const candidate = {
    kind: sniffed.kind,
    category: verdict.category,
    source,
    tags: verdict.tags ?? [],
    ...note === void 0 || note.length === 0 ? {} : { note },
    ...sniffed.kind === "link" ? {
      url: sniffed.url,
      ...platform === void 0 ? {} : { platform }
    } : sealed === void 0 ? { text: raw } : sealed
  };
  const existing = vault.list({ includeDeleted: true, kinds: [sniffed.kind] }).find(
    (item) => sniffed.kind === "link" ? item.url !== void 0 && normalizeLink(item.url) === normalizeLink(raw) : sealed === void 0 ? item.text === raw : item.secretDigest === sealed.secretDigest
  );
  if (existing !== void 0) {
    return absorb(vault, existing, {
      note,
      ...platform === void 0 ? {} : { platform }
    });
  }
  return { item: await vault.create(candidate), merged: false, restored: false, verdict };
}
async function captureImage(vault, attachment, source, note) {
  const known = vault.findAttachmentByStoreId(attachment.id);
  const existing = known === void 0 ? void 0 : vault.list({ includeDeleted: true, kinds: ["image", "file"] }).find((item2) => item2.attachmentIds.includes(known.id));
  if (existing !== void 0) return absorb(vault, existing, { note });
  const record = await vault.addAttachment({
    storeId: attachment.id,
    mime: attachment.mime,
    bytes: attachment.bytes,
    filename: attachment.filename,
    width: attachment.width,
    height: attachment.height,
    sha256: attachment.sha256
  });
  const verdict = classifyImage(attachment);
  const item = await vault.create({
    kind: attachment.mime.startsWith("image/") ? "image" : "file",
    category: verdict.category,
    source,
    tags: verdict.tags ?? [],
    ...note === void 0 || note.length === 0 ? {} : { note },
    attachmentIds: [record.id]
  });
  return { item, merged: false, restored: false, verdict };
}
async function capture(vault, payload, source, options = {}) {
  let stored = 0;
  let merged = 0;
  let restored = 0;
  const tally = (outcome) => {
    if (outcome.merged) merged += 1;
    else stored += 1;
    if (outcome.restored) restored += 1;
    if (options.ctx !== void 0) {
      const ctx = options.ctx;
      if (!outcome.merged) {
        try {
          void classifyWithModel(ctx, vault, outcome.item, outcome.verdict).catch(() => void 0);
        } catch {
        }
      }
      const web = ctx.get("web");
      if (web !== void 0 && outcome.item.kind === "link") {
        try {
          const logLine = (message) => {
            try {
              ctx.logger?.info("inbox: %s", message);
            } catch {
            }
          };
          void fetchLinkTitle(vault, outcome.item.id, web, logLine).catch(() => void 0);
        } catch {
        }
      }
    }
  };
  for (const attachment of payload.attachments ?? []) {
    tally(await captureImage(vault, attachment, source));
  }
  const text = payload.text?.trim() ?? "";
  if (text.length > 0) tally(await captureText(vault, text, source));
  return { stored, merged, restored };
}

// src/host/s3/client.ts
import { createHash, createHmac } from "node:crypto";
function userAgentOf(config) {
  const configured = config.userAgent?.trim() ?? "";
  return configured.length === 0 ? DEFAULT_USER_AGENT : configured;
}
async function refused(response, what) {
  let body = "";
  try {
    body = (await response.text()).trim().slice(0, 300);
  } catch {
  }
  const challenge = response.headers?.get("www-authenticate") ?? "";
  const hints = [body, challenge.length === 0 ? "" : `WWW-Authenticate: ${challenge}`].filter(
    (part) => part.length > 0
  );
  const identity = response.status === 401 || response.status === 403 ? "\n\uFF08\u8FD9\u7C7B\u7F51\u5173\u5E38\u6309\u5BA2\u6237\u7AEF\u6807\u8BC6\u8BA4\u4EBA\uFF1A\u8FD9\u628A AccessKey \u7ED1\u5B9A\u7684\u5E94\u7528\u540D\uFF0C\u8981\u586B\u8FDB\u8BBE\u7F6E\u7684\u300C\u5BA2\u6237\u7AEF\u6807\u8BC6\u300D\uFF09" : "";
  return new Error(
    `${what}\u5931\u8D25\uFF1AHTTP ${String(response.status)}${hints.length === 0 ? "" : ` \u2014 ${hints.join(" ")}`}${identity}`
  );
}
function amzDate(now) {
  return `${now.toISOString().replace(/[-:]/g, "").split(".")[0] ?? ""}Z`;
}
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}
function encodePart(value, encodeSlash) {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return encodeSlash ? encoded : encoded.replace(/%2F/g, "/");
}
function rfc1123(now) {
  return now.toUTCString();
}
function signRequestV2(config, deps, method, key, query = {}) {
  const date = rfc1123(deps.now ?? /* @__PURE__ */ new Date());
  const base = config.endpoint.replace(/\/$/, "");
  const canonicalUri = `/${encodePart(config.bucket, false)}${key.length === 0 ? "" : `/${encodePart(key, false)}`}`;
  const queryString = Object.entries(query).map(([name2, value]) => `${encodePart(name2, true)}=${encodePart(value, true)}`).sort().join("&");
  const subResource = ["acl", "location", "versioning"].find(
    (name2) => query[name2] !== void 0
  );
  const canonicalResource = `${canonicalUri}${subResource === void 0 ? "" : `?${subResource}`}`;
  const stringToSign = [method, "", "", date, canonicalResource].join("\n");
  const signature = createHmac("sha1", deps.accessKeySecret).update(stringToSign).digest("base64");
  return {
    url: `${base}${canonicalUri}${queryString.length === 0 ? "" : `?${queryString}`}`,
    headers: {
      date,
      authorization: `AWS ${deps.accessKeyId}:${signature}`,
      "user-agent": userAgentOf(config)
    },
    canonicalRequest: stringToSign,
    signature,
    stringToSign
  };
}
function signRequest(config, deps, method, key, query = {}, body) {
  const now = deps.now ?? /* @__PURE__ */ new Date();
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const region = config.region ?? "us-east-1";
  const base = config.endpoint.replace(/\/$/, "");
  const canonicalUri = `/${encodePart(config.bucket, false)}${key.length === 0 ? "" : `/${encodePart(key, false)}`}`;
  const canonicalQuery = Object.entries(query).map(([name2, value]) => `${encodePart(name2, true)}=${encodePart(value, true)}`).sort().join("&");
  const payloadHash = sha256Hex(body ?? "");
  const host = new URL(base).host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}
x-amz-content-sha256:${payloadHash}
x-amz-date:${stamp}
`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    stamp,
    scope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${deps.accessKeySecret}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    url: `${base}${canonicalUri}${canonicalQuery.length === 0 ? "" : `?${canonicalQuery}`}`,
    headers: {
      host,
      "x-amz-date": stamp,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${deps.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "user-agent": userAgentOf(config)
    },
    canonicalRequest,
    signature
  };
}
function signRequestV4Minimal(config, deps, method, key, query = {}) {
  const now = deps.now ?? /* @__PURE__ */ new Date();
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const region = config.region ?? "us-east-1";
  const base = config.endpoint.replace(/\/$/, "");
  const canonicalUri = `/${encodePart(config.bucket, false)}${key.length === 0 ? "" : `/${encodePart(key, false)}`}`;
  const canonicalQuery = Object.entries(query).map(([name2, value]) => `${encodePart(name2, true)}=${encodePart(value, true)}`).sort().join("&");
  const host = new URL(base).host;
  const signedHeaders = "host;x-amz-date";
  const canonicalHeaders = `host:${host}
x-amz-date:${stamp}
`;
  const payloadHash = sha256Hex("");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${deps.accessKeySecret}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    url: `${base}${canonicalUri}${canonicalQuery.length === 0 ? "" : `?${canonicalQuery}`}`,
    headers: {
      host,
      "x-amz-date": stamp,
      authorization: `AWS4-HMAC-SHA256 Credential=${deps.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "user-agent": userAgentOf(config)
    },
    canonicalRequest,
    signature
  };
}
function signRequestUnsignedPayload(config, deps, method, key, query = {}) {
  const now = deps.now ?? /* @__PURE__ */ new Date();
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const region = config.region ?? "us-east-1";
  const base = config.endpoint.replace(/\/$/, "");
  const canonicalUri = `/${encodePart(config.bucket, false)}${key.length === 0 ? "" : `/${encodePart(key, false)}`}`;
  const canonicalQuery = Object.entries(query).map(([name2, value]) => `${encodePart(name2, true)}=${encodePart(value, true)}`).sort().join("&");
  const payloadHash = "UNSIGNED-PAYLOAD";
  const host = new URL(base).host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}
x-amz-content-sha256:${payloadHash}
x-amz-date:${stamp}
`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${deps.accessKeySecret}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    url: `${base}${canonicalUri}${canonicalQuery.length === 0 ? "" : `?${canonicalQuery}`}`,
    headers: {
      host,
      "x-amz-date": stamp,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${deps.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "user-agent": userAgentOf(config)
    },
    canonicalRequest,
    signature
  };
}
var KEY_BLOCK = /<Key>([\s\S]*?)<\/Key>/i;
var LAST_MODIFIED = /<LastModified>([\s\S]*?)<\/LastModified>/i;
var SIZE = /<Size>([\s\S]*?)<\/Size>/i;
var CONTENTS = /<Contents>[\s\S]*?<\/Contents>/gi;
var COMMON_PREFIX = /<CommonPrefixes>[\s\S]*?<Prefix>([\s\S]*?)<\/Prefix>[\s\S]*?<\/CommonPrefixes>/gi;
function decode(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}
function parseListing(xml) {
  const objects = [];
  for (const block of xml.match(CONTENTS) ?? []) {
    const key = KEY_BLOCK.exec(block)?.[1];
    if (key === void 0) continue;
    const lastModified = LAST_MODIFIED.exec(block)?.[1];
    const size = SIZE.exec(block)?.[1];
    const parsedSize = size === void 0 ? void 0 : Number.parseInt(size, 10);
    objects.push({
      key: decode(key),
      ...lastModified === void 0 ? {} : { lastModified: decode(lastModified) },
      ...parsedSize === void 0 || Number.isNaN(parsedSize) ? {} : { bytes: parsedSize }
    });
  }
  return objects;
}
async function listPrefix(config, prefix, deps, extra = {}) {
  const sign = signer(config);
  const v2 = sign(config, deps, "GET", "", { "list-type": "2", prefix, ...extra });
  const first = await deps.fetch(v2.url, { method: "GET", headers: v2.headers });
  if (first.ok) return parseListing(await first.text());
  const refusal2 = await refused(first, "\u5217\u5BF9\u8C61");
  if (first.status < 500) {
    if (config.signatureVersion?.toLowerCase() !== "v2" && first.status === 401) {
      const minimal = signRequestV4Minimal(config, deps, "GET", "", { "list-type": "2", prefix, ...extra });
      const retry = await deps.fetch(minimal.url, { method: "GET", headers: minimal.headers });
      if (retry.ok) return parseListing(await retry.text());
      throw new Error(
        `${(await refused(retry, "\u5217\u5BF9\u8C61\uFF08\u7CBE\u7B80 v4\uFF09")).message}
\u5B8C\u6574 v4\uFF1A${refusal2.message}`
      );
    }
    throw refusal2;
  }
  const v1 = sign(config, deps, "GET", "", { prefix, ...extra });
  const second = await deps.fetch(v1.url, { method: "GET", headers: v1.headers });
  if (!second.ok) {
    throw new Error(`${await refused(second, "\u5217\u5BF9\u8C61\uFF08V1 \u56DE\u9000\uFF09").then((e) => e.message)}
\u9996\u6B21\u5C1D\u8BD5\uFF1A${refusal2.message}`);
  }
  return parseListing(await second.text());
}
async function listTopLevel(config, deps) {
  const sign = signer(config);
  const v2 = sign(config, deps, "GET", "", { "list-type": "2", delimiter: "/", "max-keys": "100" });
  const first = await deps.fetch(v2.url, { method: "GET", headers: v2.headers });
  if (first.ok) return parsePrefixes(await first.text());
  if (first.status >= 500) {
    const v1 = sign(config, deps, "GET", "", { delimiter: "/", "max-keys": "100" });
    const second = await deps.fetch(v1.url, { method: "GET", headers: v1.headers });
    if (second.ok) return parsePrefixes(await second.text());
  }
  return [];
}
function parsePrefixes(xml) {
  const prefixes = [];
  for (const match of xml.matchAll(COMMON_PREFIX)) {
    const value = decode(match[1] ?? "");
    if (value.length === 0) continue;
    prefixes.push(value.replace(/\/$/, ""));
  }
  return prefixes;
}
async function readObject(config, key, deps) {
  const signed = signer(config)(config, deps, "GET", key);
  const response = await deps.fetch(signed.url, { method: "GET", headers: signed.headers });
  if (!response.ok) throw await refused(response, "\u53D6\u5BF9\u8C61");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const declared = response.headers?.get("content-type") ?? "application/octet-stream";
  return { bytes, contentType: declared.split(";")[0] ?? "application/octet-stream" };
}
async function putObject(config, key, body, deps, contentType = "application/octet-stream") {
  const signed = signer(config)(config, deps, "PUT", key, {}, body);
  const response = await deps.fetch(signed.url, {
    method: "PUT",
    headers: {
      ...signed.headers,
      "content-type": contentType,
      "content-length": String(body.byteLength)
    },
    body
  });
  if (!response.ok) throw await refused(response, "\u5199\u5BF9\u8C61");
}
async function deleteObject(config, key, deps) {
  const signed = signer(config)(config, deps, "DELETE", key);
  const response = await deps.fetch(signed.url, { method: "DELETE", headers: signed.headers });
  if (!response.ok && response.status !== 404) throw await refused(response, "\u5220\u5BF9\u8C61");
}
function signer(config) {
  return config.signatureVersion?.toLowerCase() === "v2" ? signRequestV2 : signRequest;
}

// src/host/webdav/client.ts
function authHeaders(auth) {
  if (auth === void 0) return {};
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
  return { authorization: `Basic ${token}` };
}
function userAgentHeaders(deps) {
  const configured = deps.userAgent?.trim() ?? "";
  return { "user-agent": configured.length === 0 ? DEFAULT_USER_AGENT : configured };
}
function joinUrl(base, part) {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = part.startsWith("/") ? part.slice(1) : part;
  return `${left}/${right}`;
}
async function writeFile(baseUrl, path, bytes, deps, contentType = "application/octet-stream") {
  const response = await deps.fetch(joinUrl(baseUrl, path), {
    method: "PUT",
    headers: {
      ...authHeaders(deps.auth),
      ...userAgentHeaders(deps),
      "content-type": contentType,
      "content-length": String(bytes.byteLength)
    },
    body: new TextDecoder().decode(bytes)
  });
  if (response.status >= 400) {
    const detail = (await response.text().catch(() => "")).trim().slice(0, 200);
    throw new Error(`\u5199\u8FDC\u7AEF\u5931\u8D25\uFF1AHTTP ${String(response.status)}${detail.length === 0 ? "" : ` \xB7 ${detail}`}`);
  }
}
async function deleteFile(baseUrl, path, deps) {
  const response = await deps.fetch(joinUrl(baseUrl, path), {
    method: "DELETE",
    headers: { ...authHeaders(deps.auth), ...userAgentHeaders(deps) }
  });
  if (response.status === 404) return;
  if (response.status >= 400) {
    const detail = (await response.text().catch(() => "")).trim().slice(0, 200);
    throw new Error(`\u5220\u8FDC\u7AEF\u5931\u8D25\uFF1AHTTP ${String(response.status)}${detail.length === 0 ? "" : ` \xB7 ${detail}`}`);
  }
}
var RESPONSE_BLOCK = /<[a-z0-9]*:?response\b[\s\S]*?<\/[a-z0-9]*:?response>/gi;
var HREF = /<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i;
var LAST_MODIFIED2 = /<[a-z0-9]*:?getlastmodified[^>]*>([\s\S]*?)<\/[a-z0-9]*:?getlastmodified>/i;
var CONTENT_TYPE = /<[a-z0-9]*:?getcontenttype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?getcontenttype>/i;
var IS_COLLECTION = /<[a-z0-9]*:?collection\s*\/?>/i;
function decode2(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}
function parseListing2(xml, directory) {
  const files = [];
  const folder = directory.replace(/\/+$/, "");
  for (const block of xml.match(RESPONSE_BLOCK) ?? []) {
    if (IS_COLLECTION.test(block)) continue;
    const href = HREF.exec(block)?.[1];
    if (href === void 0) continue;
    const path = decode2(href);
    if (folder.length > 0 && path.replace(/\/+$/, "").endsWith(folder)) continue;
    const lastModified = LAST_MODIFIED2.exec(block)?.[1];
    const contentType = CONTENT_TYPE.exec(block)?.[1];
    files.push({
      path,
      ...lastModified === void 0 ? {} : { lastModified: decode2(lastModified) },
      ...contentType === void 0 ? {} : { contentType: decode2(contentType).split(";")[0] ?? "" }
    });
  }
  return files;
}
async function refusal(what, response) {
  let body = "";
  try {
    body = (await response.text()).trim().slice(0, 200);
  } catch {
  }
  const identity = response.status === 401 || response.status === 403 ? "\n\uFF08\u8FD9\u7C7B\u7F51\u5173\u5E38\u6309\u5BA2\u6237\u7AEF\u6807\u8BC6\u8BA4\u4EBA\uFF1A\u8FD9\u4E2A\u8D26\u53F7\u7ED1\u5B9A\u7684\u5E94\u7528\u540D\u8981\u586B\u8FDB\u8BBE\u7F6E\u7684\u300C\u5BA2\u6237\u7AEF\u6807\u8BC6\u300D\uFF09" : "";
  return new Error(
    `${what}\u5931\u8D25\uFF1AHTTP ${String(response.status)}${body.length === 0 ? "" : ` \u2014 ${body.replace(/\s+/g, " ")}`}${identity}`
  );
}
async function listFolder(baseUrl, directory, deps) {
  const response = await deps.fetch(joinUrl(baseUrl, directory), {
    method: "PROPFIND",
    headers: {
      depth: "1",
      "content-type": "application/xml",
      ...authHeaders(deps.auth),
      ...userAgentHeaders(deps)
    },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontenttype/><d:resourcetype/></d:prop></d:propfind>'
  });
  if (!response.ok) {
    throw await refusal("\u5217\u76EE\u5F55", response);
  }
  return parseListing2(await response.text(), directory);
}
async function readFile(path, deps, absoluteUrl) {
  const response = await deps.fetch(absoluteUrl ?? path, {
    method: "GET",
    headers: { ...authHeaders(deps.auth), ...userAgentHeaders(deps) }
  });
  if (!response.ok) {
    throw await refusal("\u53D6\u6587\u4EF6", response);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const declared = response.headers?.get("content-type") ?? "application/octet-stream";
  return { bytes, contentType: declared.split(";")[0] ?? "application/octet-stream" };
}

// src/shared/panel-wire.ts
var INBOX_API_PREFIX = "/api/inbox";
var INBOX_ENDPOINT_CAPTURE = "capture";
var INBOX_ENDPOINT_LIST = "list";
var INBOX_ENDPOINT_DETAIL = "detail";
var INBOX_ENDPOINT_UPDATE = "update";
var INBOX_ENDPOINT_DELETE = "delete";
var INBOX_ENDPOINT_RESTORE = "restore";
var INBOX_ENDPOINT_PURGE = "purge";
var INBOX_ENDPOINT_ATTACHMENT = "attachment";
var INBOX_ENDPOINT_WEBDAV = "webdav";
var INBOX_ENDPOINT_PULL = "pull";
var INBOX_ENDPOINT_PROBE = "probe";
var INBOX_ENDPOINT_UI = "ui";
var INBOX_ENDPOINT_TAGS = "tags";
var INBOX_ENDPOINT_SECRET = "secret";
var INBOX_ENDPOINT_PUSH = "push";
var DEFAULT_SYNC_DIRECTORY = "inbox";
function syncDirectory(raw) {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length === 0 ? DEFAULT_SYNC_DIRECTORY : trimmed;
}
function syncRootFor(raw) {
  return `${syncDirectory(raw)}/sync`;
}
var INBOX_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
var LIST_LIMIT = 50;
var UI_LIST_MODES = ["grid", "compact"];
var PREVIEW_CHARS = 140;
var MAX_ATTACHMENTS_PER_SUBMISSION = 20;
var MAX_NOTE_CHARS = 2e3;
var MAX_TAGS = 20;
var MAX_TAG_CHARS = 40;
var MAX_FILTER_CHARS = 200;
var MAX_TITLE_CHARS = 300;

// src/host/webdav/config.ts
import z from "@deepseek-ai/schemastery";

// src/host/settings.ts
function settingsService(ctx) {
  return ctx.get("settings");
}
function markLive(field) {
  const mark = field.volatile;
  return typeof mark === "function" ? mark.call(field) : field;
}
function legacySettings(ctx) {
  const settings = settingsService(ctx);
  return typeof settings?.register === "function" ? settings : void 0;
}
function settingsStore(ctx) {
  const settings = settingsService(ctx);
  if (settings === void 0) return void 0;
  if (typeof settings.register === "function") {
    const legacy = settings;
    return {
      read: (section) => legacy.get(section.namespace),
      write: async (section, patch) => {
        try {
          await legacy.update(section.namespace, patch);
          return { ok: true };
        } catch (error) {
          return { ok: false, reason: reasonOf(error) };
        }
      }
    };
  }
  if (typeof settings.describe === "function" && typeof settings.update === "function") {
    const id = pluginRowId(ctx);
    if (id === void 0) return void 0;
    const modern = settings;
    return {
      read: (section) => {
        const row = readable(modern).find((each) => each.ns === id);
        return row?.value === void 0 ? void 0 : pick(row.value, section.fields);
      },
      write: async (section, patch) => {
        try {
          await modern.update(id, pick(patch, section.fields));
          return { ok: true };
        } catch (error) {
          return { ok: false, reason: reasonOf(error) };
        }
      }
    };
  }
  return void 0;
}
function pluginRowId(ctx) {
  const fiber = ctx.fiber;
  const entry = fiber?.entry;
  const id = entry?.options?.id;
  return typeof id === "string" && id.length > 0 ? id : void 0;
}
function readable(settings) {
  try {
    return settings.describe();
  } catch {
    return [];
  }
}
function pick(source, fields) {
  const picked = {};
  for (const field of fields) if (Object.hasOwn(source, field)) picked[field] = source[field];
  return picked;
}
function reasonOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/host/webdav/config.ts
var SETTINGS_NAMESPACE = "dsh-inbox-webdav";
var PASSWORD_KEY = "DSH_INBOX_WEBDAV_PASSWORD";
var S3_SECRET_KEY = "DSH_INBOX_S3_SECRET";
var DEFAULT_SETTINGS = {
  protocol: "webdav",
  baseUrl: "",
  directory: "/inbox",
  adoptForeignRoots: false,
  username: "",
  endpoint: "",
  bucket: "",
  region: "us-east-1",
  signatureVersion: "v4",
  accessKeyId: "",
  userAgent: "",
  webdavUserAgent: ""
};
var WEBDAV_FIELDS = {
  protocol: z.union(["webdav", "s3"]).default("webdav"),
  baseUrl: z.string().default(""),
  directory: z.string().default("/inbox"),
  adoptForeignRoots: z.boolean().default(false),
  username: z.string().default(""),
  endpoint: z.string().default(""),
  bucket: z.string().default(""),
  region: z.string().default("us-east-1"),
  signatureVersion: z.string().default("v4"),
  accessKeyId: z.string().default(""),
  userAgent: z.string().default(""),
  webdavUserAgent: z.string().default("")
};
var WebdavSettingsSchema = z.object(WEBDAV_FIELDS);
var WEBDAV_SECTION = {
  namespace: SETTINGS_NAMESPACE,
  fields: Object.keys(WEBDAV_FIELDS)
};
function readSettings(ctx) {
  const store = settingsStore(ctx);
  if (store === void 0) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...store.read(WEBDAV_SECTION) };
}
function installWebdavSettings(ctx, base = DEFAULT_SETTINGS) {
  const settings = legacySettings(ctx);
  if (settings === void 0) return;
  try {
    settings.register(SETTINGS_NAMESPACE, WebdavSettingsSchema, { base });
  } catch {
  }
}
async function readPassword(ctx) {
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return void 0;
  try {
    return (await credentials.resolve(PASSWORD_KEY))?.value;
  } catch {
    return void 0;
  }
}
async function readS3Secret(ctx) {
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return void 0;
  try {
    return (await credentials.resolve(S3_SECRET_KEY))?.value;
  } catch {
    return void 0;
  }
}
async function describeWebdav(ctx) {
  const credentials = ctx.get("credentials");
  const password = await readPassword(ctx);
  const secret = await readS3Secret(ctx);
  return {
    settings: readSettings(ctx),
    passwordSet: password !== void 0,
    secretSet: secret !== void 0,
    settingsAvailable: ctx.get("settings") !== void 0,
    credentialsAvailable: credentials !== void 0
  };
}
function activeUserAgent(settings) {
  return settings.protocol === "s3" ? settings.userAgent : settings.webdavUserAgent;
}
function normalizeUrl(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
async function saveWebdav(ctx, vault, base, patch) {
  const credentials = ctx.get("credentials");
  const config = {};
  if (patch.protocol === "webdav" || patch.protocol === "s3") config.protocol = patch.protocol;
  if (patch.baseUrl !== void 0) config.baseUrl = normalizeUrl(patch.baseUrl);
  if (patch.directory !== void 0) {
    const directory = patch.directory.trim();
    config.directory = directory.startsWith("/") ? directory : `/${directory}`;
  }
  if (patch.adoptForeignRoots !== void 0) config.adoptForeignRoots = patch.adoptForeignRoots;
  if (patch.username !== void 0) config.username = patch.username.trim();
  if (patch.endpoint !== void 0) config.endpoint = normalizeUrl(patch.endpoint);
  if (patch.bucket !== void 0) config.bucket = patch.bucket.trim();
  if (patch.region !== void 0) config.region = patch.region.trim() || "us-east-1";
  if (patch.signatureVersion !== void 0) {
    const version = patch.signatureVersion.trim().toLowerCase();
    if (version !== "v4" && version !== "v2") {
      return { ok: false, reason: `\u7B7E\u540D\u7248\u672C\u53EA\u652F\u6301 v4 \u6216 v2\uFF0C\u6536\u5230\u7684\u662F ${version}` };
    }
    config.signatureVersion = version;
  }
  if (patch.accessKeyId !== void 0) config.accessKeyId = patch.accessKeyId.trim();
  if (patch.userAgent !== void 0) {
    const protocol = patch.protocol === "webdav" || patch.protocol === "s3" ? patch.protocol : readSettings(ctx).protocol;
    if (protocol === "webdav") config.webdavUserAgent = patch.userAgent.trim();
    else config.userAgent = patch.userAgent.trim();
  }
  if (Object.keys(config).length > 0) {
    installWebdavSettings(ctx, base);
    const store = settingsStore(ctx);
    if (store === void 0) {
      return { ok: false, reason: "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u8BBE\u7F6E\u670D\u52A1\uFF0C\u6539\u4E0D\u4E86\u5730\u5740" };
    }
    const written = await store.write(WEBDAV_SECTION, config);
    if (!written.ok) return { ok: false, reason: `\u5730\u5740\u6CA1\u5B58\u8FDB\u53BB\uFF1A${written.reason}` };
  }
  if (patch.password !== void 0) {
    if (credentials === void 0) {
      return { ok: false, reason: "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u51ED\u8BC1\u670D\u52A1\uFF0C\u5BC6\u7801\u4E0D\u77E5\u9053\u5B58\u54EA\u624D\u5B89\u5168" };
    }
    if (patch.password.length === 0) await credentials.unset(PASSWORD_KEY);
    else await credentials.set(PASSWORD_KEY, patch.password);
  }
  if (patch.accessKeySecret !== void 0) {
    if (credentials === void 0) {
      return { ok: false, reason: "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u51ED\u8BC1\u670D\u52A1\uFF0C\u5BC6\u94A5\u4E0D\u77E5\u9053\u5B58\u54EA\u624D\u5B89\u5168" };
    }
    if (patch.accessKeySecret.length === 0) await credentials.unset(S3_SECRET_KEY);
    else await credentials.set(S3_SECRET_KEY, patch.accessKeySecret);
  }
  void vault;
  return { ok: true };
}

// src/host/remote/pull.ts
import { admitEncodedFile, admitEncodedImages } from "@deepseek-ai/dsh-attachment";
var DEFAULT_DIRECTORY = "/inbox";
var TEXT_TYPES = ["text/", "application/json"];
var TEXT_SUFFIXES = [".txt", ".md", ".url", ".json"];
function looksTextual(name2, contentType) {
  const lower = name2.toLowerCase();
  if (TEXT_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  return contentType !== void 0 && TEXT_TYPES.some((prefix) => contentType.startsWith(prefix));
}
function syncPrefixOf(path) {
  const parts = path.split("/").filter((part) => part.length > 0);
  const at = parts.lastIndexOf("sync");
  if (at === -1) return void 0;
  return parts.slice(0, at + 1).slice(-2).join("/");
}
function laterOf(current, candidate) {
  if (candidate === void 0) return current;
  if (current === void 0) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}
function nameOf(path) {
  const parts = path.split("/").filter((part) => part.length > 0);
  return decodeURIComponent(parts[parts.length - 1] ?? path);
}
function isNewer(entry, lastPullAt) {
  if (lastPullAt === void 0) return true;
  if (entry.lastModified === void 0) return true;
  const seen = Date.parse(lastPullAt);
  const remote = Date.parse(entry.lastModified);
  if (Number.isNaN(seen) || Number.isNaN(remote)) return true;
  return remote > seen;
}
function isFolder(path, dropFolder) {
  if (path.endsWith("/")) return true;
  return dropFolder.length > 0 && path.replace(/\/+$/, "") === dropFolder;
}
async function ingestFrom(vault, source, attachments, syncRoot3 = syncRootFor(void 0), elsewhere = { roots: [] }) {
  const lastPullAt = vault.global.sync.lastPullAt;
  const dropFolder = syncRoot3.endsWith("/sync") ? syncRoot3.slice(0, -"/sync".length) : "";
  let entries;
  try {
    entries = await source.list();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "failed", reason, pulled: 0, failed: 0, skipped: 0, listed: 0 };
  }
  const listed = entries.length;
  let pulled = 0;
  let failed2 = 0;
  let skipped = 0;
  let skippedSync = 0;
  let skippedOlder = 0;
  let skippedForeign = 0;
  let skippedFolders = 0;
  let remoteRecords = 0;
  let remoteAttachments = 0;
  const foreignSyncRoots = new Set(elsewhere.roots);
  let foreignRecords = elsewhere.records ?? 0;
  let newestSuccess;
  const failures = [];
  for (const entry of entries) {
    const prefix = syncPrefixOf(entry.path);
    if (prefix !== void 0 && prefix !== syncRoot3) {
      skipped += 1;
      skippedForeign += 1;
      foreignSyncRoots.add(prefix);
      const parts = entry.path.split("/").filter((part) => part.length > 0);
      if ((parts[parts.length - 2] ?? "") === "items" && (parts[parts.length - 1] ?? "").endsWith(".json")) {
        foreignRecords += 1;
      }
      continue;
    }
    if (prefix !== void 0) {
      skipped += 1;
      skippedSync += 1;
      const parts = entry.path.split("/").filter((part) => part.length > 0);
      const folder = parts[parts.length - 2] ?? "";
      const name3 = parts[parts.length - 1] ?? "";
      if (folder === "items" && name3.endsWith(".json")) remoteRecords += 1;
      else if (folder === "attachments" && !name3.endsWith(".meta.json")) remoteAttachments += 1;
      continue;
    }
    if (isFolder(entry.path, dropFolder)) {
      skipped += 1;
      skippedFolders += 1;
      continue;
    }
    if (!isNewer(entry, lastPullAt)) {
      skipped += 1;
      skippedOlder += 1;
      continue;
    }
    const name2 = nameOf(entry.path);
    try {
      const finished = entry.lastModified;
      const fetched = await source.read(entry);
      if (looksTextual(name2, entry.contentType ?? fetched.contentType)) {
        await captureText(vault, new TextDecoder().decode(fetched.bytes), "webdav");
        pulled += 1;
        newestSuccess = laterOf(newestSuccess, finished);
        continue;
      }
      const data = Buffer.from(fetched.bytes).toString("base64");
      const mediaType = entry.contentType ?? fetched.contentType;
      if (INBOX_IMAGE_TYPES.includes(mediaType)) {
        const [ref2] = await admitEncodedImages(attachments, [
          { mediaType, data, name: name2 }
        ]);
        if (ref2 !== void 0) {
          await captureImage(
            vault,
            {
              id: ref2.attachmentId,
              mime: ref2.mediaType,
              bytes: ref2.bytes,
              width: ref2.width,
              height: ref2.height,
              filename: name2
            },
            "webdav"
          );
          pulled += 1;
          newestSuccess = laterOf(newestSuccess, finished);
          continue;
        }
      }
      const ref = await admitEncodedFile(attachments, { data, name: name2 });
      await captureImage(
        vault,
        { id: ref.attachmentId, mime: mediaType, bytes: ref.bytes, filename: name2 },
        "webdav"
      );
      pulled += 1;
      newestSuccess = laterOf(newestSuccess, finished);
    } catch (error) {
      failed2 += 1;
      failures.push(`${name2}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const cursor = failed2 > 0 && newestSuccess === void 0 ? lastPullAt : newestSuccess ?? now;
  await vault.setSync({ ...vault.global.sync, lastPullAt: cursor });
  return {
    status: "ok",
    pulled,
    failed: failed2,
    skipped,
    skippedSync,
    skippedOlder,
    skippedForeign,
    skippedFolders,
    remoteRecords,
    remoteAttachments,
    syncRoot: syncRoot3,
    ...foreignSyncRoots.size === 0 ? {} : { foreignSyncRoots: [...foreignSyncRoots] },
    ...foreignRecords === 0 ? {} : { foreignRecords },
    listed,
    lastPullAt: cursor,
    ...failures.length === 0 ? {} : { reason: failures.slice(0, 3).join("\uFF1B") }
  };
}
async function pullRemote(vault, config, deps) {
  const baseUrl = config.baseUrl.trim();
  if (baseUrl.length === 0) {
    return {
      status: "unconfigured",
      reason: "\u8FD8\u6CA1\u914D\u7F6E WebDAV \u5730\u5740",
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0
    };
  }
  const directory = `/${syncDirectory(config.directory ?? DEFAULT_DIRECTORY)}`;
  return ingestFrom(
    vault,
    {
      list: async () => (await listFolder(baseUrl, directory, deps)).map((file) => ({
        path: file.path,
        ...file.lastModified === void 0 ? {} : { lastModified: file.lastModified },
        ...file.contentType === void 0 ? {} : { contentType: file.contentType }
      })),
      read: async (entry) => readFile(entry.path, deps, entry.path.startsWith("http") ? entry.path : void 0)
    },
    deps.attachments,
    // WebDAV resolves the sync root from the same directory rule the writer uses.
    syncRootFor(config.directory)
  );
}
async function pullS3(vault, config, directory, deps) {
  if (config.endpoint.trim().length === 0 || config.bucket.trim().length === 0) {
    return {
      status: "unconfigured",
      reason: "\u8FD8\u6CA1\u914D\u7F6E S3 \u7684 endpoint \u6216 bucket",
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0
    };
  }
  const scope = syncDirectory(directory);
  return ingestFrom(
    vault,
    {
      list: async () => (await listPrefix(config, `${scope}/`, deps)).map((object) => ({
        path: object.key,
        ...object.lastModified === void 0 ? {} : { lastModified: object.lastModified }
      })),
      read: async (entry) => readObject(config, entry.path, deps)
    },
    deps.attachments,
    // The vault's own tree, resolved by the same rule the writer uses.
    syncRootFor(directory),
    await s3RootsElsewhere(config, deps, scope)
  );
}
var PROBE_CANDIDATES = 5;
async function s3RootsElsewhere(config, deps, scope) {
  try {
    const tops = await listTopLevel(config, deps);
    const found = [];
    let records = 0;
    for (const top of tops.slice(0, PROBE_CANDIDATES)) {
      if (top === scope || top.startsWith(`${scope}/`)) continue;
      for (const probe2 of [`${top}/sync/items/`, `${top}/items/`]) {
        const inside = await listPrefix(config, probe2, deps, { "max-keys": "1000" });
        if (inside.length > 0) {
          found.push(probe2.replace(/\/items\/$/, ""));
          records += inside.filter((object) => object.key.endsWith(".json")).length;
          break;
        }
      }
    }
    return found.length === 0 ? { roots: [] } : { roots: found, records };
  } catch {
    return { roots: [] };
  }
}

// src/host/vault/spec.ts
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z as z2 } from "zod";
var timestamp = z2.string().min(1);
var itemSchema = z2.object({
  id: z2.string().min(1),
  kind: z2.enum(KINDS),
  category: z2.enum(CATEGORIES),
  /**
   * Who decided the category — `user` outranks `model`, which outranks `rule`.
   * Absent on records written before domain version 2.
   */
  categorySource: z2.enum(CATEGORY_SOURCES).optional(),
  /**
   * "I want to come back to this" — the only progress flag, and the user's to
   * set. Absent means not flagged, which is where every new record starts.
   *
   * Domain version 3 replaced the old read/unread pair with this: read/unread
   * claimed knowledge the software does not have (nothing here knows whether
   * you *consumed* a link), and it made every capture start as "unread", so the
   * badge counted your own typing back at you.
   */
  watchLater: z2.boolean().optional(),
  source: z2.enum(SOURCES),
  createdAt: timestamp,
  updatedAt: timestamp,
  /** Link title, or a short label the user gave a text note. */
  title: z2.string().optional(),
  /**
   * The headline fetched from the link's own page (`<title>`), never the user's
   * word and never derived from record content.
   *
   * Kept apart from `title` on purpose: `title` is what the person typed, and
   * the credentials rule ("only the user names a record", `AGENTS.md` 3) has to
   * stay true even with an automatic writer in the picture.
   */
  linkTitle: z2.string().optional(),
  /**
   * Why the last headline fetch did not produce a `linkTitle`.
   *
   * A short code, not a sentence: the panel turns it into a hint ("那个站点要求
   * 验证"), and the point of storing it at all is that a *silent* miss is
   * indistinguishable from a broken feature. Cleared when a headline does arrive.
   */
  linkTitleError: z2.string().optional(),
  /** The pasted text itself, for `text` and `secret` records. */
  text: z2.string().optional(),
  /**
   * A credential's text, sealed with the master password (`crypto/secret-box.ts`).
   *
   * Its own field for one reason: `text` is what the panel shows and what the
   * search reads, and a credential's body must reach neither in the clear. A
   * sealed record has `secret` and **no** `text` — the migration moves them.
   */
  secret: z2.string().optional(),
  /**
   * A keyed digest of a credential's plaintext, so a re-paste can be recognised
   * as the same credential without keeping the plaintext around to compare.
   *
   * Useless to an attacker without the master key, which is the point: it
   * survives on disk (and, later, in the sync package) while the secret does not.
   */
  secretDigest: z2.string().optional(),
  url: z2.string().optional(),
  /** Recognised host platform: bilibili, wechat, zhihu, xiaohongshu, … */
  platform: z2.string().optional(),
  /** Description the user appended. When present it is the authoritative label. */
  note: z2.string().optional(),
  /** Soft delete marker; a deleted item keeps its bytes and can be restored. */
  deletedAt: z2.string().optional(),
  tags: z2.array(z2.string()),
  attachmentIds: z2.array(z2.string())
});
var attachmentSchema = z2.object({
  /**
   * Our own record key. It has to be path-safe (`[a-zA-Z0-9_-]+`) because the
   * per-record backend names a document after it — which is exactly why the
   * store's id below cannot serve as the key.
   */
  id: z2.string().min(1),
  /**
   * The owning store's identifier: dsh's attachment id for anything the user
   * pasted. Opaque, and observed in the wild as `sha256:<hex>` — the colon is
   * not path-safe, so it lives here and never in the key.
   */
  storeId: z2.string().min(1),
  mime: z2.string().min(1),
  bytes: z2.number().int().nonnegative(),
  createdAt: timestamp,
  filename: z2.string().optional(),
  width: z2.number().int().positive().optional(),
  height: z2.number().int().positive().optional(),
  /** Present when the medium identifies the bytes by digest. */
  sha256: z2.string().optional()
});
var graveSchema = z2.object({
  /** The record's own key, repeated inside the document (see `attachments`). */
  id: z2.string().min(1),
  /** When the user emptied it out of the bin. */
  purgedAt: timestamp
});
var masterSchema = z2.object({
  version: z2.number().int().positive(),
  salt: z2.string(),
  kdf: z2.object({ n: z2.number().int().positive(), r: z2.number().int().positive(), p: z2.number().int().positive() }),
  verifier: z2.string()
});
var vaultGlobalSchema = z2.object({
  sync: z2.object({
    lastPullAt: z2.string().optional(),
    /** When this machine last wrote its own records up; the push cursor. */
    lastPushAt: z2.string().optional(),
    cursor: z2.string().optional()
  }),
  master: masterSchema.optional(),
  /** Today's model-fallback spend, so a restart cannot reset the meter. */
  model: z2.object({
    day: z2.string(),
    calls: z2.number().int().nonnegative(),
    tokens: z2.number().int().nonnegative(),
    /** Why the last attempt ended the way it did; the only place to look when
     * a category did not change and the log is long gone. */
    last: z2.string().optional()
  }).optional()
});
var vaultSpec = defineDomain({
  name: "dsh_inbox",
  /**
   * Version 2 added the optional `categorySource`; version 3 swaps
   * `status` for `watchLater` and drops the `待看` tag. Both older shapes still
   * validate — the removed `status` key is simply ignored, and `watchLater` is
   * optional — and `Vault.open` rewrites them once so the flag is real.
   *
   * Version 4 adds the optional `linkTitle` (the fetched page headline). It is
   * a pure addition, so every older record still validates unchanged.
   * Version 4 adds the optional `linkTitle` (the fetched page headline), version
   * 5 the optional `linkTitleError` that explains a miss. Both are pure
   * additions, so every older record still validates unchanged.
   *
   * Version 6 adds the optional `secret` / `secretDigest`: a credential's text
   * moves out of `text` and into a sealed envelope. Also a pure addition — a
   * version-5 record with plaintext simply gets migrated on the next unlock.
   *
   * Version 7 adds `sync.lastPushAt`: the cursor that keeps a push to "what
   * changed since last time" instead of re-uploading the vault on every pass.
   * A `global` field, so no record shape changes at all.
   *
   * Version 8 adds the `graves` table: one row per record the user emptied out
   * of the bin. A purge leaves no local row, so the merge had nothing to
   * outrank the cloud's copy with — with 「同时合并别的同步目录」 on, the older
   * tree in the same bucket filed all thirteen of them back into the bin on
   * every restart (measured 2026-09-21). A new table, so no record shape
   * changes; an older vault simply has no graves, and there is nothing to
   * protect until the next purge.
   *
   * Still version 8 after the master password's *parameters* started travelling
   * with sync (2026-10-01): that is one more object in the vault's sync tree
   * (`sync/master.json`), not a change to any stored shape — an older build
   * ignores a name it does not know, and a newer build over a version-8 vault
   * finds `global.master` exactly where it always was.
   */
  version: 8,
  compatibleVersions: [1, 2, 3, 4, 5, 6, 7],
  layout: "per-record",
  global: {
    schema: vaultGlobalSchema,
    initial: { sync: {} }
  },
  tables: {
    items: domainTable(itemSchema),
    attachments: domainTable(attachmentSchema),
    graves: domainTable(graveSchema)
  }
});

// src/host/remote/merge.ts
import { admitEncodedFile as admitEncodedFile2, admitEncodedImages as admitEncodedImages2 } from "@deepseek-ai/dsh-attachment";
function nameOf2(path) {
  const parts = path.split("/").filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? path;
}
function idOf(path) {
  const name2 = decodeURIComponent(nameOf2(path));
  const match = /^([0-9a-fA-F-]{36})\.([A-Za-z0-9]{1,8})$/.exec(name2);
  return match?.[1];
}
function itemOf(bytes) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed.format !== "dsh-inbox-item/1") return void 0;
    const record = parsed.record;
    if (record === void 0 || typeof record.id !== "string") return void 0;
    if (typeof record.updatedAt !== "string") return void 0;
    return record;
  } catch {
    return void 0;
  }
}
function attachmentOf(bytes) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed.format !== "dsh-inbox-attachment/1") return void 0;
    const row = parsed.attachment;
    if (row === void 0 || typeof row.id !== "string" || typeof row.mime !== "string") {
      return void 0;
    }
    return row;
  } catch {
    return void 0;
  }
}
function masterOf(bytes) {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed.format !== "dsh-inbox-master/1") return void 0;
    const result = masterSchema.safeParse(parsed.master);
    return result.success ? result.data : void 0;
  } catch {
    return void 0;
  }
}
async function findMasterObject(tree, prefix) {
  const wanted = `${prefix}/master.json`;
  for (const object of await tree.list(`${prefix}/`)) {
    if (nameOf2(object.path) !== "master.json") continue;
    if (!object.path.replace(/\/+$/, "").endsWith(wanted)) continue;
    return object.path;
  }
  return void 0;
}
async function adoptMasterParams(vault, tree, prefix) {
  const state = vault.lockState;
  if (state.configured || state.sealedRecords === 0) return { adopted: false };
  let path;
  try {
    path = await findMasterObject(tree, prefix);
  } catch (error) {
    return {
      adopted: false,
      note: `\u672C\u673A\u6709 ${String(state.sealedRecords)} \u6761\u5BC6\u6587\uFF0C\u4F46\u5217\u8FDC\u7AEF\u540C\u6B65\u76EE\u5F55\u5931\u8D25\uFF08${reasonOf2(error)}\uFF09\uFF1A\u7A0D\u540E\u518D\u62C9\u4E00\u6B21`
    };
  }
  if (path === void 0) {
    return {
      adopted: false,
      note: `\u672C\u673A\u6709 ${String(state.sealedRecords)} \u6761\u5BC6\u6587\uFF0C\u4F46\u8FDC\u7AEF\u8FD8\u6CA1\u6709\u4E3B\u5BC6\u7801\u53C2\u6570\uFF1A\u5148\u5728\u539F\u6765\u90A3\u53F0\u673A\u5668\u4E0A\u63A8\u4E00\u6B21\uFF08\u5B83\u8981\u5347\u5230\u5E26 \`master.json\` \u7684\u7248\u672C\uFF09\uFF0C\u518D\u56DE\u6765\u62C9\u53D6`
    };
  }
  let bytes;
  try {
    bytes = await tree.read(path);
  } catch (error) {
    return {
      adopted: false,
      note: `\u672C\u673A\u6709 ${String(state.sealedRecords)} \u6761\u5BC6\u6587\uFF0C\u4F46\u8FDC\u7AEF\u7684\u4E3B\u5BC6\u7801\u53C2\u6570\u53D6\u4E0D\u4E0B\u6765\uFF08${reasonOf2(error)}\uFF09\uFF1A\u7A0D\u540E\u518D\u62C9\u4E00\u6B21`
    };
  }
  const parsed = masterOf(bytes);
  if (parsed === void 0) {
    return {
      adopted: false,
      note: `\u8FDC\u7AEF\u7684 ${path} \u4E0D\u662F\u672C\u63D2\u4EF6\u7684\u5BC6\u94A5\u53C2\u6570\u683C\u5F0F\uFF0C\u672C\u673A\u7684 ${String(state.sealedRecords)} \u6761\u5BC6\u6587\u6682\u65F6\u89E3\u4E0D\u5F00`
    };
  }
  if (!await vault.adoptMaster(parsed)) return { adopted: false };
  return {
    adopted: true,
    note: `\u5DF2\u53D6\u56DE\u4E3B\u5BC6\u7801\u53C2\u6570\uFF1A\u672C\u673A\u7684 ${String(state.sealedRecords)} \u6761\u5BC6\u6587\u73B0\u5728\u53EF\u4EE5\u7528\u539F\u6765\u90A3\u53F0\u673A\u5668\u7684\u4E3B\u5BC6\u7801\u89E3\u9501\uFF08\u53C2\u6570\u4E0D\u542B\u5BC6\u7801\uFF0C\u5BC6\u7801\u8FD8\u662F\u5F97\u5728\u672C\u673A\u8F93\u4E00\u6B21\uFF09`
  };
}
function wins(remote, local) {
  if (local === void 0) return true;
  const incoming = Date.parse(remote.updatedAt);
  const current = Date.parse(local.updatedAt);
  if (Number.isNaN(incoming) || Number.isNaN(current)) return false;
  return incoming > current;
}
function newerThanPurge(vault, remote) {
  const purged = vault.purgedAt(remote.id);
  if (purged === void 0) return true;
  return Date.parse(remote.updatedAt) > Date.parse(purged);
}
async function mergeOnce(vault, tree, prefix, admit) {
  const failures = [];
  let merged = 0;
  let added = 0;
  let deletions = 0;
  let purged = 0;
  let kept = 0;
  let attachments = 0;
  let objects;
  try {
    objects = await tree.list(`${prefix}/items/`);
  } catch (error) {
    return {
      merged: 0,
      added: 0,
      deletions: 0,
      purged: 0,
      kept: 0,
      attachments: 0,
      masterAdopted: false,
      failures: [`\u5217\u8FDC\u7AEF\u540C\u6B65\u76EE\u5F55\u5931\u8D25\uFF1A${reasonOf2(error)}`]
    };
  }
  const wanted = /* @__PURE__ */ new Map();
  const bytesAt = /* @__PURE__ */ new Map();
  try {
    for (const object of await tree.list(`${prefix}/attachments/`)) {
      const id = idOf(object.path);
      if (id === void 0 || nameOf2(object.path).endsWith(".meta.json")) continue;
      bytesAt.set(id, object.path);
    }
  } catch (error) {
    failures.push(`\u5217\u8FDC\u7AEF\u9644\u4EF6\u76EE\u5F55\u5931\u8D25\uFF1A${reasonOf2(error)}`);
  }
  for (const object of objects) {
    const id = idOf(object.path);
    const name2 = decodeURIComponent(nameOf2(object.path));
    if (id === void 0 || !name2.endsWith(".json")) continue;
    try {
      const remote = itemOf(await tree.read(object.path));
      if (remote === void 0) {
        failures.push(`${name2}\uFF1A\u4E0D\u662F\u672C\u63D2\u4EF6\u7684\u8BB0\u5F55\u683C\u5F0F`);
        continue;
      }
      const local = vault.get(remote.id);
      if (local === void 0 && !newerThanPurge(vault, remote)) {
        purged += 1;
        continue;
      }
      if (!wins(remote, local)) {
        kept += 1;
        continue;
      }
      await vault.import(remote);
      merged += 1;
      if (local === void 0) added += 1;
      if (remote.deletedAt !== void 0) deletions += 1;
      for (const attachmentId of remote.attachmentIds) {
        if (vault.getAttachment(attachmentId) === void 0) {
          wanted.set(attachmentId, remote.id);
        }
      }
    } catch (error) {
      failures.push(`${name2}\uFF1A${reasonOf2(error)}`);
    }
  }
  for (const [attachmentId, owner] of wanted) {
    try {
      const meta = attachmentOf(await tree.read(`${prefix}/attachments/${attachmentId}.meta.json`));
      if (meta === void 0) {
        failures.push(`\u9644\u4EF6 ${attachmentId}\uFF08\u8BB0\u5F55 ${owner}\uFF09\uFF1A\u8FDC\u7AEF\u6CA1\u6709\u5B83\u7684\u5143\u6570\u636E`);
        continue;
      }
      const sibling = bytesAt.get(attachmentId);
      if (sibling === void 0) {
        failures.push(`\u9644\u4EF6 ${attachmentId}\uFF08\u8BB0\u5F55 ${owner}\uFF09\uFF1A\u8FDC\u7AEF\u6CA1\u6709\u5B83\u7684\u5B57\u8282`);
        continue;
      }
      const bytes = await tree.read(sibling);
      const name2 = meta.filename ?? `${attachmentId}.${extensionOfName(sibling)}`;
      const stored = meta.mime.startsWith("image/") ? await admit.image(bytes, meta.mime, name2) : await admit.file(bytes, name2);
      if (stored === void 0) {
        failures.push(`\u9644\u4EF6 ${attachmentId}\uFF1A\u672C\u673A\u9644\u4EF6\u4ED3\u5E93\u62D2\u7EDD\u4E86\u5B83`);
        continue;
      }
      await vault.importAttachment({ ...meta, storeId: stored.storeId });
      attachments += 1;
    } catch (error) {
      failures.push(`\u9644\u4EF6 ${attachmentId}\uFF1A${reasonOf2(error)}`);
    }
  }
  const master = await adoptMasterParams(vault, tree, prefix);
  return {
    merged,
    added,
    deletions,
    purged,
    kept,
    attachments,
    masterAdopted: master.adopted,
    ...master.note === void 0 ? {} : { masterNote: master.note },
    failures
  };
}
function extensionOfName(path) {
  return /\.([A-Za-z0-9]{1,8})$/.exec(nameOf2(path))?.[1]?.toLowerCase() ?? "bin";
}
function reasonOf2(error) {
  return error instanceof Error ? error.message : String(error);
}
async function mergeRemote(ctx, vault, attachments, extraRoots = []) {
  const settings = readSettings(ctx);
  const prefix = syncRoot(settings);
  try {
    const tree = settings.protocol === "s3" ? await s3Tree(ctx, settings) : await webdavTree(ctx, settings);
    if (tree === void 0) {
      return {
        merged: 0,
        added: 0,
        deletions: 0,
        purged: 0,
        kept: 0,
        attachments: 0,
        masterAdopted: false,
        failures: []
      };
    }
    const admit = admitWith(attachments);
    const outcome = await mergeOnce(vault, tree, prefix, admit);
    for (const root of extraRoots) {
      if (root === prefix) continue;
      const extra = await mergeOnce(vault, tree, root, admit);
      outcome.merged += extra.merged;
      outcome.added += extra.added;
      outcome.deletions += extra.deletions;
      outcome.purged += extra.purged;
      outcome.kept += extra.kept;
      outcome.attachments += extra.attachments;
      outcome.masterAdopted = outcome.masterAdopted || extra.masterAdopted;
      if (outcome.masterNote === void 0 && extra.masterNote !== void 0) {
        outcome.masterNote = extra.masterNote;
      }
      outcome.failures.push(...extra.failures);
    }
    return outcome;
  } catch (error) {
    return {
      merged: 0,
      added: 0,
      deletions: 0,
      purged: 0,
      kept: 0,
      attachments: 0,
      masterAdopted: false,
      failures: [reasonOf2(error)]
    };
  }
}
function admitWith(store) {
  return {
    image: async (bytes, mime, name2) => {
      if (!INBOX_IMAGE_TYPES.includes(mime)) return void 0;
      const data = Buffer.from(bytes).toString("base64");
      const [ref] = await admitEncodedImages2(store, [
        { mediaType: mime, data, name: name2 }
      ]);
      return ref === void 0 ? void 0 : { storeId: ref.attachmentId };
    },
    file: async (bytes, name2) => {
      const ref = await admitEncodedFile2(store, {
        data: Buffer.from(bytes).toString("base64"),
        name: name2
      });
      return { storeId: ref.attachmentId };
    }
  };
}
async function s3Tree(ctx, settings) {
  const secret = await readS3Secret(ctx);
  if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) return void 0;
  if (secret === void 0) return void 0;
  const config = {
    endpoint: settings.endpoint,
    bucket: settings.bucket,
    region: settings.region,
    signatureVersion: settings.signatureVersion,
    userAgent: activeUserAgent(settings)
  };
  const deps = {
    fetch: s3Fetch,
    accessKeyId: settings.accessKeyId,
    accessKeySecret: secret
  };
  return {
    list: async (path) => (await listPrefix(config, path, deps)).map((entry) => ({
      path: entry.key,
      ...entry.lastModified === void 0 ? {} : { lastModified: entry.lastModified }
    })),
    read: async (path) => (await readObject(config, path, deps)).bytes
  };
}
async function webdavTree(ctx, settings) {
  if (settings.baseUrl.trim().length === 0) return void 0;
  const password = await readPassword(ctx);
  const deps = {
    fetch: webdavFetch,
    ...settings.username.length === 0 || password === void 0 ? {} : { auth: { username: settings.username, password } },
    userAgent: activeUserAgent(settings)
  };
  const baseUrl = settings.baseUrl;
  return {
    list: async (path) => (await listFolder(baseUrl, path, deps)).map((file) => ({
      path: file.path,
      ...file.lastModified === void 0 ? {} : { lastModified: file.lastModified }
    })),
    read: async (path) => (await readFile(path, deps, path.startsWith("http") ? path : void 0)).bytes
  };
}

// src/host/webdav/run.ts
var webdavFetch = async (url, init) => {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    ...init.body === void 0 ? {} : { body: init.body }
  });
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
    headers: { get: (name2) => response.headers.get(name2) }
  };
};
var s3Fetch = async (url, init) => {
  const body = init.body === void 0 ? void 0 : init.body;
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    ...body === void 0 ? {} : { body }
  });
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
    headers: { get: (name2) => response.headers.get(name2) }
  };
};
async function runPull(ctx, vault, attachments) {
  return withMerge(ctx, vault, attachments, await pullDropFolder(ctx, vault, attachments));
}
async function withMerge(ctx, vault, attachments, pulled) {
  if (pulled.status !== "ok" || attachments === void 0) return pulled;
  const settings = readSettings(ctx);
  const extraRoots = settings.adoptForeignRoots ? pulled.foreignSyncRoots ?? [] : [];
  const outcome = await mergeRemote(ctx, vault, attachments, extraRoots);
  const troubles = [...pulled.failed > 0 && pulled.reason !== void 0 ? [pulled.reason] : [], ...outcome.failures];
  return {
    ...pulled,
    merged: outcome.merged,
    added: outcome.added,
    deletions: outcome.deletions,
    ...outcome.purged === 0 ? {} : { purged: outcome.purged },
    kept: outcome.kept,
    attachments: outcome.attachments,
    ...outcome.masterAdopted ? { masterAdopted: true } : {},
    ...outcome.masterNote === void 0 ? {} : { masterNote: outcome.masterNote },
    failed: pulled.failed + outcome.failures.length,
    ...troubles.length === 0 ? {} : { reason: troubles.slice(0, 3).join("\uFF1B") }
  };
}
async function pullDropFolder(ctx, vault, attachments) {
  const settings = readSettings(ctx);
  if (attachments === void 0) {
    return {
      status: "failed",
      reason: "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u9644\u4EF6\u4ED3\u5E93\uFF0C\u62C9\u4E0B\u6765\u7684\u6587\u4EF6\u6CA1\u5904\u653E",
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0
    };
  }
  if (settings.protocol === "s3") {
    const secret = await readS3Secret(ctx);
    if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
      return {
        status: "unconfigured",
        reason: "\u8FD8\u6CA1\u914D\u7F6E S3 \u7684 endpoint \u6216 bucket",
        pulled: 0,
        failed: 0,
        skipped: 0,
        listed: 0
      };
    }
    if (secret === void 0) {
      return {
        status: "unconfigured",
        reason: "\u8FD8\u6CA1\u5B58 S3 \u7684 AccessKey Secret",
        pulled: 0,
        failed: 0,
        skipped: 0,
        listed: 0
      };
    }
    return pullS3(
      vault,
      {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
        userAgent: activeUserAgent(settings)
      },
      // The configured directory, not a pre-trimmed string: `/`, `''` and
      // "unset" all mean the default, and the ingest resolves the vault's own
      // root from the same rule the writer uses.
      settings.directory,
      {
        fetch: s3Fetch,
        accessKeyId: settings.accessKeyId,
        accessKeySecret: secret,
        attachments
      }
    );
  }
  if (settings.baseUrl.trim().length === 0) {
    return { status: "unconfigured", reason: "\u8FD8\u6CA1\u914D\u7F6E WebDAV \u5730\u5740", pulled: 0, failed: 0, skipped: 0, listed: 0 };
  }
  const password = await readPassword(ctx);
  const deps = {
    fetch: webdavFetch,
    attachments,
    userAgent: activeUserAgent(settings),
    ...settings.username.length === 0 || password === void 0 ? {} : { auth: { username: settings.username, password } }
  };
  return pullRemote(vault, settings, deps);
}

// src/host/remote/writer.ts
function syncRoot(settings) {
  return syncRootFor(settings.directory);
}
async function remoteWriter(ctx) {
  const settings = readSettings(ctx);
  try {
    if (settings.protocol === "s3") {
      if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
        return { status: "unconfigured", reason: "\u8FD8\u6CA1\u914D\u7F6E S3 \u7684 endpoint \u6216 bucket" };
      }
      const secret = await readS3Secret(ctx);
      if (secret === void 0) return { status: "unconfigured", reason: "\u8FD8\u6CA1\u5B58 AccessKey Secret" };
      const config = {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
        userAgent: activeUserAgent(settings)
      };
      const deps2 = {
        fetch: s3Fetch,
        accessKeyId: settings.accessKeyId,
        accessKeySecret: secret
      };
      return {
        status: "ok",
        root: syncRoot(settings),
        writer: {
          write: (path, bytes, contentType) => putObject(config, path, bytes, deps2, contentType),
          remove: (path) => deleteObject(config, path, deps2)
        }
      };
    }
    if (settings.baseUrl.trim().length === 0) {
      return { status: "unconfigured", reason: "\u8FD8\u6CA1\u914D\u7F6E\u8FDC\u7AEF\u5730\u5740" };
    }
    const password = await readPassword(ctx);
    const deps = {
      fetch: webdavFetch,
      ...settings.username.length === 0 || password === void 0 ? {} : { auth: { username: settings.username, password } },
      userAgent: activeUserAgent(settings)
    };
    const base = settings.baseUrl;
    return {
      status: "ok",
      root: syncRoot(settings),
      writer: {
        write: (path, bytes, contentType) => writeFile(base, path, bytes, deps, contentType),
        remove: (path) => deleteFile(base, path, deps)
      }
    };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

// src/host/remote/push.ts
function imageRef(record) {
  return {
    attachmentId: record.storeId,
    mediaType: record.mime,
    bytes: record.bytes,
    width: record.width ?? 0,
    height: record.height ?? 0,
    ...record.filename === void 0 ? {} : { name: record.filename }
  };
}
function fileRef(record) {
  return {
    attachmentId: record.storeId,
    name: record.filename ?? "file",
    bytes: record.bytes
  };
}
async function bytesOf(attachments, record) {
  try {
    if (record.mime.startsWith("image/")) {
      return (await attachments.readImage(imageRef(record))).data;
    }
    const chunks = [];
    for await (const chunk of attachments.readFileStream(fileRef(record))) chunks.push(chunk);
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const joined = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      joined.set(chunk, at);
      at += chunk.byteLength;
    }
    return joined;
  } catch {
    return void 0;
  }
}
function packItem(item) {
  return new TextEncoder().encode(
    JSON.stringify({ format: "dsh-inbox-item/1", record: item }, void 0, 0)
  );
}
function packMaster(master) {
  return new TextEncoder().encode(
    JSON.stringify({ format: "dsh-inbox-master/1", master }, void 0, 0)
  );
}
var EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/json": "json"
};
function extensionOf(filename, mime) {
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(filename ?? "")?.[1];
  if (fromName !== void 0) return fromName.toLowerCase();
  return EXTENSIONS[mime.toLowerCase()] ?? "bin";
}
function attachmentObjectName(attachmentId, record) {
  return `${attachmentId}.${extensionOf(record.filename, record.mime)}`;
}
function packAttachment(record) {
  return new TextEncoder().encode(
    JSON.stringify(
      {
        format: "dsh-inbox-attachment/1",
        attachment: {
          id: record.id,
          mime: record.mime,
          bytes: record.bytes,
          // Part of the row, and a domain that reads without it refuses to open
          // at all — the merge learned that the hard way.
          createdAt: record.createdAt,
          ...record.filename === void 0 ? {} : { filename: record.filename },
          ...record.width === void 0 ? {} : { width: record.width },
          ...record.height === void 0 ? {} : { height: record.height },
          ...record.sha256 === void 0 ? {} : { sha256: record.sha256 }
        }
      },
      void 0,
      0
    )
  );
}
function readableTime(iso) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const pad = (value) => String(value).padStart(2, "0");
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
function renderItemText(item, attachmentNames) {
  const heading = item.title ?? item.linkTitle ?? item.url ?? (item.category === "secret" ? "\u5BC6\u94A5 / \u8D26\u5BC6" : "\uFF08\u65E0\u6807\u9898\uFF09");
  const lines = [heading, "=".repeat(Math.min(40, Math.max(6, heading.length))), ""];
  lines.push(`\u7C7B\u76EE\uFF1A${CATEGORY_LABELS[item.category]}\u3000\u7C7B\u578B\uFF1A${KIND_LABELS[item.kind]}\u3000\u6765\u6E90\uFF1A${item.source}`);
  lines.push(`\u5B58\u5165\uFF1A${readableTime(item.createdAt)}${item.updatedAt === item.createdAt ? "" : `\u3000\u66F4\u65B0\uFF1A${readableTime(item.updatedAt)}`}`);
  if (item.platform !== void 0) lines.push(`\u5E73\u53F0\uFF1A${item.platform}`);
  if (item.tags.length > 0) lines.push(`\u6807\u7B7E\uFF1A${item.tags.map((tag) => `#${tag}`).join(" ")}`);
  if (item.watchLater === true) lines.push("\u5F85\u770B\uFF1A\u662F");
  if (item.deletedAt !== void 0) lines.push(`\u56DE\u6536\u7AD9\uFF1A\u662F\uFF08${readableTime(item.deletedAt)} \u5220\u9664\uFF09`);
  if (item.url !== void 0) lines.push(`\u94FE\u63A5\uFF1A${item.url}`);
  if (item.linkTitle !== void 0 && item.linkTitle !== heading) lines.push(`\u9875\u9762\u6807\u9898\uFF1A${item.linkTitle}`);
  if (attachmentNames.length > 0) {
    lines.push("\u9644\u4EF6\uFF1A");
    for (const name2 of attachmentNames) lines.push(`  - ${name2}`);
  }
  lines.push("");
  if (item.note !== void 0 && item.note.length > 0) {
    lines.push("\u5907\u6CE8", "----", item.note, "");
  }
  if (item.category === "secret") {
    lines.push("\u6B63\u6587", "----", "\uFF08\u52A0\u5BC6\u3002\u9700\u8981\u4E3B\u5BC6\u7801\u5728\u672C\u673A\u89E3\u9501\u540E\u624D\u80FD\u8BFB\u5230\u6B63\u6587\uFF1B\u5BC6\u94A5\u4E0E\u5BC6\u7801\u6C38\u4E0D\u968F\u540C\u6B65\u4E0A\u4F20\u3002\uFF09");
  } else if (item.text !== void 0 && item.text.length > 0) {
    lines.push("\u6B63\u6587", "----", item.text);
  }
  return `${lines.join("\n").trimEnd()}
`;
}
async function pushRemote(ctx, vault, attachments, options = {}) {
  if (attachments === void 0) return failed("\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u9644\u4EF6\u4ED3\u5E93\uFF0C\u9644\u4EF6\u6CA1\u6CD5\u4E0A\u4F20");
  const connection = await remoteWriter(ctx);
  if (connection.status === "unconfigured") return unconfigured(connection.reason);
  if (connection.status === "failed") return failed(connection.reason);
  return pushOnce(
    vault,
    attachments,
    connection.writer.write,
    connection.root,
    options,
    connection.writer.remove
  );
}
async function pushOnce(vault, attachments, writer, basePath, options = {}, remover) {
  const lastPushAt = options.all === true ? void 0 : vault.global.sync.lastPushAt;
  const items = vault.list({ includeDeleted: true });
  let pushed = 0;
  let attachmentCount = 0;
  let skipped = 0;
  const failures = [];
  const seenAttachments = /* @__PURE__ */ new Set();
  const master = vault.master;
  if (master !== void 0) {
    try {
      await writer(`${basePath}/master.json`, packMaster(master), "application/json");
    } catch (error) {
      failures.push(`\u4E3B\u5BC6\u7801\u53C2\u6570\uFF1A${reasonOf3(error)}`);
    }
  }
  for (const item of items) {
    if (lastPushAt !== void 0 && item.updatedAt <= lastPushAt) {
      skipped += 1;
      continue;
    }
    try {
      await writer(`${basePath}/items/${item.id}.json`, packItem(item), "application/json");
      pushed += 1;
    } catch (error) {
      failures.push(`\u8BB0\u5F55 ${item.id}\uFF1A${reasonOf3(error)}`);
      continue;
    }
    const attachmentNames = [];
    for (const attachmentId of item.attachmentIds) {
      if (seenAttachments.has(attachmentId)) continue;
      seenAttachments.add(attachmentId);
      const record = vault.getAttachment(attachmentId);
      if (record === void 0) continue;
      const objectName = attachmentObjectName(attachmentId, record);
      attachmentNames.push(`attachments/${objectName}\uFF08${record.mime}\uFF0C${String(record.bytes)} \u5B57\u8282${record.filename === void 0 ? "" : `\uFF0C\u539F\u540D ${record.filename}`}\uFF09`);
      const bytes = await bytesOf(attachments, record);
      if (bytes === void 0) {
        failures.push(`\u9644\u4EF6 ${attachmentId}\uFF1A\u672C\u673A\u62FF\u4E0D\u5230\u5B57\u8282`);
        continue;
      }
      try {
        await writer(`${basePath}/attachments/${objectName}`, bytes, record.mime);
        await writer(
          `${basePath}/attachments/${attachmentId}.meta.json`,
          packAttachment(record),
          "application/json"
        );
        try {
          await remover?.(`${basePath}/attachments/${attachmentId}`);
        } catch {
        }
        attachmentCount += 1;
      } catch (error) {
        failures.push(`\u9644\u4EF6 ${attachmentId}\uFF1A${reasonOf3(error)}`);
      }
    }
    try {
      await writer(
        `${basePath}/items/${item.id}.txt`,
        new TextEncoder().encode(renderItemText(item, attachmentNames)),
        "text/plain; charset=utf-8"
      );
    } catch (error) {
      failures.push(`\u8BB0\u5F55 ${item.id}\uFF08\u6587\u672C\u89C6\u56FE\uFF09\uFF1A${reasonOf3(error)}`);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (pushed > 0 || attachmentCount > 0) await vault.setSync({ ...vault.global.sync, lastPushAt: now });
  return {
    status: failures.length === 0 ? "ok" : pushed + attachmentCount === 0 ? "failed" : "partial",
    pushed,
    attachments: attachmentCount,
    skipped,
    listed: items.length,
    lastPushAt: now,
    ...failures.length === 0 ? {} : { reason: failures.slice(0, 3).join("\uFF1B") }
  };
}
function failed(reason) {
  return {
    status: "failed",
    reason,
    pushed: 0,
    attachments: 0,
    skipped: 0,
    listed: 0
  };
}
function unconfigured(reason) {
  return { ...failed(reason), status: "unconfigured" };
}
function reasonOf3(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/host/remote/auto-push.ts
var AUTO_PUSH_DELAY_MS = 5e3;
var timer;
function scheduleAutoPush(run) {
  if (timer !== void 0) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = void 0;
    void run().catch(() => void 0);
  }, AUTO_PUSH_DELAY_MS);
  timer.unref?.();
}
function makeAutoPush(ctx, vault, attachments) {
  return async () => {
    const open3 = vault();
    const store = attachments();
    if (open3 === void 0 || store === void 0) return;
    await pushRemote(ctx, open3, store);
  };
}

// src/host/command.ts
function describe(summary) {
  const parts = [];
  if (summary.stored > 0) parts.push(`\u5DF2\u5B58\u5165 ${summary.stored} \u6761`);
  const repeats = summary.merged - summary.restored;
  if (repeats > 0) parts.push(`\u5408\u5E76 ${repeats} \u6761\u91CD\u590D\u9879`);
  if (summary.restored > 0) parts.push(`\u4ECE\u56DE\u6536\u7AD9\u53D6\u56DE ${summary.restored} \u6761`);
  return parts.join("\uFF0C");
}
function toCaptured(block) {
  if (block.type === "image") {
    const { attachmentId: attachmentId2, mediaType, bytes: bytes2, width, height, name: name3 } = block.attachment;
    return {
      id: attachmentId2,
      mime: mediaType,
      bytes: bytes2,
      width,
      height,
      ...name3 === void 0 ? {} : { filename: name3 }
    };
  }
  const { attachmentId, name: name2, bytes } = block.attachment;
  return { id: attachmentId, mime: "application/octet-stream", bytes, filename: name2 };
}
function registerInboxCommand(ctx, vault) {
  let autoPush;
  ctx.inject(["attachments"], (scoped) => {
    autoPush = makeAutoPush(scoped, vault, () => scoped.attachments);
  });
  ctx.commands.register({
    name: "inbox",
    description: "\u6536\u8FDB\u4ED3\u5E93\uFF1A\u628A\u8FD9\u6BB5\u6587\u5B57\u3001\u94FE\u63A5\u6216\u9644\u4EF6\u5B58\u8FDB dsh-inbox\uFF0C\u4E0D\u53D1\u7ED9\u6A21\u578B",
    input: { hint: "<\u6587\u5B57 / \u94FE\u63A5\uFF1B\u56FE\u7247\u53EF\u76F4\u63A5\u62D6\u8FDB\u8F93\u5165\u6846>", attachments: true },
    recordInput: false,
    async handler(invocation) {
      const open3 = vault();
      if (open3 === void 0) {
        return { kind: "error", text: "dsh-inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5" };
      }
      const summary = await capture(
        open3,
        { text: invocation.rawInput, attachments: invocation.attachments.map(toCaptured) },
        "chat",
        { ctx }
      );
      if (summary.stored === 0 && summary.merged === 0) {
        return {
          kind: "error",
          text: "\u6CA1\u4E1C\u897F\u53EF\u5B58\uFF1A/inbox \u540E\u9762\u8DDF\u6587\u5B57\u6216\u94FE\u63A5\uFF0C\u6216\u8005\u628A\u56FE\u7247\u62D6\u8FDB\u8F93\u5165\u6846"
        };
      }
      if (autoPush !== void 0 && summary.stored > 0) scheduleAutoPush(autoPush);
      return { kind: "success", text: describe(summary) };
    }
  });
}

// src/host/rpc.ts
import { open as open2, readFile as readFile2 } from "node:fs/promises";
import {
  admitEncodedFile as admitEncodedFile3,
  admitEncodedImages as admitEncodedImages3,
  isAttachmentError
} from "@deepseek-ai/dsh-attachment";
import { z as z4 } from "zod";

// src/host/remote/remove.ts
async function removeRemoteRecords(ctx, removed) {
  if (removed.itemIds.length === 0 && removed.attachments.length === 0) {
    return { removed: 0, failures: [] };
  }
  const connection = await remoteWriter(ctx);
  if (connection.status !== "ok") {
    return { removed: 0, failures: [], skipped: true };
  }
  return removeWith(connection.writer, connection.root, removed);
}
async function removeWith(writer, root, removed) {
  const failures = [];
  let removedCount = 0;
  const drop = async (path) => {
    try {
      await writer.remove(path);
      removedCount += 1;
    } catch (error) {
      failures.push(`${path}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  };
  for (const id of removed.itemIds) {
    await drop(`${root}/items/${id}.json`);
    await drop(`${root}/items/${id}.txt`);
  }
  for (const record of removed.attachments) {
    await drop(`${root}/attachments/${record.id}.${extensionOf(record.filename, record.mime)}`);
    await drop(`${root}/attachments/${record.id}.meta.json`);
    await drop(`${root}/attachments/${record.id}`);
  }
  return { removed: removedCount, failures };
}

// src/host/s3/probe.ts
var EXCERPT = 400;
async function probe(config, deps, label, key, query, signOverride) {
  const signed = (signOverride ?? signer(config))(config, deps, "GET", key, query);
  try {
    const response = await deps.fetch(signed.url, { method: "GET", headers: signed.headers });
    let detail = "";
    try {
      detail = (await response.text()).trim().slice(0, EXCERPT).replace(/\s+/g, " ");
    } catch {
      detail = "(\u8BFB\u4E0D\u5230\u54CD\u5E94\u4F53)";
    }
    return { label, url: signed.url, status: response.status, detail };
  } catch (error) {
    return {
      label,
      url: signed.url,
      status: 0,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}
async function probeS3(config, deps, prefix) {
  return [
    // Version and region are what a v4 signature covers, and a gateway that
    // checks either will refuse a request whose scope disagrees with it. Trying
    // a few regions at once answers "which one does it want" in one click.
    await probe({ ...config, signatureVersion: "v4", region: "us-east-1" }, deps, "v4 \xB7 us-east-1 \xB7 \u65E0\u53C2\u6570", "", {}),
    await probe(
      { ...config, signatureVersion: "v4", region: "us-east-1" },
      deps,
      "v4 \u7CBE\u7B80\uFF08\u53EA\u7B7E host + date\uFF09",
      "",
      {},
      signRequestV4Minimal
    ),
    await probe(
      { ...config, signatureVersion: "v4", region: "us-east-1" },
      deps,
      "v4 \xB7 UNSIGNED-PAYLOAD\uFF08SDK \u7684\u5E38\u89C4\u5F62\u6001\uFF09",
      "",
      {},
      signRequestUnsignedPayload
    ),
    await probe({ ...config, signatureVersion: "v4", region: "cn-north-1" }, deps, "v4 \xB7 cn-north-1 \xB7 \u65E0\u53C2\u6570", "", {}),
    await probe({ ...config, signatureVersion: "v4", region: "cn-northwest-1" }, deps, "v4 \xB7 cn-northwest-1 \xB7 \u65E0\u53C2\u6570", "", {}),
    await probe({ ...config, signatureVersion: "v4", region: "us-east-1" }, deps, "v4 \xB7 us-east-1 \xB7 \u5E26 prefix", "", { prefix }),
    await probe({ ...config, signatureVersion: "v2" }, deps, "v2 \xB7 \u65E0\u53C2\u6570", "", {}),
    await probe({ ...config, signatureVersion: "v2" }, deps, "v2 \xB7 \u5E26 prefix", "", { prefix })
  ];
}

// src/host/webdav/probe.ts
var EXCERPT2 = 120;
async function probeWebdav(deps, baseUrl, directory) {
  const url = joinUrl(baseUrl.replace(/\/+$/, ""), directory.replace(/^\/+/, ""));
  const headers = {
    ...authHeaders(deps.auth),
    ...userAgentHeaders(deps),
    depth: "0"
  };
  try {
    const response = await deps.fetch(url, { method: "PROPFIND", headers });
    let detail = "";
    try {
      detail = (await response.text()).trim().slice(0, EXCERPT2).replace(/\s+/g, " ");
    } catch {
      detail = "(\u8BFB\u4E0D\u5230\u54CD\u5E94\u4F53)";
    }
    return [{ label: "PROPFIND \u76EE\u5F55\uFF08\u53EA\u8BFB\uFF09", url, status: response.status, detail }];
  } catch (error) {
    return [
      {
        label: "PROPFIND \u76EE\u5F55\uFF08\u53EA\u8BFB\uFF09",
        url,
        status: 0,
        detail: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

// src/host/ui/config.ts
import z3 from "@deepseek-ai/schemastery";
var UI_SETTINGS_NAMESPACE = "dsh-inbox-ui";
var DEFAULT_UI_PREFS = { listMode: "grid" };
var UI_FIELDS = {
  listMode: z3.union(["grid", "compact"]).default("grid")
};
var UiPrefsSchema = z3.object(UI_FIELDS);
var UI_SECTION = {
  namespace: UI_SETTINGS_NAMESPACE,
  fields: Object.keys(UI_FIELDS)
};
function installUiSettings(ctx) {
  const settings = legacySettings(ctx);
  if (settings === void 0) return;
  try {
    settings.register(UI_SETTINGS_NAMESPACE, UiPrefsSchema, { base: DEFAULT_UI_PREFS });
  } catch {
  }
}
function readUiPrefs(ctx) {
  const store = settingsStore(ctx);
  if (store === void 0) return { ...DEFAULT_UI_PREFS, settingsAvailable: false };
  const stored = store.read(UI_SECTION)?.listMode;
  const listMode = UI_LIST_MODES.includes(stored) ? stored : DEFAULT_UI_PREFS.listMode;
  return { listMode, settingsAvailable: true };
}
async function saveUiPrefs(ctx, patch) {
  if (patch.listMode === void 0) return { ok: true };
  if (!UI_LIST_MODES.includes(patch.listMode)) {
    return {
      ok: false,
      reason: `\u5217\u8868\u6A21\u5F0F\u53EA\u652F\u6301 ${UI_LIST_MODES.join(" / ")}\uFF0C\u6536\u5230\u7684\u662F ${patch.listMode}`
    };
  }
  const store = settingsStore(ctx);
  if (store === void 0) return { ok: false, reason: "\u8FD9\u4E2A\u7EC4\u5408\u91CC\u6CA1\u6709\u8BBE\u7F6E\u670D\u52A1\uFF0C\u8BB0\u4E0D\u4F4F\u5217\u8868\u6A21\u5F0F" };
  installUiSettings(ctx);
  const written = await store.write(UI_SECTION, { listMode: patch.listMode });
  if (!written.ok) return { ok: false, reason: written.reason };
  return { ok: true };
}

// src/host/vault/vault.ts
import { createHmac as createHmac2, randomUUID } from "node:crypto";

// src/host/vault/query.ts
function haystack(item) {
  return [item.title, item.linkTitle, item.text, item.url, item.note, ...item.tags].filter((part) => typeof part === "string" && part.length > 0).join("\n").toLowerCase();
}
function matches(item, query, needle) {
  if (item.deletedAt !== void 0 && query.includeDeleted !== true) return false;
  if (query.categories !== void 0 && !query.categories.includes(item.category)) return false;
  if (query.kinds !== void 0 && !query.kinds.includes(item.kind)) return false;
  if (query.watchLater !== void 0 && item.watchLater === true !== query.watchLater) return false;
  if (query.tags !== void 0) {
    for (const tag of query.tags) {
      if (!item.tags.includes(tag)) return false;
    }
  }
  if (needle.length > 0 && !haystack(item).includes(needle)) return false;
  return true;
}
function selectItems(items, query = {}) {
  const needle = query.text?.trim().toLowerCase() ?? "";
  const matched = items.filter((item) => matches(item, query, needle));
  matched.sort((left, right) => {
    if (left.createdAt === right.createdAt) return left.id < right.id ? 1 : -1;
    return left.createdAt < right.createdAt ? 1 : -1;
  });
  const offset = query.offset ?? 0;
  if (query.limit === void 0) return offset === 0 ? matched : matched.slice(offset);
  return matched.slice(offset, offset + query.limit);
}

// src/host/crypto/secret-box.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
var DEFAULT_KDF = { n: 32768, r: 8, p: 1 };
var KEY_BYTES = 32;
var IV_BYTES = 12;
var TAG_BYTES = 16;
var PREFIX = "v1";
var MAX_MEM = 96 * 1024 * 1024;
function newSalt() {
  return randomBytes(16);
}
function deriveKey(password, salt, kdf = DEFAULT_KDF) {
  return scryptSync(password.normalize("NFKC"), salt, KEY_BYTES, {
    N: kdf.n,
    r: kdf.r,
    p: kdf.p,
    maxmem: MAX_MEM
  });
}
function seal(key, plaintext) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64")
  ].join(":");
}
function open(key, envelope) {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) return void 0;
  try {
    const iv = Buffer.from(parts[1] ?? "", "base64");
    const tag = Buffer.from(parts[2] ?? "", "base64");
    const body = Buffer.from(parts[3] ?? "", "base64");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return void 0;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return void 0;
  }
}

// src/host/vault/vault.ts
var VERIFIER_PLAINTEXT = "dsh-inbox master password check";
var VaultLockedError = class extends Error {
  constructor() {
    super("\u4ED3\u5E93\u9501\u7740\uFF08\u6216\u8FD8\u6CA1\u8BBE\u4E3B\u5BC6\u7801\uFF09\uFF1A\u8D26\u5BC6\u7C7B\u5185\u5BB9\u8981\u5148\u5728\u300C\u8BBE\u7F6E \u2192 \u8D26\u5BC6\u52A0\u5BC6\u300D\u91CC\u89E3\u9501\u624D\u80FD\u5B58");
    this.name = "VaultLockedError";
  }
};
var RETIRED_TAG = "\u5F85\u770B";
var Vault = class _Vault {
  constructor(ctx, domain, unit) {
    this.ctx = ctx;
    this.domain = domain;
    this.unit = unit;
  }
  closed = false;
  /**
   * The derived key, **memory only**.
   *
   * Nothing on disk can be used to read a credential: the master password is
   * never stored, the key is never stored, and a restart therefore locks the
   * vault again. That is the trade the red line asks for ("主密码永不上传"),
   * and it is why the panel has an explicit unlock.
   */
  key;
  /**
   * Open the vault's domain over whatever backend the composition routed it to.
   *
   * @param ctx - host context carrying the storage domain facility.
   * @param unit - unit location, recorded for diagnostics only.
   * @returns the open vault.
   */
  static async open(ctx, unit = "") {
    const domain = await ctx.storageDomain.open(vaultSpec);
    const vault = new _Vault(ctx, domain, unit);
    await vault.migrateOnce();
    return vault;
  }
  /**
   * Bring records written by version 1/2 into the version-3 shape: strip the
   * `待看` tag, because the flag now says the same thing.
   *
   * The old read/unread pair is **not** converted, on purpose. 待看 is the
   * user's own mark, and back-filling it would have flagged twelve records on
   * their behalf at first launch.
   *
   * (A note for whoever reads this next: you cannot even see the old `status`
   * from here. The domain validates on read and zod drops unknown keys, so by
   * the time a record reaches this loop the field is gone — measured, after the
   * first version of this migration silently converted nothing and the rail
   * read 「待看 0」.)
   */
  async migrateOnce() {
    for (const [key, stored] of this.items.entries()) {
      if (!stored.tags.includes(RETIRED_TAG)) continue;
      await this.items.put(key, {
        ...stored,
        tags: stored.tags.filter((tag) => tag !== RETIRED_TAG)
      });
    }
  }
  get items() {
    return this.domain.table("items");
  }
  get attachments() {
    return this.domain.table("attachments");
  }
  get graves() {
    return this.domain.table("graves");
  }
  /** Where the key state stands; what the panel shows and the tools consult. */
  get lockState() {
    return {
      configured: this.global.master !== void 0,
      unlocked: this.key !== void 0,
      sealedRecords: this.sealedRecords
    };
  }
  /** Credential bodies that need the key, tombstones included. */
  get sealedRecords() {
    let count = 0;
    for (const [, item] of this.items.entries()) {
      if (item.secret !== void 0) count += 1;
    }
    return count;
  }
  /**
   * The parameters that recognise the master password, when one has been set.
   *
   * Read by the push, which publishes them so another machine can open what it
   * pulled (`../remote/push.ts`).
   */
  get master() {
    return this.global.master;
  }
  /**
   * Set (or replace) the master password, and seal everything that needs it.
   *
   * Replacing it is allowed on purpose: a user who wrote the password down
   * badly, or wants a stronger one, must be able to fix that. Records sealed
   * with the *old* password are re-sealed with the new key, which is why the
   * old password has to be supplied again in the panel.
   *
   * @param password - the new master password, never stored anywhere.
   * @returns how many records were sealed in the process.
   */
  async setMasterPassword(password) {
    const sealedAlready = [...this.items.entries()].filter(([, item]) => item.secret !== void 0);
    if (sealedAlready.length > 0 && this.key === void 0) {
      throw new Error(
        `\u4ED3\u5E93\u91CC\u5DF2\u6709 ${String(sealedAlready.length)} \u6761\u5BC6\u6587\uFF0C\u4F46\u672C\u673A\u6CA1\u6709\u89E3\u5F00\u5B83\u4EEC\u7684\u4E3B\u5BC6\u7801\u53C2\u6570\uFF1A\u5148\u8F93\u5165\u300C\u539F\u6765\u90A3\u53F0\u673A\u5668\u300D\u7684\u4E3B\u5BC6\u7801\u89E3\u9501\uFF08\u8FD9\u4E9B\u5BC6\u6587\u662F\u540C\u6B65\u8FC7\u6765\u7684\u8BDD\uFF0C\u5148\u5728\u8BBE\u7F6E\u91CC\u62C9\u53D6\u4E00\u6B21\uFF0C\u628A\u4E3B\u5BC6\u7801\u53C2\u6570\u53D6\u56DE\u6765\uFF09\uFF0C\u518D\u6765\u6362\u5BC6\u7801`
      );
    }
    const previous = this.key;
    const salt = newSalt();
    const kdf = DEFAULT_KDF;
    const key = deriveKey(password, salt, kdf);
    await this.setGlobal({
      ...this.global,
      master: {
        version: 1,
        salt: salt.toString("base64"),
        kdf,
        verifier: seal(key, VERIFIER_PLAINTEXT)
      }
    });
    this.key = key;
    return await this.resealSecrets(previous) + await this.sealLegacySecrets();
  }
  /**
   * Take over another machine's key parameters.
   *
   * The half of sync that turns "the bytes arrived" into "the password you
   * already know opens them" (see `../remote/merge.ts`). Nothing here can read
   * the records: the parameters say *how* to derive the key, the password is
   * still what derives it, so the vault stays locked until someone types it.
   *
   * Refused when this machine already has parameters of its own — those seal
   * local records, and silently swapping them would make the local records
   * unreadable in exchange for the remote ones.
   *
   * @param master - the parameters the remote published, already parsed.
   * @returns whether they were taken.
   */
  async adoptMaster(master) {
    if (this.global.master !== void 0) return false;
    await this.setGlobal({ ...this.global, master: masterSchema.parse(master) });
    return true;
  }
  /**
   * Derive the key from the stored salt and check it against the verifier.
   *
   * @param password - what the user typed.
   * @returns true when the vault is now unlocked.
   */
  async unlock(password) {
    const master = this.global.master;
    if (master === void 0) return false;
    const key = deriveKey(password, Buffer.from(master.salt, "base64"), master.kdf);
    if (open(key, master.verifier) !== VERIFIER_PLAINTEXT) return false;
    this.key = key;
    await this.sealLegacySecrets();
    return true;
  }
  /** Drop the key. Credentials stay on disk, unreadable until the next unlock. */
  lock() {
    this.key = void 0;
  }
  /**
   * Seal one credential body for storage.
   *
   * @param plaintext - the credential as the user pasted it.
   * @returns the envelope to store, and the keyed digest used for de-duplication.
   */
  sealSecret(plaintext) {
    const key = this.key;
    if (key === void 0) throw new VaultLockedError();
    return { secret: seal(key, plaintext), secretDigest: this.digestOf(plaintext) };
  }
  /**
   * The plaintext behind a credential, when it can be read.
   *
   * @param item - the record.
   * @returns the plaintext, or undefined while locked.
   */
  secretText(item) {
    if (item.secret === void 0) return void 0;
    return this.key === void 0 ? void 0 : open(this.key, item.secret);
  }
  /**
   * The keyed digest a re-paste is matched against (see `spec.ts`).
   *
   * @param plaintext - the credential as pasted.
   * @returns a hex digest, stable for one vault and useless without its key.
   */
  digestOf(plaintext) {
    const key = this.key;
    if (key === void 0) throw new VaultLockedError();
    return createHmac2("sha256", key).update(plaintext).digest("hex");
  }
  /**
   * Move credentials that are still sitting in `text` into the sealed field.
   *
   * Version-5 vaults kept a credential's body in plain text — that is what this
   * whole change is about — so the first unlock rewrites them. A record that is
   * not a `secret` is left alone, even if it looks like one: the category is the
   * user's own statement about what a record is.
   *
   * @returns how many records were sealed.
   */
  async sealLegacySecrets() {
    let sealed = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.category !== "secret" || item.text === void 0) continue;
      const { secret, secretDigest } = this.sealSecret(item.text);
      const { text: _dropped, ...rest } = item;
      await this.items.put(id, { ...rest, secret, secretDigest });
      sealed += 1;
    }
    return sealed;
  }
  /**
   * Re-seal everything that was sealed with the previous key.
   *
   * @param previous - the key in use until a moment ago, if there was one.
   * @returns how many records were re-sealed.
   */
  async resealSecrets(previous) {
    if (previous === void 0) return 0;
    let resealed = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.secret === void 0) continue;
      const plaintext = open(previous, item.secret);
      if (plaintext === void 0) continue;
      const { secret, secretDigest } = this.sealSecret(plaintext);
      await this.items.put(id, { ...item, secret, secretDigest });
      resealed += 1;
    }
    return resealed;
  }
  /** Total records held, including soft-deleted ones. */
  get size() {
    return this.items.size;
  }
  /**
   * File a new item.
   *
   * @param input - the caller-owned fields; id and timestamps are assigned here.
   * @returns the stored record.
   */
  async create(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const item = {
      id: randomUUID(),
      kind: input.kind,
      category: input.category,
      categorySource: input.categorySource ?? "rule",
      source: input.source,
      createdAt: now,
      updatedAt: now,
      tags: [...input.tags ?? []],
      attachmentIds: [...input.attachmentIds ?? []],
      ...input.title === void 0 ? {} : { title: input.title },
      ...input.linkTitle === void 0 ? {} : { linkTitle: input.linkTitle },
      ...input.linkTitleError === void 0 ? {} : { linkTitleError: input.linkTitleError },
      ...input.text === void 0 ? {} : { text: input.text },
      ...input.secret === void 0 ? {} : { secret: input.secret },
      ...input.secretDigest === void 0 ? {} : { secretDigest: input.secretDigest },
      ...input.url === void 0 ? {} : { url: input.url },
      ...input.platform === void 0 ? {} : { platform: input.platform },
      ...input.note === void 0 ? {} : { note: input.note }
    };
    await this.items.put(item.id, item);
    return item;
  }
  /** Read one live or soft-deleted record. */
  get(id) {
    return this.items.get(id);
  }
  /** Records sitting in the recycle bin, newest first. */
  getBin() {
    return this.list({ includeDeleted: true }).filter((item) => item.deletedAt !== void 0);
  }
  /**
   * List records matching a query, newest first.
   *
   * @param query - filters and paging.
   * @returns matching records.
   */
  list(query = {}) {
    return selectItems([...this.items.entries()].map(([, item]) => item), query);
  }
  /**
   * Replace editable fields. The atomic read-modify-write keeps concurrent
   * edits from interleaving on the domain's write chain.
   *
   * @param id - record key.
   * @param patch - fields to replace.
   * @returns the stored record.
   */
  async patch(id, patch) {
    return this.items.update(id, (current) => {
      const next = { ...current, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      if (patch.category !== void 0) next.category = patch.category;
      if (patch.categorySource !== void 0) next.categorySource = patch.categorySource;
      if (patch.watchLater !== void 0) {
        if (patch.watchLater) next.watchLater = true;
        else delete next.watchLater;
      }
      if (patch.title !== void 0) {
        if (patch.title.trim().length === 0) delete next.title;
        else next.title = patch.title;
      }
      if (patch.linkTitle !== void 0) next.linkTitle = patch.linkTitle;
      if (patch.linkTitleError !== void 0) {
        if (patch.linkTitleError.length === 0) delete next.linkTitleError;
        else next.linkTitleError = patch.linkTitleError;
      }
      if (patch.note !== void 0) next.note = patch.note;
      if (patch.platform !== void 0) next.platform = patch.platform;
      if (patch.tags !== void 0) next.tags = [...patch.tags];
      if (patch.attachmentIds !== void 0) next.attachmentIds = [...patch.attachmentIds];
      return next;
    });
  }
  /** Flag or unflag a record for later. */
  async setWatchLater(id, on = true) {
    return this.patch(id, { watchLater: on });
  }
  /**
   * Strip one tag from every record that carries it.
   *
   * A tag is not an entity here — it is a word on a record — so "delete this
   * tag" can only mean "take this word off everything". Returns how many
   * records changed, so the panel can say so instead of guessing.
   *
   * @param tag - the exact tag to remove.
   * @returns the number of records that carried it.
   */
  async removeTag(tag) {
    const touched = [...this.items.entries()].filter(([, item]) => item.tags.includes(tag));
    for (const [key, item] of touched) {
      await this.items.put(key, { ...item, tags: item.tags.filter((value) => value !== tag) });
    }
    return touched.length;
  }
  /**
   * Soft delete: the record stops appearing in lists but keeps its bytes, so the
   * recycle bin (and restoring) needs no second table.
   */
  async softDelete(id) {
    return this.items.update(id, (current) => ({
      ...current,
      deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  /** Undo a soft delete. */
  async restore(id) {
    return this.items.update(id, (current) => {
      const { deletedAt: _dropped, ...rest } = current;
      return { ...rest, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    });
  }
  /**
   * Delete one record for good, together with its attachment rows, and leave a
   * grave behind so nothing that is still in the cloud can file it again.
   *
   * The bytes behind an attachment live in dsh's own store, which never deletes
   * automatically — emptying the recycle bin drops our references, not their
   * objects. A row another record still references is left alone.
   *
   * The grave is the other half of that sentence, and it is why this is not
   * called `remove` any more: deleting the row really does take this machine's
   * copy away, but a copy under a *different* `sync/` tree in the same bucket
   * survives the purge of our own tree (`../remote/remove.ts` only ever deletes
   * under this vault's root), and the merge has no local row to outrank it with.
   * Measured 2026-09-21: thirteen emptied tombstones came back into the bin on
   * every `dsh` restart. The grave is what makes "gone" stick; it holds the id
   * and the moment, no content.
   *
   * @param id - record key.
   * @returns whether the record existed.
   */
  async purge(id) {
    const item = this.items.get(id);
    if (item === void 0) return false;
    const stillReferenced = /* @__PURE__ */ new Set();
    for (const [, other] of this.items.entries()) {
      if (other.id === id) continue;
      for (const attachmentId of other.attachmentIds) stillReferenced.add(attachmentId);
    }
    for (const attachmentId of item.attachmentIds) {
      if (!stillReferenced.has(attachmentId)) await this.attachments.delete(attachmentId);
    }
    await this.items.delete(id);
    await this.graves.put(id, { id, purgedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return true;
  }
  /**
   * When this id was emptied out of the bin, if it ever was.
   *
   * The merge asks this before taking a copy of a record this vault does not
   * have (see `newerThanPurge` in `../remote/merge.ts`).
   */
  purgedAt(id) {
    return this.graves.get(id)?.purgedAt;
  }
  /**
   * Record an attachment's metadata. The bytes stay in the store named by
   * `storeId`; this row is our own index over them, keyed by a generated id
   * because store ids are not path-safe.
   */
  async addAttachment(input) {
    const record = {
      ...input,
      id: randomUUID(),
      createdAt: input.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.attachments.put(record.id, record);
    return record;
  }
  /** Read one attachment record. */
  getAttachment(id) {
    return this.attachments.get(id);
  }
  /** Find our index row for a store-side attachment id, if we have one. */
  findAttachmentByStoreId(storeId) {
    for (const [, record] of this.attachments.entries()) {
      if (record.storeId === storeId) return record;
    }
    return void 0;
  }
  /** Current sync state; M6 writes it. */
  get global() {
    return this.domain.global.get();
  }
  /** Replace the global slot. */
  async setGlobal(value) {
    await this.domain.global.set(vaultGlobalSchema.parse(value));
  }
  /** Record today's model-fallback spend. */
  async setModelSpend(spend, last) {
    await this.setGlobal({ ...this.global, model: { ...spend, ...last === void 0 ? {} : { last } } });
  }
  /** Record where the last WebDAV pull got to. */
  async setSync(sync) {
    await this.setGlobal({ ...this.global, sync });
  }
  /**
   * Write a record exactly as another device had it.
   *
   * The merge's only write, and deliberately not `create`: an imported record
   * keeps the id other devices already know, the `createdAt` it was made with and
   * the `updatedAt` the conflict was settled on. Re-stamping any of them would
   * make the next pull decide the other way and bounce the record back and forth.
   *
   * @param item - the record, already validated by the merge's own parse.
   * @returns the stored record.
   */
  async import(item) {
    const parsed = itemSchema.parse(item);
    await this.items.put(parsed.id, parsed);
    return parsed;
  }
  /**
   * The same for one attachment's row.
   *
   * `storeId` is the *local* store's id for the bytes the merge just admitted;
   * everything else — our row id in particular — travels with the object so the
   * record's `attachmentIds` still point at something.
   *
   * @param record - the row, with a local `storeId`.
   * @returns the stored row.
   */
  async importAttachment(record) {
    const parsed = attachmentSchema.parse(
      Object.assign({ createdAt: (/* @__PURE__ */ new Date()).toISOString() }, record)
    );
    await this.attachments.put(parsed.id, parsed);
    return parsed;
  }
  /** Release the domain handle. Idempotent. */
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.domain.close();
  }
};

// src/host/rpc.ts
var MAX_TEXT_CHARS = 2e5;
var imageSchema = z4.object({
  mediaType: z4.enum(INBOX_IMAGE_TYPES),
  data: z4.string().min(1),
  name: z4.string().optional()
});
var fileSchema = z4.object({
  data: z4.string(),
  name: z4.string().optional(),
  // The browser's declaration, kept only for playable media (see
  // `fileAttachment`); a schema that promised more would be a promise the host
  // does not keep.
  mediaType: z4.string().optional()
});
var captureRequestSchema = z4.object({
  text: z4.string().max(MAX_TEXT_CHARS).optional(),
  images: z4.array(imageSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional(),
  files: z4.array(fileSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional()
});
var tagSchema = z4.string().min(1).max(MAX_TAG_CHARS);
var listRequestSchema = z4.object({
  scope: z4.enum(["live", "bin"]).optional(),
  categories: z4.array(z4.enum(CATEGORIES)).max(CATEGORIES.length).optional(),
  watchLater: z4.boolean().optional(),
  kinds: z4.array(z4.enum(KINDS)).max(KINDS.length).optional(),
  tags: z4.array(tagSchema).max(MAX_TAGS).optional(),
  text: z4.string().max(MAX_FILTER_CHARS).optional(),
  limit: z4.number().int().positive().max(LIST_LIMIT).optional(),
  offset: z4.number().int().nonnegative().optional()
});
var idRequestSchema = z4.object({ id: z4.string().min(1) });
var updateRequestSchema = idRequestSchema.extend({
  category: z4.enum(CATEGORIES).optional(),
  watchLater: z4.boolean().optional(),
  note: z4.string().max(MAX_NOTE_CHARS).optional(),
  title: z4.string().max(MAX_TITLE_CHARS).optional(),
  tags: z4.array(tagSchema).max(MAX_TAGS).optional()
});
function failure(code, message, details = {}) {
  return { ok: false, error: { code, message, details } };
}
function reasonOf4(error) {
  return error instanceof Error ? error.message : String(error);
}
function digestOf(attachmentId) {
  const match = /^sha256:([a-f0-9]{64})$/.exec(attachmentId);
  return match?.[1];
}
function imageAttachment(ref) {
  const sha256 = digestOf(ref.attachmentId);
  return {
    id: ref.attachmentId,
    mime: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...sha256 === void 0 ? {} : { sha256 },
    ...ref.name === void 0 ? {} : { filename: ref.name }
  };
}
function fileAttachment(ref, declared) {
  const sha256 = digestOf(ref.attachmentId);
  const playable = declared !== void 0 && (declared.startsWith("video/") || declared.startsWith("audio/"));
  return {
    id: ref.attachmentId,
    mime: playable ? declared : "application/octet-stream",
    bytes: ref.bytes,
    filename: ref.name,
    ...sha256 === void 0 ? {} : { sha256 }
  };
}
function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}
function renderableMime(mime) {
  return INBOX_IMAGE_TYPES.includes(mime) || mime.startsWith("video/") || mime.startsWith("audio/");
}
function toSummary(item, attachmentOf2) {
  const preview = item.text === void 0 ? void 0 : collapse(item.text).slice(0, PREVIEW_CHARS);
  const previewRecord = item.attachmentIds.map((id) => attachmentOf2?.(id)).find((record) => record !== void 0 && renderableMime(record.mime));
  const namedRecord = previewRecord?.filename === void 0 ? item.attachmentIds.map((id) => attachmentOf2?.(id)).find((record) => record !== void 0 && record.filename !== void 0) : previewRecord;
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    ...item.categorySource === void 0 ? {} : { categorySource: item.categorySource },
    watchLater: item.watchLater === true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: [...item.tags],
    attachmentCount: item.attachmentIds.length,
    ...previewRecord === void 0 ? {} : { previewId: previewRecord.id, previewMime: previewRecord.mime },
    ...namedRecord?.filename === void 0 ? {} : { attachmentName: namedRecord.filename },
    ...item.title === void 0 ? {} : { title: item.title },
    ...item.linkTitle === void 0 ? {} : { linkTitle: item.linkTitle },
    ...item.linkTitleError === void 0 ? {} : { linkTitleError: item.linkTitleError },
    // Belt and braces on top of the sealed field: a credential's row never
    // carries an excerpt of its body, whatever shape the record is in.
    ...item.category === "secret" || preview === void 0 || preview.length === 0 ? {} : { preview },
    ...item.url === void 0 ? {} : { url: item.url },
    ...item.platform === void 0 ? {} : { platform: item.platform },
    ...item.note === void 0 ? {} : { note: item.note },
    ...item.deletedAt === void 0 ? {} : { deletedAt: item.deletedAt }
  };
}
function toAttachmentSummary(record) {
  return {
    id: record.id,
    mime: record.mime,
    bytes: record.bytes,
    image: record.mime.startsWith("image/"),
    ...record.filename === void 0 ? {} : { filename: record.filename },
    ...record.width === void 0 ? {} : { width: record.width },
    ...record.height === void 0 ? {} : { height: record.height }
  };
}
function toDetail(vault, item) {
  const attachments = [];
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId);
    if (record !== void 0) attachments.push(toAttachmentSummary(record));
  }
  return {
    ...toSummary(item, (id) => vault.getAttachment(id)),
    /*
      A credential's body leaves the host only when it can be opened at all:
      while the vault is locked this record arrives with no `text`, and the pane
      says so instead of showing an empty box. Nothing in the *list* ever carries
      it — `toSummary` refuses the excerpt too.
    */
    ...item.category === "secret" ? (() => {
      const plaintext = vault.secretText(item);
      return plaintext === void 0 ? {} : { text: plaintext };
    })() : item.text === void 0 ? {} : { text: item.text },
    attachments
  };
}
function byCountThenName(left, right) {
  if (left.count !== right.count) return right.count - left.count;
  return left.value.localeCompare(right.value);
}
function facetsOf(live) {
  const categories = /* @__PURE__ */ new Map();
  const tags = /* @__PURE__ */ new Map();
  for (const item of live) {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
    for (const tag of item.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  return {
    categories: [...categories].map(([value, count]) => ({ value, count })).sort(byCountThenName),
    tags: [...tags].map(([value, count]) => ({ value, count })).sort(byCountThenName)
  };
}
async function handleCapture(vault, attachments, payload, ctx) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = captureRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return failure("inbox/bad-request", "\u63D0\u4EA4\u7684\u5185\u5BB9\u4E0D\u7B26\u5408\u9884\u671F\u5F62\u72B6", {
      issues: parsed.error.issues.map((issue) => issue.message)
    });
  }
  const { text, images = [], files = [] } = parsed.data;
  let stored;
  try {
    stored = (await admitEncodedImages3(attachments, images)).map(imageAttachment);
    for (const file of files) {
      stored.push(fileAttachment(await admitEncodedFile3(attachments, file), file.mediaType));
    }
  } catch (error) {
    if (isAttachmentError(error)) {
      return failure("inbox/attachment-refused", error.message, { code: error.code });
    }
    return failure("inbox/attachment-failed", reasonOf4(error));
  }
  try {
    const summary = await capture(vault, { text, attachments: stored }, "panel", {
      ctx
    });
    return { ok: true, value: summary };
  } catch (error) {
    if (error instanceof VaultLockedError) return failure("inbox/locked", error.message);
    return failure("inbox/capture-failed", reasonOf4(error));
  }
}
function handleList(vault, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = listRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return failure("inbox/bad-request", "\u7B5B\u9009\u6761\u4EF6\u4E0D\u7B26\u5408\u9884\u671F\u5F62\u72B6", {
      issues: parsed.error.issues.map((issue) => issue.message)
    });
  }
  const { scope = "live", limit = LIST_LIMIT, offset = 0, ...filters } = parsed.data;
  const all = vault.list({ includeDeleted: true });
  const live = all.filter((item) => item.deletedAt === void 0);
  const bin = all.filter((item) => item.deletedAt !== void 0);
  const matched = vault.list({
    includeDeleted: true,
    ...filters
  }).filter((item) => scope === "bin" ? item.deletedAt !== void 0 : item.deletedAt === void 0);
  const value = {
    entries: matched.slice(offset, offset + limit).map((item) => toSummary(item, (id) => vault.getAttachment(id))),
    matched: matched.length,
    total: live.length,
    watchLater: live.filter((item) => item.watchLater === true).length,
    deleted: bin.length,
    ...facetsOf(live)
  };
  return { ok: true, value };
}
function handleDetail(vault, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = idRequestSchema.safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-request", "\u7F3A\u5C11\u8BB0\u5F55 id");
  const item = vault.get(parsed.data.id);
  if (item === void 0) return failure("inbox/not-found", "\u8FD9\u6761\u8BB0\u5F55\u4E0D\u5728\u4E86");
  const value = { entry: toDetail(vault, item) };
  return { ok: true, value };
}
async function handleUpdate(vault, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = updateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return failure("inbox/bad-request", "\u8981\u6539\u7684\u5185\u5BB9\u4E0D\u7B26\u5408\u9884\u671F\u5F62\u72B6", {
      issues: parsed.error.issues.map((issue) => issue.message)
    });
  }
  const { id, ...patch } = parsed.data;
  const item = vault.get(id);
  if (item === void 0) return failure("inbox/not-found", "\u8FD9\u6761\u8BB0\u5F55\u4E0D\u5728\u4E86");
  try {
    const updated = await vault.patch(id, {
      ...patch,
      ...patch.category === void 0 ? {} : { categorySource: "user" }
    });
    const value = { entry: toSummary(updated) };
    return { ok: true, value };
  } catch (error) {
    return failure("inbox/update-failed", reasonOf4(error));
  }
}
async function handleDelete(vault, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = idRequestSchema.safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-request", "\u7F3A\u5C11\u8BB0\u5F55 id");
  if (vault.get(parsed.data.id) === void 0) {
    return failure("inbox/not-found", "\u8FD9\u6761\u8BB0\u5F55\u4E0D\u5728\u4E86");
  }
  try {
    const value = { entry: toSummary(await vault.softDelete(parsed.data.id)) };
    return { ok: true, value };
  } catch (error) {
    return failure("inbox/delete-failed", reasonOf4(error));
  }
}
async function handleRestore(vault, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const parsed = idRequestSchema.safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-request", "\u7F3A\u5C11\u8BB0\u5F55 id");
  if (vault.get(parsed.data.id) === void 0) {
    return failure("inbox/not-found", "\u8FD9\u6761\u8BB0\u5F55\u4E0D\u5728\u4E86");
  }
  try {
    const value = { entry: toSummary(await vault.restore(parsed.data.id)) };
    return { ok: true, value };
  } catch (error) {
    return failure("inbox/restore-failed", reasonOf4(error));
  }
}
async function handlePurge(ctx, vault) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const bin = vault.getBin();
  const doomedAttachments = /* @__PURE__ */ new Map();
  for (const item of bin) {
    for (const attachmentId of item.attachmentIds) {
      const record = vault.getAttachment(attachmentId);
      if (record !== void 0) doomedAttachments.set(attachmentId, record);
    }
  }
  let removed = 0;
  for (const item of bin) {
    if (await vault.purge(item.id)) removed += 1;
  }
  const stillReferenced = new Set(
    vault.list({ includeDeleted: true }).flatMap((item) => [...item.attachmentIds])
  );
  const orphans = [...doomedAttachments.values()].filter((record) => !stillReferenced.has(record.id));
  const remote = await removeRemoteRecords(ctx, {
    itemIds: bin.map((item) => item.id),
    attachments: orphans
  });
  const value = {
    removed,
    remoteRemoved: remote.removed,
    ...remote.skipped === true ? { remoteSkipped: true } : {},
    ...remote.failures.length === 0 ? {} : { reason: remote.failures.slice(0, 3).join("\uFF1B") }
  };
  return { ok: true, value };
}
async function handleWebdav(ctx, vault, payload) {
  const request = payload ?? {};
  const action = request.action === "save" ? "save" : "read";
  if (action === "save") {
    const patch = {};
    if (typeof request.protocol === "string") patch.protocol = request.protocol;
    if (typeof request.baseUrl === "string") patch.baseUrl = request.baseUrl;
    if (typeof request.directory === "string") patch.directory = request.directory;
    if (typeof request.adoptForeignRoots === "boolean") {
      patch.adoptForeignRoots = request.adoptForeignRoots;
    }
    if (typeof request.username === "string") patch.username = request.username;
    if (typeof request.password === "string") patch.password = request.password;
    if (typeof request.endpoint === "string") patch.endpoint = request.endpoint;
    if (typeof request.bucket === "string") patch.bucket = request.bucket;
    if (typeof request.region === "string") patch.region = request.region;
    if (typeof request.signatureVersion === "string") {
      patch.signatureVersion = request.signatureVersion;
    }
    if (typeof request.accessKeyId === "string") patch.accessKeyId = request.accessKeyId;
    if (typeof request.accessKeySecret === "string") {
      patch.accessKeySecret = request.accessKeySecret;
    }
    if (typeof request.userAgent === "string") patch.userAgent = request.userAgent;
    const saved = await saveWebdav(ctx, vault, readSettings(ctx), patch);
    if (!saved.ok) return failure("inbox/webdav-unsaved", saved.reason ?? "\u5B58\u4E0D\u8FDB\u53BB");
  }
  const status = await describeWebdav(ctx);
  return { ok: true, value: status };
}
async function handlePull(ctx, vault, attachments) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const settings = readSettings(ctx);
  const result = await runPull(ctx, vault, attachments);
  return { ok: true, value: result };
}
async function handlePush(ctx, vault, attachments, payload) {
  if (vault === void 0) {
    return failure("inbox/vault-closed", "inbox \u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  }
  const all = payload?.all === true;
  const result = await pushRemote(ctx, vault, attachments, { all });
  return { ok: true, value: result };
}
async function handleProbe(ctx) {
  const settings = readSettings(ctx);
  if (settings.protocol === "s3") {
    if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
      return failure("inbox/unconfigured", "\u8FD8\u6CA1\u914D\u7F6E S3 \u7684 endpoint \u6216 bucket\uFF0C\u5148\u586B\u4E0A\u518D\u81EA\u68C0");
    }
    const secret = await readS3Secret(ctx);
    if (secret === void 0) return failure("inbox/no-secret", "\u8FD8\u6CA1\u5B58 AccessKey Secret");
    const rows2 = await probeS3(
      {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
        userAgent: activeUserAgent(settings)
      },
      { fetch: s3Fetch, accessKeyId: settings.accessKeyId, accessKeySecret: secret },
      settings.directory.replace(/^\//, "")
    );
    return { ok: true, value: rows2 };
  }
  if (settings.baseUrl.trim().length === 0) {
    return failure("inbox/unconfigured", "\u8FD8\u6CA1\u914D\u7F6E\u8FDC\u7AEF\u5730\u5740\uFF0C\u5148\u586B\u4E0A\u518D\u81EA\u68C0");
  }
  const password = await readPassword(ctx);
  const rows = await probeWebdav(
    {
      fetch: webdavFetch,
      ...settings.username.length === 0 || password === void 0 ? {} : { auth: { username: settings.username, password } },
      userAgent: activeUserAgent(settings)
    },
    settings.baseUrl,
    settings.directory
  );
  return { ok: true, value: rows };
}
async function handleSecret(vault, payload) {
  if (vault === void 0) return failure("inbox/vault-closed", "\u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  const parsed = z4.object({
    action: z4.enum(["status", "set", "unlock", "lock"]),
    password: z4.string().min(1).max(1e3).optional()
  }).safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-secret-request", "\u8FD9\u4E2A\u8BF7\u6C42\u4E0D\u7B26\u5408\u9884\u671F\u5F62\u72B6");
  const request = parsed.data;
  try {
    switch (request.action) {
      case "status":
        return { ok: true, value: { ...vault.lockState } };
      case "set": {
        if (request.password === void 0) {
          return failure("inbox/no-password", "\u8981\u8BBE\u4E3B\u5BC6\u7801\uFF0C\u603B\u5F97\u7ED9\u4E00\u4E2A");
        }
        const sealed = await vault.setMasterPassword(request.password);
        return {
          ok: true,
          value: { ...vault.lockState, sealed }
        };
      }
      case "unlock": {
        if (request.password === void 0) {
          return failure("inbox/no-password", "\u8981\u89E3\u9501\uFF0C\u603B\u5F97\u7ED9\u5BC6\u7801");
        }
        if (!await vault.unlock(request.password)) {
          return failure("inbox/wrong-password", "\u5BC6\u7801\u4E0D\u5BF9\u2014\u2014\u89E3\u4E0D\u5F00\u5DF2\u7ECF\u843D\u76D8\u7684\u90A3\u4E9B\u5BC6\u6587");
        }
        return { ok: true, value: { ...vault.lockState } };
      }
      case "lock":
        vault.lock();
        return { ok: true, value: { ...vault.lockState } };
    }
  } catch (error) {
    return failure("inbox/secret-failed", reasonOf4(error));
  }
}
async function handleTags(vault, payload) {
  if (vault === void 0) return failure("inbox/vault-closed", "\u4ED3\u5E93\u8FD8\u6CA1\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u7A0D\u540E\u518D\u8BD5");
  const parsed = z4.object({ action: z4.enum(["remove"]).default("remove"), tag: z4.string().min(1).max(MAX_TAG_CHARS) }).safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-tag-request", parsed.error.message);
  const removed = await vault.removeTag(parsed.data.tag);
  return { ok: true, value: { removed } };
}
async function handleUi(ctx, payload) {
  const parsed = z4.object({
    action: z4.enum(["read", "save"]).default("read"),
    listMode: z4.enum(["grid", "compact"]).optional()
  }).safeParse(payload);
  if (!parsed.success) return failure("inbox/bad-ui-request", parsed.error.message);
  if (parsed.data.action === "save" && parsed.data.listMode !== void 0) {
    const saved = await saveUiPrefs(ctx, { listMode: parsed.data.listMode });
    if (!saved.ok) return failure("inbox/ui-unsaved", saved.reason ?? "\u5B58\u4E0D\u8FDB\u53BB");
  }
  return { ok: true, value: readUiPrefs(ctx) };
}
function imageRef2(record) {
  return {
    attachmentId: record.storeId,
    mediaType: record.mime,
    bytes: record.bytes,
    width: record.width ?? 0,
    height: record.height ?? 0,
    ...record.filename === void 0 ? {} : { name: record.filename }
  };
}
function fileRef2(record) {
  return {
    attachmentId: record.storeId,
    name: record.filename ?? "file",
    bytes: record.bytes
  };
}
async function readSlice(path, start, length) {
  const handle = await open2(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
function parseByteRange(header, total) {
  const match = header === null ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null || total === 0) return void 0;
  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  if (rawStart === "" && rawEnd === "") return void 0;
  const start = rawStart === "" ? Math.max(0, total - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? total - 1 : Math.min(Number(rawEnd), total - 1);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= total) {
    return void 0;
  }
  return { start, end };
}
async function handleAttachment(vault, attachments, request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const record = vault?.getAttachment(id);
  if (record === void 0) {
    return Response.json(failure("inbox/attachment-missing", "\u9644\u4EF6\u4E0D\u5B58\u5728"), { status: 404 });
  }
  if (!renderableMime(record.mime)) {
    return Response.json(
      failure("inbox/attachment-not-renderable", "\u53EA\u6709\u56FE\u7247\u3001\u89C6\u9891\u548C\u97F3\u9891\u80FD\u5728\u9762\u677F\u91CC\u9884\u89C8"),
      { status: 415 }
    );
  }
  const image = INBOX_IMAGE_TYPES.includes(record.mime);
  const path = image ? attachments.imageHostPath(imageRef2(record)) : attachments.fileHostPath(fileRef2(record));
  if (path === void 0) {
    return Response.json(
      failure("inbox/attachment-remote", "\u8FD9\u4E2A\u9644\u4EF6\u4E0D\u5728\u672C\u673A\uFF0C\u9762\u677F\u6CA1\u6CD5\u76F4\u63A5\u8BFB\u5B83"),
      { status: 404 }
    );
  }
  try {
    const headers = {
      "content-type": record.mime,
      "cache-control": "private, max-age=86400",
      "accept-ranges": "bytes",
      "x-content-type-options": "nosniff"
    };
    const range = parseByteRange(request.headers.get("range"), record.bytes);
    if (range === void 0) {
      return new Response(await readFile2(path), { headers });
    }
    const length = range.end - range.start + 1;
    return new Response(new Uint8Array(await readSlice(path, range.start, length)), {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(length),
        "content-range": `bytes ${String(range.start)}-${String(range.end)}/${String(record.bytes)}`
      }
    });
  } catch (error) {
    return Response.json(failure("inbox/attachment-unreadable", reasonOf4(error)), { status: 500 });
  }
}
function endpoint(path, run) {
  return {
    path,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return Response.json(failure("inbox/bad-json", "\u8BF7\u6C42\u4F53\u4E0D\u662F JSON"), { status: 400 });
      }
      try {
        return Response.json(await run(payload));
      } catch (error) {
        return Response.json(failure("inbox/handler-threw", reasonOf4(error)));
      }
    }
  };
}
function registerInboxRpc(ctx, vault) {
  ctx.inject(["connection", "attachments"], (scoped) => {
    const attachments = scoped.attachments;
    let queue = Promise.resolve();
    const serialise = (task) => {
      const next = queue.then(task, task);
      queue = next.then(
        () => void 0,
        () => void 0
      );
      return next;
    };
    const autoPush = makeAutoPush(scoped, vault, () => attachments);
    const afterChange = () => scheduleAutoPush(autoPush);
    const routes = [
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_CAPTURE}`,
        (payload) => serialise(async () => {
          const answer = await handleCapture(vault(), attachments, payload, scoped);
          if (answer.ok) afterChange();
          return answer;
        })
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_LIST}`,
        (payload) => Promise.resolve(handleList(vault(), payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DETAIL}`,
        (payload) => Promise.resolve(handleDetail(vault(), payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_UPDATE}`,
        (payload) => serialise(async () => {
          const answer = await handleUpdate(vault(), payload);
          if (answer.ok) afterChange();
          return answer;
        })
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DELETE}`,
        (payload) => serialise(async () => {
          const answer = await handleDelete(vault(), payload);
          if (answer.ok) afterChange();
          return answer;
        })
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_RESTORE}`,
        (payload) => serialise(async () => {
          const answer = await handleRestore(vault(), payload);
          if (answer.ok) afterChange();
          return answer;
        })
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PURGE}`,
        () => serialise(() => handlePurge(scoped, vault()))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_WEBDAV}`,
        (payload) => serialise(() => handleWebdav(scoped, vault(), payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PULL}`,
        () => serialise(() => handlePull(scoped, vault(), attachments))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PUSH}`,
        (payload) => serialise(() => handlePush(scoped, vault(), attachments, payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PROBE}`,
        () => Promise.resolve(handleProbe(scoped))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_UI}`,
        (payload) => serialise(() => handleUi(scoped, payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_TAGS}`,
        (payload) => serialise(() => handleTags(vault(), payload))
      ),
      endpoint(
        `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_SECRET}`,
        (payload) => serialise(() => handleSecret(vault(), payload))
      ),
      {
        path: `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}`,
        methods: ["GET"],
        requestBody: "buffered",
        fetch: (request) => handleAttachment(vault(), attachments, request)
      }
    ];
    for (const route of routes) {
      scoped.effect(
        () => scoped.connection.fetch.register(route),
        `dsh-inbox: ${route.path}`
      );
    }
  });
}

// src/host/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
var SEARCH_PAGE = 10;
var TEXT_BUDGET = 1e3;
function attachmentMarker(attachmentId) {
  return `[attachment:${attachmentId}]`;
}
function pictureIn(vault, item) {
  for (const id of item.attachmentIds) {
    const record = vault.getAttachment(id);
    if (record !== void 0 && INBOX_IMAGE_TYPES.includes(record.mime)) {
      return id;
    }
  }
  return void 0;
}
function imageRefOf(record) {
  return {
    attachmentId: record.storeId,
    mediaType: record.mime,
    bytes: record.bytes,
    width: record.width ?? 0,
    height: record.height ?? 0,
    ...record.filename === void 0 ? {} : { name: record.filename }
  };
}
function when(item) {
  return new Date(item.createdAt).toLocaleString();
}
function labelOf(item) {
  return `[${KIND_LABELS[item.kind]} \xB7 ${CATEGORY_LABELS[item.category]}${item.platform === void 0 ? "" : ` \xB7 ${item.platform}`}]`;
}
function headline(item) {
  if (item.title !== void 0) return item.title;
  if (item.linkTitle !== void 0) return item.linkTitle;
  if (item.url !== void 0) return item.url;
  if (item.note !== void 0 && item.note.length > 0) return item.note;
  if (item.category !== "secret" && item.text !== void 0) {
    const flat = item.text.replace(/\s+/g, " ").trim();
    return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS)}\u2026` : flat;
  }
  if (item.category === "secret") return "\uFF08\u5BC6\u94A5\u7C7B\u8BB0\u5F55\uFF0C\u660E\u6587\u4E0D\u5916\u4F20\uFF09";
  return item.attachmentIds.length > 0 ? `\uFF08${String(item.attachmentIds.length)} \u4E2A\u9644\u4EF6\uFF09` : "\uFF08\u65E0\u6807\u9898\uFF09";
}
function formatSearch(entries, matched, pictureOf) {
  if (matched === 0) {
    return "\u4ED3\u5E93\u91CC\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55\u3002\u53EF\u4EE5\u6362\u4E2A\u8BF4\u6CD5\uFF0C\u6216\u8005\u8BA9\u7528\u6237\u5728 dsh-inbox \u9762\u677F\u91CC\u7FFB\u4E00\u7FFB\u3002";
  }
  const lines = entries.map((item, index) => {
    const picture = pictureOf?.(item);
    const parts = [
      `${String(index + 1)}. ${labelOf(item)} ${headline(item)}` + (picture === void 0 ? "" : ` ${attachmentMarker(picture)}`)
    ];
    const named = item.title ?? item.linkTitle;
    if (item.note !== void 0 && item.note.length > 0 && named !== void 0) {
      parts.push(`   \u5907\u6CE8\uFF1A${item.note}`);
    }
    if (item.url !== void 0 && named !== void 0) parts.push(`   ${item.url}`);
    if (item.tags.length > 0) parts.push(`   \u6807\u7B7E\uFF1A${item.tags.map((tag) => `#${tag}`).join(" ")}`);
    parts.push(`   \u5B58\u5165\uFF1A${when(item)} \xB7 id: ${item.id}`);
    return parts.join("\n");
  });
  const header = matched > entries.length ? `\u5339\u914D ${String(matched)} \u6761\uFF0C\u5148\u770B\u6700\u8FD1 ${String(entries.length)} \u6761\uFF1A` : `\u5339\u914D ${String(matched)} \u6761\uFF1A`;
  const tail = matched > entries.length ? `
\u8FD8\u6709 ${String(matched - entries.length)} \u6761\u6CA1\u5217\u51FA\u6765\u2014\u2014\u9700\u8981\u7684\u8BDD\u518D\u7F29\u5C0F\u6761\u4EF6\uFF0C\u6216\u8005\u8BA9\u7528\u6237\u5230\u9762\u677F\u91CC\u770B\u5168\u90E8\u3002` : "";
  return `${header}

${lines.join("\n\n")}${tail}`;
}
function describeAttachment(attachment) {
  const size = attachment.bytes < 1024 ? `${String(attachment.bytes)} B` : `${(attachment.bytes / 1024).toFixed(1)} KB`;
  const dimensions = attachment.width === void 0 || attachment.height === void 0 ? "" : ` \xB7 ${String(attachment.width)}\xD7${String(attachment.height)}`;
  return `${attachment.filename ?? attachment.mime} \xB7 ${attachment.mime}${dimensions} \xB7 ${size}`;
}
function formatDetail(vault, item) {
  const header = `\u3010${labelOf(item).slice(1, -1)}\u3011${headline(item)}
\u5B58\u5165\uFF1A${when(item)} \xB7 id: ${item.id}`;
  if (item.category === "secret") {
    return `${header}

\u8FD9\u6761\u8BB0\u5F55\u88AB\u5F52\u7C7B\u4E3A\u5BC6\u94A5/\u8D26\u5BC6\uFF1A**\u660E\u6587\u4E0D\u4F1A\u901A\u8FC7\u5BF9\u8BDD\u8F93\u51FA**\u3002\u8BF7\u8BA9\u7528\u6237\u5230 dsh-inbox \u9762\u677F\u91CC\u67E5\u770B\u4E0E\u590D\u5236\u2014\u2014\u8FD9\u4E5F\u662F\u8FD9\u6761\u8BB0\u5F55\u80FD\u88AB\u5B89\u5168\u68C0\u7D22\u7684\u539F\u56E0\u3002`;
  }
  const blocks = [header];
  if (item.url !== void 0) blocks.push(item.url);
  if (item.note !== void 0 && item.note.length > 0) blocks.push(`\u5907\u6CE8\uFF08\u7528\u6237\u5199\u7684\uFF09\uFF1A${item.note}`);
  if (item.tags.length > 0) blocks.push(`\u6807\u7B7E\uFF1A${item.tags.map((tag) => `#${tag}`).join(" ")}`);
  if (item.text !== void 0 && item.text.length > 0) {
    if (item.text.length <= TEXT_BUDGET) {
      blocks.push(item.text);
    } else {
      blocks.push(
        `${item.text.slice(0, TEXT_BUDGET)}

\uFF08\u5171 ${String(item.text.length)} \u5B57\uFF0C\u8FD9\u91CC\u662F\u524D ${String(TEXT_BUDGET)} \u5B57\uFF1B\u5269\u4F59\u90E8\u5206\u5728\u9762\u677F\u91CC\u770B\uFF09`
      );
    }
  }
  const attachments = [];
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId);
    if (record !== void 0) attachments.push(record);
  }
  if (attachments.length > 0) {
    const lines = attachments.map((attachment) => `- ${describeAttachment(attachment)}`);
    if (item.category === "document") {
      lines.push(
        "\uFF08\u8BC1\u4EF6\u7C7B\uFF1A\u56FE\u7247\u7684\u5B57\u8282\u4E0D\u4F1A\u8FDB\u5165\u5BF9\u8BDD\uFF0C\u4E5F\u4E0D\u4F1A\u53D1\u7ED9\u6A21\u578B\uFF1B\u5361\u7247\u91CC\u7684\u7F29\u7565\u56FE\u662F\u5728\u672C\u673A\u6E32\u67D3\u7684\u3002\uFF09"
      );
    }
    for (const attachment of attachments) lines.push(attachmentMarker(attachment.id));
    blocks.push(`\u9644\u4EF6\uFF1A
${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}
var CATEGORY_VALUES = ["idea", "article", "media", "image", "document", "secret", "other"];
var KIND_VALUES = ["text", "link", "image", "file"];
function narrow(values, raw) {
  if (raw === void 0) return void 0;
  const match = values.find((value) => value === raw.trim().toLowerCase());
  return match;
}
function registerInboxTools(ctx, vault) {
  ctx.tools.register(
    defineTool({
      name: "inbox_search",
      description: "Search the user's personal dsh-inbox \u2014 their \u6536\u4EF6\u7BB1, which they also call \u4ED3\u5E93 / \u4E2A\u4EBA\u4ED3\u5E93 / inbox. It is the local store where they paste links, text, images and credentials. Use it whenever they ask what they saved, ask for something from \u6536\u4EF6\u7BB1 / \u4ED3\u5E93 / inbox, want a link they stored earlier, or want the ones they flagged \u5F85\u770B. Returns at most ten matches with their ids, newest first; records classified as secrets are listed but their text is never returned.",
      parameters: {
        text: { type: "string", description: "Words to look for in title, text, url, note or tags." },
        category: {
          type: "string",
          description: `One of: ${CATEGORY_VALUES.join(", ")}.`
        },
        watchLater: { type: "boolean", description: "true for only the records the user flagged \u5F85\u770B." },
        kind: { type: "string", description: "text, link, image or file." },
        tag: { type: "string", description: "Only records carrying this exact tag." }
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }]
      },
      async execute(args) {
        const open3 = vault();
        if (open3 === void 0) return "\u4ED3\u5E93\u6CA1\u6709\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u6682\u65F6\u67E5\u4E0D\u4E86\u3002";
        const category = narrow(CATEGORY_VALUES, args.category);
        const kind = narrow(KIND_VALUES, args.kind);
        const matched = open3.list({
          ...args.text === void 0 ? {} : { text: args.text.slice(0, MAX_FILTER_CHARS) },
          ...category === void 0 ? {} : { categories: [category] },
          ...args.watchLater === void 0 ? {} : { watchLater: args.watchLater },
          ...kind === void 0 ? {} : { kinds: [kind] },
          ...args.tag === void 0 ? {} : { tags: [args.tag] }
        });
        return formatSearch(
          matched.slice(0, SEARCH_PAGE),
          matched.length,
          (item) => pictureIn(open3, item)
        );
      }
    })
  );
  ctx.tools.register(
    defineTool({
      name: "inbox_get",
      description: "Open one record from the user's dsh-inbox (their \u6536\u4EF6\u7BB1 / \u4ED3\u5E93 / inbox) by the id a search returned: its text (truncated to 1000 characters), link, note, tags and attachment facts. Credentials are never returned in clear text. An image is described by an attachment marker the UI renders locally; set withImage only when the user asks you to look at the picture itself (that sends its bytes to you, once, for this call).",
      parameters: {
        id: { type: "string", required: true, description: "The record id from inbox_search." },
        withImage: {
          type: "boolean",
          description: "Send the record\u2019s image to you so you can look at it (costs tokens and puts the picture in this conversation). Use it only when the user asks you to see or verify the image; leave it out otherwise."
        }
      },
      output: {
        schema: { type: "string" },
        render: (args, value) => {
          const parts = [{ type: "text", text: value }];
          if (args.withImage !== true) return parts;
          const open3 = vault();
          const item = open3?.get(args.id.trim());
          if (open3 === void 0 || item === void 0) return parts;
          const id = pictureIn(open3, item);
          const record = id === void 0 ? void 0 : open3.getAttachment(id);
          if (record !== void 0) parts.push({ type: "image", attachment: imageRefOf(record) });
          return parts;
        }
      },
      async execute(args) {
        const open3 = vault();
        if (open3 === void 0) return "\u4ED3\u5E93\u6CA1\u6709\u6253\u5F00\uFF08\u6216\u6253\u5F00\u5931\u8D25\uFF09\uFF0C\u6682\u65F6\u67E5\u4E0D\u4E86\u3002";
        const item = open3.get(args.id.trim());
        if (item === void 0) return `\u6CA1\u627E\u5230 id \u4E3A ${args.id} \u7684\u8BB0\u5F55\uFF1B\u5B83\u53EF\u80FD\u5DF2\u7ECF\u88AB\u5220\u6389\u4E86\u3002`;
        return formatDetail(open3, item);
      }
    })
  );
}

// src/host/vault/lease.ts
var ENTRY = "dsh_inbox";
function registryOf() {
  const scope = globalThis;
  return scope.__dshInboxVaults ??= /* @__PURE__ */ new Map();
}
function leaseVault(ctx, onOpened) {
  const store = registryOf();
  const live = store.get(ENTRY);
  if (live !== void 0) {
    live.owners += 1;
    return leaseOf(live, store);
  }
  const entry = { owners: 1, opening: Promise.resolve() };
  store.set(ENTRY, entry);
  entry.opening = Vault.open(ctx).then(
    (vault) => {
      entry.vault = vault;
      if (entry.owners === 0) {
        store.delete(ENTRY);
        void vault.close();
        return;
      }
      onOpened?.(vault);
    },
    (error) => {
      if (store.get(ENTRY) === entry) store.delete(ENTRY);
      entry.error = error instanceof Error ? error.message : String(error);
    }
  );
  return leaseOf(entry, store);
}
function leaseOf(entry, store) {
  return {
    current: () => entry.vault,
    failure: () => entry.error,
    release: async () => {
      entry.owners -= 1;
      if (entry.owners > 0) return;
      await entry.opening;
      const vault = entry.vault;
      entry.vault = void 0;
      if (store.get(ENTRY) === entry) store.delete(ENTRY);
      await vault?.close();
    }
  };
}

// src/host/index.ts
var name = "dsh-inbox";
var inject = ["tools", "commands", "storageDomain"];
var Config = z5.object({
  ...liveFields(UI_FIELDS),
  ...liveFields(WEBDAV_FIELDS)
});
function liveFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([name2, field]) => [name2, markLive(field)])
  );
}
function apply(ctx) {
  ctx.inject(["settings"], (withSettings) => {
    installWebdavSettings(withSettings);
    installUiSettings(withSettings);
  });
  const lease = leaseVault(ctx, (opened) => {
    ctx.inject(["attachments"], (scoped) => {
      void runPull(scoped, opened, scoped.attachments).catch(() => void 0);
    });
  });
  ctx.effect(() => () => lease.release(), "dsh-inbox: vault");
  const openVault = () => lease.current();
  registerInboxCommand(ctx, openVault);
  registerInboxRpc(ctx, openVault);
  registerInboxTools(ctx, openVault);
  ctx.tools.register(
    defineTool2({
      name: "inbox_status",
      description: "Report whether the dsh-inbox (the user's \u6536\u4EF6\u7BB1 / \u4ED3\u5E93 / inbox) is loaded, how many records it holds and whether it opened cleanly. Takes no arguments.",
      parameters: {},
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean", required: true },
            package: { type: "string", required: true },
            version: { type: "string", required: true },
            vaultOpen: { type: "boolean", required: true },
            items: { type: "number", required: true },
            error: { type: "string" }
          }
        },
        render: (_args, value) => [
          {
            type: "text",
            text: value.vaultOpen ? `dsh-inbox v${value.version}: vault open, ${value.items} record(s).` : `dsh-inbox v${value.version}: vault NOT open${value.error ? ` \u2014 ${value.error}` : ""}.`
          }
        ]
      },
      async execute() {
        const open3 = openVault();
        const openError = lease.failure();
        return {
          ok: true,
          package: PACKAGE_NAME,
          version: VERSION,
          vaultOpen: open3 !== void 0,
          items: open3?.size ?? 0,
          ...openError === void 0 ? {} : { error: openError }
        };
      }
    })
  );
}
export {
  Config,
  apply,
  inject,
  name
};
