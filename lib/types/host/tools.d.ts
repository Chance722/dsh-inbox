/**
 * The model-facing tools: what the vault looks like from inside a conversation.
 *
 * Two rules shape every string these tools return.
 *
 * 1. **Credentials never leave the vault.** A record classified as `secret`
 *    answers with a refusal, not with its text — the model must not be able to
 *    read one out by asking, and the session log must not collect it.
 * 2. **Attachment bytes stay in the vault by default.** A tool result is model
 *    visible and persisted, so an image is described by a marker the panel and
 *    the tool card resolve locally; the picture itself is not part of the
 *    result. That keeps a pasted ID document out of the cloud even when the
 *    model is the one that fetched the record. The single exception is
 *    `inbox_get` with `withImage: true` — the user asking "look at the picture
 *    and tell me what it is" is a request the model cannot honour otherwise,
 *    and it is opt-in per call, by name, never the default.
 *
 * `inbox_put` is the one tool here that *writes*, and the same two rules shape
 * it: what it files is the vault's business, and what it answers with is a
 * count, never the content it was handed back.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type AttachmentSummary, type EntrySummary } from '../shared/panel-wire.js';
import type { Item } from './vault/spec.js';
import { type Vault } from './vault/vault.js';
/** How many records one search answers with before saying "there are more". */
export declare const SEARCH_PAGE = 10;
/** How much of a stored text the model reads; the rest stays in the vault. */
export declare const TEXT_BUDGET = 1000;
/** Marker the tool card turns into a thumbnail; the bytes stay off the wire. */
export declare function attachmentMarker(attachmentId: string): string;
/**
 * Render a search answer.
 *
 * @param entries - the page of matches, newest first.
 * @param matched - how many records matched in total.
 * @returns the model-facing text.
 */
export declare function formatSearch(entries: readonly Item[], matched: number, 
/** The image marker a line should carry, when the caller can find one. */
pictureOf?: (item: Item) => string | undefined): string;
/**
 * Render one record in full, under the two rules above.
 *
 * @param vault - the open vault, for attachment metadata.
 * @param item - the record to describe.
 * @returns the model-facing text.
 */
export declare function formatDetail(vault: Vault, item: Item): string;
/** Project one record down to what a card needs (kept for the card contract). */
export declare function summaryOf(item: Item): EntrySummary;
/** Attachment summary projection, shared with the panel wire. */
export declare function attachmentsOf(vault: Vault, item: Item): AttachmentSummary[];
/**
 * Register the vault's model-facing tools.
 *
 * @param ctx - host context carrying the tool registry.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export declare function registerInboxTools(ctx: Context, vault: () => Vault | undefined): void;
