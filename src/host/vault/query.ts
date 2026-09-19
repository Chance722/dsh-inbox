/**
 * Pure filtering over items.
 *
 * The official storage form is a key-value domain with no query language, so
 * selection is an in-memory pass. At this vault's scale (thousands of records)
 * that is the right trade: no index to build, no migration to run, and the
 * whole rule set is testable without any storage at all.
 */

import type { Category, Kind } from '../../shared/vocabulary.js'
import type { Item } from './spec.js'

export interface ItemQuery {
  /** Case-insensitive substring match over title, text, url, note and tags. */
  text?: string
  categories?: readonly Category[]
  kinds?: readonly Kind[]
  /** Filter to records flagged 待看 (or explicitly to those not flagged). */
  watchLater?: boolean
  /** Every listed tag must be present (AND). */
  tags?: readonly string[]
  /** Soft-deleted items are excluded unless this is true. */
  includeDeleted?: boolean
  limit?: number
  offset?: number
}

/** The searchable text of one item, lowercased once per call. */
function haystack(item: Item): string {
  return [item.title, item.text, item.url, item.note, ...item.tags]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n')
    .toLowerCase()
}

function matches(item: Item, query: ItemQuery, needle: string): boolean {
  if (item.deletedAt !== undefined && query.includeDeleted !== true) return false
  if (query.categories !== undefined && !query.categories.includes(item.category)) return false
  if (query.kinds !== undefined && !query.kinds.includes(item.kind)) return false
  if (query.watchLater !== undefined && (item.watchLater === true) !== query.watchLater) return false
  if (query.tags !== undefined) {
    for (const tag of query.tags) {
      if (!item.tags.includes(tag)) return false
    }
  }
  if (needle.length > 0 && !haystack(item).includes(needle)) return false
  return true
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
export function selectItems(items: readonly Item[], query: ItemQuery = {}): Item[] {
  const needle = query.text?.trim().toLowerCase() ?? ''
  const matched = items.filter((item) => matches(item, query, needle))

  matched.sort((left, right) => {
    if (left.createdAt === right.createdAt) return left.id < right.id ? 1 : -1
    return left.createdAt < right.createdAt ? 1 : -1
  })

  const offset = query.offset ?? 0
  if (query.limit === undefined) return offset === 0 ? matched : matched.slice(offset)
  return matched.slice(offset, offset + query.limit)
}

/** Count the records flagged 待看 — the number the sidebar badge would show. */
export function countWatchLater(items: readonly Item[]): number {
  return items.filter((item) => item.deletedAt === undefined && item.watchLater === true).length
}
