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

/** Hostname suffix → platform tag. Extend as real links show up. */
const PLATFORMS: readonly (readonly [string, string])[] = [
  ['bilibili.com', 'bilibili'],
  ['b23.tv', 'bilibili'],
  ['mp.weixin.qq.com', 'wechat'],
  ['weixin.qq.com', 'wechat'],
  ['zhihu.com', 'zhihu'],
  ['xiaohongshu.com', 'xiaohongshu'],
  ['xhslink.com', 'xiaohongshu'],
  ['maimai.cn', 'maimai'],
  ['github.com', 'github'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['x.com', 'twitter'],
  ['twitter.com', 'twitter'],
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

/** The platform a URL belongs to, or undefined when it is just "somewhere". */
export function platformOf(url: string): string | undefined {
  const host = hostOf(url)
  if (host === undefined) return undefined
  for (const [suffix, platform] of PLATFORMS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return platform
  }
  return undefined
}

/** A video/audio platform, by host or by the path that names the medium. */
function isMedia(host: string, path: string): boolean {
  if (/bilibili\.com$|b23\.tv$|youtube\.com$|youtu\.be$/.test(host)) {
    return !path.startsWith('/read/')
  }
  return /\/video\/|\/watch\b|\/audio\/|\/podcast/.test(path)
}

/** An article-shaped page. */
function isArticle(host: string, path: string): boolean {
  if (/mp\.weixin\.qq\.com$|weixin\.qq\.com$/.test(host)) return true
  if (/zhihu\.com$/.test(host)) return true
  if (/xiaohongshu\.com$|xhslink\.com$/.test(host)) return true
  return /\/article\/|\/post\/|\/blog\/|\/read\//.test(path)
}

/**
 * Classify a link by its host and path.
 *
 * @param url - the pasted URL.
 * @returns the verdict; `unsure` for a host no rule knows.
 */
export function classifyLink(url: string): Classification {
  const platform = platformOf(url)
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

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname
  const base = platform === undefined ? {} : { platform }

  if (isMedia(host, path)) {
    return { ...base, category: 'media', confidence: 'decided', reason: '链接指向视频/音频页' }
  }
  if (isArticle(host, path)) {
    return { ...base, category: 'article', confidence: 'decided', reason: '链接指向文章页' }
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
