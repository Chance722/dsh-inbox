/**
 * Pure filtering over items.
 *
 * The official storage form is a key-value domain with no query language, so
 * selection is an in-memory pass. At this vault's scale (thousands of records)
 * that is the right trade: no index to build, no migration to run, and the
 * whole rule set is testable without any storage at all.
 */
import type { Category, Kind } from '../../shared/vocabulary.js';
import type { Item } from './spec.js';
export interface ItemQuery {
    /** Case-insensitive substring match over title, linkTitle, text, url, note and tags. */
    text?: string;
    categories?: readonly Category[];
    kinds?: readonly Kind[];
    /** Filter to records flagged 待看 (or explicitly to those not flagged). */
    watchLater?: boolean;
    /** Every listed tag must be present (AND). */
    tags?: readonly string[];
    /** Soft-deleted items are excluded unless this is true. */
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
}
/**
 * Select and order items.
 *
 * Newest first — a vault is read as a timeline far more often than as an
 * alphabetical list. `limit`/`offset` apply after ordering, so paging is stable
 * as long as nothing is written in between.
 *
 * @param items - the candidate records, in any order.
 * @param query - filters, paging and ordering input.
 * @returns the matching records, newest first.
 */
export declare function selectItems(items: readonly Item[], query?: ItemQuery): Item[];
/** Count the records flagged 待看 — the number the sidebar badge would show. */
export declare function countWatchLater(items: readonly Item[]): number;
