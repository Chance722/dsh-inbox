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
import type { EntrySummary } from '../shared/panel-wire.js';
/**
 * How much of a credential's description rides along in its heading.
 *
 * The heading is ellipsised by CSS on top of this; the cap is what keeps a
 * 300-character note out of the title slot at all, so the line still reads as a
 * name rather than as a paragraph.
 */
export declare const NOTE_IN_HEADING_CHARS = 24;
/** True when this record's own text must never be printed outside the detail. */
export declare function isSecret(entry: EntrySummary): boolean;
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
export declare function headingOf(entry: EntrySummary): string;
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
export declare function headingTooltipOf(entry: EntrySummary): string;
