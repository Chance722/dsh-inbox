/**
 * The vault's domain declaration: identity, version, layout, and the zod
 * schemas every stored record must satisfy.
 *
 * Layout is `per-record` — one document per item — for two reasons that matter
 * to a personal vault: a write only rewrites the item it touched, and a single
 * damaged document cannot take the whole vault down with it.
 *
 * The default invalid-record behaviour is kept (the whole `open` rejects),
 * because these records are authoritative user data: silently skipping one
 * would hide a real problem. Additive schema changes should extend
 * `compatibleVersions` instead of loosening this.
 */

import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

import {
  CATEGORIES,
  CATEGORY_SOURCES,
  KINDS,
  SOURCES,
} from '../../shared/vocabulary.js'

/** ISO-8601 timestamp. Stored as a string so the medium stays human-readable. */
const timestamp = z.string().min(1)

export const itemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(KINDS),
  category: z.enum(CATEGORIES),
  /**
   * Who decided the category — `user` outranks `model`, which outranks `rule`.
   * Absent on records written before domain version 2.
   */
  categorySource: z.enum(CATEGORY_SOURCES).optional(),
  /**
   * "I want to come back to this" — the only progress flag, and the user's to
   * set. Absent means not flagged, which is where every new record starts.
   *
   * Domain version 3 replaced the old read/unread pair with this: read/unread
   * claimed knowledge the software does not have (nothing here knows whether
   * you *consumed* a link), and it made every capture start as "unread", so the
   * badge counted your own typing back at you.
   */
  watchLater: z.boolean().optional(),
  source: z.enum(SOURCES),
  createdAt: timestamp,
  updatedAt: timestamp,
  /** Link title, or a short label the user gave a text note. */
  title: z.string().optional(),
  /**
   * The headline fetched from the link's own page (`<title>`), never the user's
   * word and never derived from record content.
   *
   * Kept apart from `title` on purpose: `title` is what the person typed, and
   * the credentials rule ("only the user names a record", `AGENTS.md` 3) has to
   * stay true even with an automatic writer in the picture.
   */
  linkTitle: z.string().optional(),
  /** The pasted text itself, for `text` and `secret` records. */
  text: z.string().optional(),
  url: z.string().optional(),
  /** Recognised host platform: bilibili, wechat, zhihu, xiaohongshu, … */
  platform: z.string().optional(),
  /** Description the user appended. When present it is the authoritative label. */
  note: z.string().optional(),
  /** Soft delete marker; a deleted item keeps its bytes and can be restored. */
  deletedAt: z.string().optional(),
  tags: z.array(z.string()),
  attachmentIds: z.array(z.string()),
})

export const attachmentSchema = z.object({
  /**
   * Our own record key. It has to be path-safe (`[a-zA-Z0-9_-]+`) because the
   * per-record backend names a document after it — which is exactly why the
   * store's id below cannot serve as the key.
   */
  id: z.string().min(1),
  /**
   * The owning store's identifier: dsh's attachment id for anything the user
   * pasted. Opaque, and observed in the wild as `sha256:<hex>` — the colon is
   * not path-safe, so it lives here and never in the key.
   */
  storeId: z.string().min(1),
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  createdAt: timestamp,
  filename: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Present when the medium identifies the bytes by digest. */
  sha256: z.string().optional(),
})

/**
 * One global slot per domain. Sync state lives here because it belongs to the
 * vault as a whole, not to any item; M6 fills it in.
 */
export const vaultGlobalSchema = z.object({
  sync: z.object({
    lastPullAt: z.string().optional(),
    cursor: z.string().optional(),
  }),
  /** Today's model-fallback spend, so a restart cannot reset the meter. */
  model: z
    .object({
      day: z.string(),
      calls: z.number().int().nonnegative(),
      tokens: z.number().int().nonnegative(),
      /** Why the last attempt ended the way it did; the only place to look when
       * a category did not change and the log is long gone. */
      last: z.string().optional(),
    })
    .optional(),
})

export type Item = z.infer<typeof itemSchema>
export type Attachment = z.infer<typeof attachmentSchema>
export type VaultGlobal = z.infer<typeof vaultGlobalSchema>

/**
 * Domain name doubles as the backend unit name: `<DSH_HOME>/storages/dsh_inbox/…`.
 * `defineDomain` enforces `/^[a-z][a-z0-9_]*$/` at module load — no hyphens.
 */
export const vaultSpec = defineDomain({
  name: 'dsh_inbox',
  /**
   * Version 2 added the optional `categorySource`; version 3 swaps
   * `status` for `watchLater` and drops the `待看` tag. Both older shapes still
   * validate — the removed `status` key is simply ignored, and `watchLater` is
   * optional — and `Vault.open` rewrites them once so the flag is real.
   *
   * Version 4 adds the optional `linkTitle` (the fetched page headline). It is
   * a pure addition, so every older record still validates unchanged.
   */
  version: 4,
  compatibleVersions: [1, 2, 3],
  layout: 'per-record',
  global: {
    schema: vaultGlobalSchema,
    initial: { sync: {} },
  },
  tables: {
    items: domainTable<string, Item>(itemSchema),
    attachments: domainTable<string, Attachment>(attachmentSchema),
  },
})

export type VaultSpec = typeof vaultSpec
