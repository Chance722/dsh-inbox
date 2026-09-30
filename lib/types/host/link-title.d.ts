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
import type { WebFetchResult } from '@deepseek-ai/dsh-web';
import type { Vault } from './vault/vault.js';
/** Ceiling on a stored headline. The card clamps far earlier (24 chars + …). */
export declare const MAX_LINK_TITLE_CHARS = 200;
/**
 * The slice of `ctx.web` this module uses.
 *
 * Structural on purpose: the service belongs to `@deepseek-ai/dsh-web`, but this
 * half only ever calls one method of it, and a profile without that seam should
 * simply not get headlines rather than fail to load.
 */
export interface WebFetchSeam {
    fetch(request: {
        readonly url: string;
    }, signal?: AbortSignal): Promise<WebFetchResult>;
}
/**
 * True when this document is a refusal wearing a page's clothes.
 *
 * The checks before this one — a 2xx status, an HTML body, a non-empty
 * `<title>` — all pass on bilibili's anti-bot page, which is what made a record
 * show 「验证码」 as its name (2026-09-21). What separates that page from a real
 * one is that it carries **no text at all**: the challenge shell is 1360 bytes
 * of scripts and empty containers, while the page it stands in for has
 * thousands of characters. Only then do the markers and the shape of the title
 * decide, because the markers alone are not evidence — real bilibili pages
 * carry the same strings.
 *
 * Both halves are deliberately biased towards refusing: a link whose name we
 * skip shows its own address, which is honest and one keystroke away from being
 * named by hand, while a refusal kept as a name is a wrong name that stays.
 *
 * @param html - the decoded document.
 * @param title - the headline pulled out of it.
 * @returns true when the page refuses to be read.
 */
export declare function looksLikeRefusal(html: string, title: string): boolean;
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
export declare function titleFromHtml(html: string): string | undefined;
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
export declare function fetchLinkTitle(vault: Vault, id: string, web: WebFetchSeam, log?: (message: string) => void): Promise<string | undefined>;
