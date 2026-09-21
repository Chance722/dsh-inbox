/**
 * The deterministic half of classification.
 *
 * Rules decide what they can prove — a platform's media type, a credential by
 * shape, an ID document by aspect ratio — and say `unsure` about the rest
 * instead of guessing. That word is the seam a model pass can use later without
 * ever overriding something the *user* said.
 *
 * Nothing here reads bytes or calls anything: every input is text or numbers the
 * vault already holds, so the whole layer is a pure function and cheap to run at
 * paste time.
 */

import type { Category } from '../../shared/vocabulary.js'

/** One rule's verdict. */
export interface Classification {
  category: Category
  /** Set when the rule recognised the host and can name it. */
  platform?: string
  /** `unsure` means "a model could do better", never "this is wrong". */
  confidence: 'decided' | 'unsure'
  /** Which rule fired, in Chinese, for the record's tooltip and for debugging. */
  reason: string
  /** Extra tags a rule wants to attach, e.g. a suspected ID document. */
  tags?: readonly string[]
}

/**
 * Hostname suffix → the platform that lives there, and what it mostly serves.
 *
 * The tag is what the record shows as its platform (detail pane, tool output,
 * search payload); the third column is the **fallback** category for a host
 * whose own shape says nothing — a short link, a profile page, a
 * `/cover/abc.html` only the site itself can read. Two rules keep it honest:
 *
 * - an explicit path wins over the host's habit (`bilibili.com/read/…` is an
 *   article even though bilibili is a video site), which is why the path checks
 *   run first in `classifyLink`;
 * - a row **without** a third column is a host whose medium we cannot call
 *   (a GitHub repo is neither an article nor a video) — those stay `unsure` and
 *   may cost one model call, exactly as before.
 *
 * One row per platform, one place to extend. `platformOf` reads only the tag.
 */
const PLATFORMS: readonly (readonly [string, string, ('media' | 'article')?])[] = [
  // 视频 / 音频
  ['bilibili.com', 'bilibili', 'media'],
  ['b23.tv', 'bilibili', 'media'],
  ['youtube.com', 'youtube', 'media'],
  ['youtu.be', 'youtube', 'media'],
  ['vimeo.com', 'vimeo', 'media'],
  ['youku.com', 'youku', 'media'],
  ['v.qq.com', 'tencentvideo', 'media'],
  ['iqiyi.com', 'iqiyi', 'media'],
  ['mgtv.com', 'mgtv', 'media'],
  ['douyin.com', 'douyin', 'media'],
  ['iesdouyin.com', 'douyin', 'media'],
  ['kuaishou.com', 'kuaishou', 'media'],
  ['ixigua.com', 'xigua', 'media'],
  ['tiktok.com', 'tiktok', 'media'],
  ['twitch.tv', 'twitch', 'media'],
  ['dailymotion.com', 'dailymotion', 'media'],
  ['music.163.com', 'netease-music', 'media'],
  ['y.qq.com', 'qq-music', 'media'],
  ['spotify.com', 'spotify', 'media'],
  ['soundcloud.com', 'soundcloud', 'media'],
  ['ximalaya.com', 'ximalaya', 'media'],
  // 文章 / 帖子
  ['mp.weixin.qq.com', 'wechat', 'article'],
  ['weixin.qq.com', 'wechat', 'article'],
  ['zhihu.com', 'zhihu', 'article'],
  ['juejin.cn', 'juejin', 'article'],
  ['csdn.net', 'csdn', 'article'],
  ['cnblogs.com', 'cnblogs', 'article'],
  ['jianshu.com', 'jianshu', 'article'],
  ['segmentfault.com', 'segmentfault', 'article'],
  ['v2ex.com', 'v2ex', 'article'],
  ['sspai.com', 'sspai', 'article'],
  ['36kr.com', '36kr', 'article'],
  ['infoq.cn', 'infoq', 'article'],
  ['toutiao.com', 'toutiao', 'article'],
  ['weibo.com', 'weibo', 'article'],
  ['weibo.cn', 'weibo', 'article'],
  ['douban.com', 'douban', 'article'],
  ['xiaohongshu.com', 'xiaohongshu', 'article'],
  ['xhslink.com', 'xiaohongshu', 'article'],
  ['maimai.cn', 'maimai', 'article'],
  ['yuque.com', 'yuque', 'article'],
  ['medium.com', 'medium', 'article'],
  ['substack.com', 'substack', 'article'],
  ['dev.to', 'devto', 'article'],
  ['news.ycombinator.com', 'hackernews', 'article'],
  ['reddit.com', 'reddit', 'article'],
  ['stackoverflow.com', 'stackoverflow', 'article'],
  ['arxiv.org', 'arxiv', 'article'],
  ['developer.mozilla.org', 'mdn', 'article'],
  ['x.com', 'twitter', 'article'],
  ['twitter.com', 'twitter', 'article'],
  ['instagram.com', 'instagram', 'article'],
  ['threads.net', 'threads', 'article'],
  ['bsky.app', 'bluesky', 'article'],
  ['t.me', 'telegram', 'article'],
  ['linkedin.com', 'linkedin', 'article'],
  // 代码 / 包：认得出站点，说不准"文章还是视频"，交给模型
  ['github.com', 'github'],
  ['gitlab.com', 'gitlab'],
  ['gitee.com', 'gitee'],
  ['npmjs.com', 'npm'],
  ['pypi.org', 'pypi'],
  ['huggingface.co', 'huggingface'],
]

