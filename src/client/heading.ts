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

/**
 * What the record can call itself, without the user having named it.
 *
 * A link has the headline its page carries (fetched at capture time, see
 * `src/host/link-title.ts`) and failing that its address; a text has its own
 * words; a picture or a file has the name it arrived with. A credential has
 * **nothing** here on purpose: its text is the secret, and this module exists so
 * that the secret never becomes a name.
 */
function ownName(entry: EntrySummary): string | undefined {
  if (isSecret(entry)) return undefined
  return firstFilled(entry.linkTitle, entry.url, entry.preview, entry.attachmentName)
}

/**
 * What the row is called, with the note clamped to `noteChars`.
 *
 * The order is: the name the user typed, then whatever the record can call
 * itself, then the note — and the note is a genuine last resort rather than a
 * decoration: a credential the user has not named, and a picture that arrived
 * without a file name, have nothing else at all, and two rows both reading
 * 「密钥 / 账密」 are two rows you cannot tell apart. Once a record *is* named, its
 * note stays in the pane and out of the list.
 */
function build(entry: EntrySummary, noteChars: number): string {
  const title = firstFilled(entry.title)
  if (title !== undefined) return title
  const own = ownName(entry)
  if (own !== undefined) return own
  return noteLine(entry.note, noteChars) || (isSecret(entry) ? '密钥 / 账密' : UNTITLED)
}

/**
 * The one-line heading a card or a dock row shows.
 *
 * The row is the **name**, and only the name: the category glyph beside it
 * already says what kind of thing this is, so a 「密钥 / 账密（…）」 prefix only ate
 * the width a name needs. What the name came from, in order: the user's own
 * word, then the record's own (address, text, file name), then the note.
 *
 * The same shape covers a picture or a file, which has no text to be named by:
 * its file name takes the name slot. A name the user typed into the detail pane
 * outranks everything.
 *
 * @param entry - the record to name.
 * @returns the heading, clamped to one short line.
 */
export function headingOf(entry: EntrySummary): string {
  return build(entry, NOTE_IN_HEADING_CHARS)
}

/**
 * The same heading, plus the note the row no longer shows, for the hover
 * tooltip.
 *
 * The card only ever shows one ellipsised line, so the full text has to be
 * reachable somewhere short of opening the detail pane — and since the note
 * left the row itself, the tooltip is where it lives now.
 *
 * @param entry - the record to name.
 * @returns the heading, with the whole note in the parentheses.
 */
export function headingTooltipOf(entry: EntrySummary): string {
  const name = build(entry, Number.MAX_SAFE_INTEGER)
  const note = noteLine(entry.note, Number.MAX_SAFE_INTEGER)
  // When the note *is* the name (a nameless record's last resort), repeating it
  // in parentheses would just say the same thing twice.
  return note.length === 0 || note === name ? name : `${name}（${note}）`
}
