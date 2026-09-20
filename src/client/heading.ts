/**
 * What a record is *called* on screen, in one place.
 *
 * Both surfaces that name a record — the panel's list and the conversation-side
 * dock — have to obey the same red line (`AGENTS.md` 3: 账密类列表脱敏), and two
 * copies of that rule are two chances to leak: the dock printed a credential's
 * `preview`, which is the first line of the secret itself.
 *
 * It is also the only place that decides what a record with *no* name of its own
 * is called: an uploaded photo used to render as 「（无标题）」 even though the
 * file name had been stored all along (`attachmentName`).
 *
 * Presentation only, and browser-side only: it reads `EntrySummary` and returns
 * strings. Nothing here may import a host module.
 */

import type { EntrySummary } from '../shared/panel-wire.js'

/**
 * How much of a credential's description rides along in its heading.
 *
 * The heading is ellipsised by CSS on top of this; the cap is what keeps a
 * 300-character note out of the title slot at all, so the line still reads as a
 * name rather than as a paragraph.
 */
export const NOTE_IN_HEADING_CHARS = 24

/** True when this record's own text must never be printed outside the detail. */
export function isSecret(entry: EntrySummary): boolean {
  return entry.category === 'secret'
}

/** What a record with nothing to show is called. */
const UNTITLED = '（无标题）'

/** The first of these that is actually a name — an empty string is not one. */
function firstFilled(...values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0)
}

/** One clamped line of a description, or `''` when there is none to show. */
function noteLine(note: string | undefined, chars: number): string {
  const collapsed = (note ?? '').replace(/\s+/g, ' ').trim()
  if (collapsed.length === 0) return ''
  return collapsed.length <= chars ? collapsed : `${collapsed.slice(0, chars)}…`
}

function parenthesised(heading: string, note: string): string {
  return note.length === 0 ? heading : `${heading}（${note}）`
}

/**
 * What a credential's parentheses carry: the user's own words.
 *
 * The name they typed wins, the description is the fallback, and with neither
 * the row is just 「密钥 / 账密」. Both fields are the user's own words — the same
 * ones `inbox_search` already shows the model — and neither is the secret: the
 * record's text is refused before this module is ever reached.
 */
function credentialDetail(entry: EntrySummary, noteChars: number): string {
  return noteLine(firstFilled(entry.title), noteChars) || noteLine(entry.note, noteChars)
}

/**
 * The one-line heading, with the description clamped to `noteChars`.
 *
 * Two records reach the fallback half of this: a credential, and a record whose
 * own type carries no text at all (a picture, a file). Both are named the same
 * way — 「名字（描述）」 — because in both cases the name alone cannot tell two of
 * them apart.
 */
function build(entry: EntrySummary, noteChars: number): string {
  if (isSecret(entry)) return parenthesised('密钥 / 账密', credentialDetail(entry, noteChars))
  // A name the record can produce itself: what the user typed, then the link,
  // then its own text.
  const own = firstFilled(entry.title, entry.url, entry.preview)
  if (own !== undefined) return own
  // Nothing to name itself with. The file name it arrived as is the fallback,
  // and with no name either, the description is the only thing left.
  const name = firstFilled(entry.attachmentName)
  if (name === undefined) return noteLine(entry.note, noteChars) || UNTITLED
  return parenthesised(name, noteLine(entry.note, noteChars))
}

/**
 * The one-line heading a card or a dock row shows.
 *
 * A credential's heading says nothing on its own, and three 「密钥 / 账密」 rows are
 * three rows you cannot tell apart, so the name the user gave it — or the
 * description, when there is no name — becomes the parenthetical:
 * 密钥 / 账密（公司邮箱）. The fixed prefix stays: a row should still say what it
 * is, and for this category the record's own text must never be its name.
 * Records that may show their text do not need the prefix — their heading
 * already is their name.
 *
 * The same shape covers a picture or a file, which has no text to be named by:
 * its file name takes the name slot and the description the parentheses —
 * 身份证正面.jpg（我的身份证）. A name the user typed into the detail pane outranks
 * both.
 *
 * @param entry - the record to name.
 * @returns the heading, clamped to one short line.
 */
export function headingOf(entry: EntrySummary): string {
  return build(entry, NOTE_IN_HEADING_CHARS)
}

/**
 * The same heading with the description intact, for the hover tooltip.
 *
 * The card only ever shows one ellipsised line, so the full text has to be
 * reachable somewhere short of opening the detail pane.
 *
 * @param entry - the record to name.
 * @returns the heading, with the whole description in the parentheses.
 */
export function headingTooltipOf(entry: EntrySummary): string {
  return build(entry, Number.MAX_SAFE_INTEGER)
}