/**
 * Credential shapes. Deliberately conservative: a false positive hides a record
 * behind the "secrets are never echoed" rule, so each pattern is one people
 * actually paste, not a general "looks random" heuristic.
 */
const SECRET_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/\b(secret|access)[-_]?(id|key)\b\s*[:=]/i, '出现 secretId / secretKey 赋值'],
  [/\b(api[-_]?key|apikey)\b\s*[:=]/i, '出现 api key 赋值'],
  [/\b(password|passwd|pwd)\b\s*[:=]\s*\S/i, '出现密码赋值'],
  [/\b(token|bearer)\b\s*[:=]\s*\S/i, '出现 token 赋值'],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/, '出现 sk- 形式的密钥'],
  [/\bAKIA[0-9A-Z]{16}\b/, '出现 AWS access key id'],
  [/\bghp_[A-Za-z0-9]{20,}\b/, '出现 GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '出现私钥块'],
  [/\bmongodb(\+srv)?:\/\/[^\s]+:[^\s]+@/i, '出现带口令的连接串'],
]

/** True when the text carries something that must never be echoed. */
export function findSecret(text: string): string | undefined {
  for (const [pattern, reason] of SECRET_PATTERNS) {
    if (pattern.test(text)) return reason
  }
  return undefined
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** The `PLATFORMS` row that claims a host, if any. */
function ruleFor(url: string): readonly [string, string, ('media' | 'article')?] | undefined {
  const host = hostOf(url)
  if (host === undefined) return undefined
  for (const rule of PLATFORMS) {
    const [suffix] = rule
    if (host === suffix || host.endsWith(`.${suffix}`)) return rule
  }
  return undefined
}

/** The platform a URL belongs to, or undefined when it is just "somewhere". */
export function platformOf(url: string): string | undefined {
  return ruleFor(url)?.[1]
}

/**
 * A path that names the medium, whatever host it is on.
 *
 * Paths are the one thing that keeps meaning across sites, so they are checked
 * before a host's habit: `/read/` on a video site is still an article.
 */
function pathSaysMedia(path: string): boolean {
  return /\/video\/|\/watch\b|\/audio\/|\/podcast|\/shorts\/|\/v_show\/|\/playlist\b/.test(path)
}

/**
 * A path that names a written piece, whatever host it is on.
 *
 * Only whole words, and only ones that mean something on their own: an earlier
 * cut had `/a/` and `/p/` (SegmentFault and Zhihu columns), which turned
 * `github.com/a/b` into an article — a one-letter segment is a path, not a
 * signal. Those hosts carry a habit in `PLATFORMS` now, so nothing is lost.
 */
function pathSaysArticle(path: string): boolean {
  return /\/article\/|\/articles\/|\/post\/|\/posts\/|\/blog\/|\/read\/|\/story\/|\/item\b/.test(path)
}

/**
 * Classify a link by its host and path.
 *
 * @param url - the pasted URL.
 * @returns the verdict; `unsure` for a host no rule knows.
 */
export function classifyLink(url: string): Classification {
  const rule = ruleFor(url)
  const platform = rule?.[1]
  const habit = rule?.[2]
  const parsed = (() => {
    try {
      return new URL(url)
    } catch {
      return undefined
    }
  })()
  if (parsed === undefined) {
    return { category: 'other', confidence: 'unsure', reason: '链接解析不了' }
  }

  const path = parsed.pathname
  const base = platform === undefined ? {} : { platform }

  if (pathSaysMedia(path)) {
    return { ...base, category: 'media', confidence: 'decided', reason: '链接指向视频/音频页' }
  }
  if (pathSaysArticle(path)) {
    return { ...base, category: 'article', confidence: 'decided', reason: '链接指向文章页' }
  }
  if (habit !== undefined) {
    return {
      ...base,
      category: habit,
      confidence: 'decided',
      reason: habit === 'media' ? `${String(platform)} 上的视频/音频页` : `${String(platform)} 上的文章页`,
    }
  }
  if (platform !== undefined) {
    return { ...base, category: 'other', confidence: 'unsure', reason: `认得出平台是 ${platform}，但说不准是文章还是视频` }
  }
  return { category: 'other', confidence: 'unsure', reason: '不认识的站点，先放其它' }
}

/**
 * Classify a pasted string.
 *
 * @param text - exactly what was pasted.
 * @returns a secret verdict, or `unsure` — plain text rarely proves its own kind.
 */
export function classifyText(text: string): Classification {
  const reason = findSecret(text)
  if (reason !== undefined) {
    return { category: 'secret', confidence: 'decided', reason }
  }
  return {
    category: 'other',
    confidence: 'unsure',
    reason: '没命中规则，暂时放其它',
  }
}

/** Aspect ratios a document tends to have, with the tolerance we accept. */
const DOCUMENT_RATIOS: readonly (readonly [number, string])[] = [
  [85.6 / 54, '身份证/银行卡（85.6×54）'],
  [1.4142, 'A4 竖版（1:√2）'],
  [1.42, '护照数据页'],
]

/**
 * Classify an image from the dimensions the store already recorded.
 *
 * A ratio is evidence, not proof, so a suspected ID document stays `image` and
 * gains a tag: only the user can promote it to the `document` category, which is
 * exactly what the product decision asks for. No bytes are read, and nothing is
 * uploaded to decide this.
 *
 * @param dimensions - stored width/height, when known.
 * @returns the verdict.
 */
export function classifyImage(dimensions: { width?: number; height?: number }): Classification {
  const { width, height } = dimensions
  if (width === undefined || height === undefined || width <= 0 || height <= 0) {
    return { category: 'image', confidence: 'unsure', reason: '没有尺寸信息，只能先当图片' }
  }

  const ratio = Math.max(width, height) / Math.min(width, height)
  for (const [target, label] of DOCUMENT_RATIOS) {
    if (Math.abs(ratio - target) <= 0.03) {
      return {
        category: 'image',
        confidence: 'unsure',
        reason: `长宽比 ${ratio.toFixed(2)} 接近${label}，先标疑似，等你确认`,
        tags: ['疑似证件'],
      }
    }
  }
  return { category: 'image', confidence: 'decided', reason: '常规照片比例' }
}
