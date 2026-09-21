/**
 * The headline behind a link, fetched from the page itself.
 *
 * A pasted article arrives as a URL, and a list of URLs is a list of things you
 * cannot tell apart — while the page carries a headline that names it perfectly.
 * Reading `<title>` costs **no model tokens**: it is one plain HTTP GET through
 * the harness's own web seam (`ctx.web`), which pins public addresses, refuses
 * private ones, follows only same-origin redirects, and caps both time and size.
 * It runs after the record is stored, never in front of the paste.
 *
 * Four rules keep it honest:
 * - it never writes `title`. That field is the user's own word, and the
 *   credentials rule depends on it staying that way (`AGENTS.md` 3); the fetched
 *   headline lives in `linkTitle` instead;
 * - it writes nothing when the record already has a name, and nothing when the
 *   user renamed it while the fetch was in flight;
 * - it does not take a name from a page that is not the page: a site can answer
 *   with an anti-bot page that carries a *real-looking* `<title>` (bilibili's is
 *   「验证码_哔哩哔哩」), and that string names the refusal, not the link;
 * - it never turns a failure into a problem: a dead link, a slow host or a page
 *   that is not HTML simply leaves the URL as the name, which is where this
 *   started.
 */

import type { WebFetchResult } from '@deepseek-ai/dsh-web'

import type { Vault } from './vault/vault.js'

/** Ceiling on a stored headline. The card clamps far earlier (24 chars + …). */
export const MAX_LINK_TITLE_CHARS = 200

/** How long one headline fetch may take before it is abandoned. */
const FETCH_TIMEOUT_MS = 8_000

/**
 * The slice of `ctx.web` this module uses.
 *
 * Structural on purpose: the service belongs to `@deepseek-ai/dsh-web`, but this
 * half only ever calls one method of it, and a profile without that seam should
 * simply not get headlines rather than fail to load.
 */
export interface WebFetchSeam {
  fetch(request: { readonly url: string }, signal?: AbortSignal): Promise<WebFetchResult>
}

/** The entities a page title actually uses; anything else is left untouched. */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Markup that only a challenge page carries.
 *
 * This is the precise half of the refusal check: the strings below come from the
 * anti-bot pages themselves (bilibili's risk-captcha app, Cloudflare's challenge
 * platform, Geetest's widget), and a page that ships one is a page that means to
 * ask a human a question rather than to be read.
 */
const REFUSAL_MARKER = /(risk-captcha|_BiliGreyResult|cf-chl|challenge-platform|geetest)/i

/** Titles that name a refusal rather than the page. */
const REFUSAL_TITLE =
  /(验证码|人机验证|安全验证|环境异常|访问异常|请完成验证|正在验证|captcha|just a moment|attention required|access denied|forbidden)/i

/**
 * How much readable text a page must carry for its headline to be believed on a
 * challenge-free page.
 *
 * A refusal shell is a JavaScript application: it has the title and nothing else
 * (bilibili's is 1360 bytes, all `<script>` and empty `<div>`s). Two hundred
 * characters is far below any page that actually says something, so a page under
 * it is one whose title alone is all we would have — and a title alone is not
 * enough to name a record with.
 */
const REFUSAL_TEXT_FLOOR = 200

/** How much text a document shows a reader, with the invisible parts cut out. */
function visibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '').length
}

/**
 * True when this document is a refusal wearing a page's clothes.
 *
 * The checks before this one — a 2xx status, an HTML body, a non-empty
 * `<title>` — all pass on bilibili's anti-bot page, which is what made a record
 * show 「验证码」 as its name (2026-09-21). What separates that page from a real
 * one is either its own markup or the fact that it carries no text at all.
 *
 * Both halves are deliberately biased towards refusing: a link whose name we
 * skip shows its own address, which is honest and one keystroke away from being
 * named by hand, while a refusal kept as a name is a wrong name that stays.
 *
 * @param html - the decoded document.
 * @param title - the headline pulled out of it.
 * @returns true when the page refuses to be read.
 */
export function looksLikeRefusal(html: string, title: string): boolean {
  if (REFUSAL_MARKER.test(html)) return true
  return visibleTextLength(html) < REFUSAL_TEXT_FLOOR && REFUSAL_TITLE.test(title)
}

function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    }
    return ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** The `content` of the first `<meta>` whose `property`/`name` is one of these. */
function metaContent(html: string, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i').exec(html)?.[0]
    if (tag === undefined) continue
    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (content !== undefined && content.trim().length > 0) return content
  }
  return undefined
}

/**
 * Pull the `<title>` out of an HTML document.
 *
 * A regex over the raw text, not a parser: we want one string out of a page we
 * are never going to render, and pulling an HTML parser into the host half for
 * that would be a dependency bought for nothing.
 *
 * @param html - the decoded document.
 * @returns the collapsed, decoded headline, or undefined when there is none.
 */
