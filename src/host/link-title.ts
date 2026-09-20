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
 * Three rules keep it honest:
 * - it never writes `title`. That field is the user's own word, and the
 *   credentials rule depends on it staying that way (`AGENTS.md` 3); the fetched
 *   headline lives in `linkTitle` instead;
 * - it writes nothing when the record already has a name, and nothing when the
 *   user renamed it while the fetch was in flight;
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
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (match === null) return undefined
  const flat = decodeEntities(match[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length === 0) return undefined
  return flat.length > MAX_LINK_TITLE_CHARS ? flat.slice(0, MAX_LINK_TITLE_CHARS) : flat
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
 * @returns the stored headline, or undefined when nothing was stored.
 */
export async function fetchLinkTitle(
  vault: Vault,
  id: string,
  web: WebFetchSeam,
): Promise<string | undefined> {
  const filed = vault.get(id)
  if (filed === undefined || filed.kind !== 'link' || filed.url === undefined) return undefined
  if (filed.title !== undefined || filed.linkTitle !== undefined) return undefined

  let result: WebFetchResult
  try {
    result = await web.fetch({ url: filed.url }, AbortSignal.timeout(FETCH_TIMEOUT_MS))
  } catch {
    // Unreachable, refused, timed out, or blocked by the seam's address policy:
    // the URL was a fine name before this existed and still is.
    return undefined
  }
  if (result.statusCode >= 400 || result.body.kind !== 'html') return undefined

  const title = titleFromHtml(result.body.content)
  if (title === undefined) return undefined

  // The network took a moment, and the vault may have moved on since the read
  // above: check again, so a rename (or a delete) made while we were waiting
  // wins over a headline nobody asked for.
  const current = vault.get(id)
  if (current === undefined || current.title !== undefined || current.linkTitle !== undefined) {
    return undefined
  }
  await vault.patch(id, { linkTitle: title })
  return title
}
