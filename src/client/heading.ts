/**
 * What a record is *called* on screen, in one place.
 *
 * Both surfaces that name a record — the panel's list and the conversation-side
 * dock — have to obey the same red line (`AGENTS.md` 3: 账密类列表脱敏), and two
 * copies of that rule are two chances to leak: the dock printed a credential's
 * `preview`, which is the first line of the secret itself.
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

/** The heading without the description: what the record *is*, or its name. */
function bareHeading(entry: EntrySummary): string {
  if (isSecret(entry)) return '密钥 / 账密'
  return entry.title ?? entry.url ?? entry.preview ?? '（无标题）'
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
 * The one-line heading a card or a dock row shows.
 *
 * A credential's heading says nothing on its own, and three 「密钥 / 账密」 rows are
 * three rows you cannot tell apart. The user's own description is not the secret
 * (it is the same field `inbox_search` already shows the model), so it becomes
 * the parenthetical: 密钥 / 账密（公司邮箱）. Records that may show their text do not
 * need it — their heading already is their name.
 *
 * @param entry - the record to name.
 * @returns the heading, clamped to one short line.
 */
export function headingOf(entry: EntrySummary): string {
  const heading = bareHeading(entry)
  if (!isSecret(entry)) return heading
  return parenthesised(heading, noteLine(entry.note, NOTE_IN_HEADING_CHARS))
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
  const heading = bareHeading(entry)
  if (!isSecret(entry)) return heading
  return parenthesised(heading, noteLine(entry.note, Number.MAX_SAFE_INTEGER))
}