export function titleFromHtml(html: string): string | undefined {
  /*
    `<title>` first, then the social-graph ones. A page whose `<title>` is empty
    is not a rare accident — a site that renders its headline in JavaScript
    often still ships `og:title`, and that is the headline its own share card
    uses, so it is the same claim the site makes about itself.
  */
  const candidates = [
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1],
    metaContent(html, ['og:title', 'twitter:title']),
  ]
  for (const candidate of candidates) {
    if (candidate === undefined) continue
    const flat = decodeEntities(candidate).replace(/\s+/g, ' ').trim()
    if (flat.length === 0) continue
    return flat.length > MAX_LINK_TITLE_CHARS ? flat.slice(0, MAX_LINK_TITLE_CHARS) : flat
  }
  return undefined
}

/**
 * Fetch one link's headline and store it, if it is still worth storing.
 *
 * The record is re-read here rather than taken from the caller: a caller's copy
 * is by definition the one from *before* the network, and a record that is
 * already named (or already gone) must not cost a request at all.
 *
 * @param vault - the open vault.
 * @param id - the record that was just filed.
 * @param web - `ctx.web`, the harness's own web seam.
 * @param log - where a miss is explained. Silent failure is undebuggable: the
 *   user sees a URL where a headline should be and has nowhere to look. Only the
 *   **host** is logged, never the whole URL — a link can carry a token in its
 *   query string, and a log file is not the place for one.
 * @returns the stored headline, or undefined when nothing was stored.
 */
export async function fetchLinkTitle(
  vault: Vault,
  id: string,
  web: WebFetchSeam,
  log: (message: string) => void = () => {},
): Promise<string | undefined> {
  const filed = vault.get(id)
  if (filed === undefined || filed.kind !== 'link' || filed.url === undefined) return undefined
  if (filed.title !== undefined || filed.linkTitle !== undefined) return undefined

  const host = (() => {
    try {
      return new URL(filed.url).host
    } catch {
      return '（无法解析的地址）'
    }
  })()

  let result: WebFetchResult
  try {
    result = await web.fetch({ url: filed.url }, AbortSignal.timeout(FETCH_TIMEOUT_MS))
  } catch (error) {
    // Unreachable, refused, timed out, or blocked by the seam's address policy:
    // the URL was a fine name before this existed and still is.
    const reason = error instanceof Error ? error.message : String(error)
    await miss(vault, id, `network:${reason}`)
    log(`${host}：请求失败（${reason}）`)
    return undefined
  }
  if (result.statusCode >= 400) {
    await miss(vault, id, `http:${String(result.statusCode)}`)
    log(`${host}：HTTP ${String(result.statusCode)}`)
    return undefined
  }
  if (result.body.kind !== 'html') {
    await miss(vault, id, `not-html:${result.body.kind}`)
    log(`${host}：不是 HTML（${result.body.kind}）`)
    return undefined
  }

  const title = titleFromHtml(result.body.content)
  if (title === undefined) {
    /*
      The answer to "为什么这条链接没名字" is usually here: a site that serves an
      anti-bot page (WeChat does exactly this: HTTP 200, `<title></title>`,
      「环境异常，完成验证后即可继续访问」) gives us nothing to read, and no
      amount of retrying changes that. Say so on the record.
    */
    await miss(vault, id, 'no-title')
    log(`${host}：页面里没有 <title>（${String(result.body.content.length)} 字符）`)
    return undefined
  }

  /*
    A page can answer with a title and still be a refusal — bilibili's is the
    case that cost us a record's name: HTTP 200, 1360 bytes, `<title>验证码_哔哩哔哩</title>`
    around a risk-captcha app that never renders. Nothing before this line can
    tell it apart from a small page, which is why it lives here.
  */
  if (looksLikeRefusal(result.body.content, title)) {
    await miss(vault, id, 'refused-page')
    log(`${host}：抓到的是拒绝页，不当名字`)
    return undefined
  }

  // The network took a moment, and the vault may have moved on since the read
  // above: check again, so a rename (or a delete) made while we were waiting
  // wins over a headline nobody asked for.
  const current = vault.get(id)
  if (current === undefined || current.title !== undefined || current.linkTitle !== undefined) {
    log(`${host}：抓到了标题，但记录已经有名字了`)
    return undefined
  }
  // An empty code clears an earlier miss: this record now has a headline.
  await vault.patch(id, { linkTitle: title, linkTitleError: '' })
  log(`${host}：标题「${title}」`)
  return title
}

/**
 * Record why nothing was stored, so the pane can say it instead of looking
 * broken.
 *
 * Nothing is written when the record has been named or deleted in the meantime:
 * the note is about a fetch, and it is not worth a write of its own. Note the
 * callers' order — the write comes first, the log line after: a log line must
 * never be the reason a record goes unexplained (a test caught exactly that).
 */
async function miss(vault: Vault, id: string, reason: string): Promise<void> {
  const current = vault.get(id)
  if (current !== undefined && current.title === undefined && current.linkTitle === undefined) {
    await vault.patch(id, { linkTitleError: reason })
  }
}
