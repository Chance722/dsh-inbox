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
  /**
   * Why the last headline fetch did not produce a `linkTitle`.
   *
   * A short code, not a sentence: the panel turns it into a hint ("那个站点要求
   * 验证"), and the point of storing it at all is that a *silent* miss is
   * indistinguishable from a broken feature. Cleared when a headline does arrive.
   */
  linkTitleError: z.string().optional(),
  /** The pasted text itself, for `text` and `secret` records. */
  text: z.string().optional(),
  /**
   * A credential's text, sealed with the master password (`crypto/secret-box.ts`).
   *
   * Its own field for one reason: `text` is what the panel shows and what the
   * search reads, and a credential's body must reach neither in the clear. A
   * sealed record has `secret` and **no** `text` — the migration moves them.
   */
  secret: z.string().optional(),
  /**
   * A keyed digest of a credential's plaintext, so a re-paste can be recognised
   * as the same credential without keeping the plaintext around to compare.
   *
   * Useless to an attacker without the master key, which is the point: it
   * survives on disk (and, later, in the sync package) while the secret does not.
   */
  secretDigest: z.string().optional(),
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
 * One grave: the id the user emptied out of the recycle bin, and when.
 *
 * Emptying the bin is not "deleted" — it is *gone*, and a copy of the record
 * living somewhere else (another `sync/` tree in the same bucket, a device that
 * has not pulled the tombstone yet) must not be able to file it back in.
 * `updatedAt` cannot express that on its own: the merge compares the incoming
 * copy against the local one, and after a purge there is no local row at all,
 * so any copy won. That is measured, not theoretical — thirteen tombstones came
 * back into the bin on every restart (2026-09-21).
 *
 * It carries an id and a time and nothing else: no text, no note, no
 * attachment. What the row buys is the one comparison the merge needs — a copy
 * **at or before** this moment is dead, a copy strictly newer still wins, the
 * same way it does for a record that was never deleted.
 */
export const graveSchema = z.object({
  /** The record's own key, repeated inside the document (see `attachments`). */
  id: z.string().min(1),
  /** When the user emptied it out of the bin. */
  purgedAt: timestamp,
})

/**
 * One global slot per domain. Sync state lives here because it belongs to the
 * vault as a whole, not to any item; M6 fills it in.
 */
export const vaultGlobalSchema = z.object({
  sync: z.object({
    lastPullAt: z.string().optional(),
    /** When this machine last wrote its own records up; the push cursor. */
    lastPushAt: z.string().optional(),
    cursor: z.string().optional(),
  }),
  /**
   * How to recognise a master password, and nothing more.
   *
   * The salt and work factors are not secret; the `verifier` is a sealed
   * constant, so a wrong password fails the same way a tampered envelope does.
   * The password itself is never written anywhere, and neither is the derived
   * key — that lives in memory for as long as the process does.
   */
  master: z
    .object({
      version: z.number().int().positive(),
      salt: z.string(),
      kdf: z.object({ n: z.number().int().positive(), r: z.number().int().positive(), p: z.number().int().positive() }),
      verifier: z.string(),
    })
    .optional(),
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
export type Grave = z.infer<typeof graveSchema>
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
   * Version 4 adds the optional `linkTitle` (the fetched page headline), version
   * 5 the optional `linkTitleError` that explains a miss. Both are pure
   * additions, so every older record still validates unchanged.
   *
   * Version 6 adds the optional `secret` / `secretDigest`: a credential's text
   * moves out of `text` and into a sealed envelope. Also a pure addition — a
   * version-5 record with plaintext simply gets migrated on the next unlock.
   *
   * Version 7 adds `sync.lastPushAt`: the cursor that keeps a push to "what
   * changed since last time" instead of re-uploading the vault on every pass.
   * A `global` field, so no record shape changes at all.
   *
   * Version 8 adds the `graves` table: one row per record the user emptied out
   * of the bin. A purge leaves no local row, so the merge had nothing to
   * outrank the cloud's copy with — with 「同时合并别的同步目录」 on, the older
   * tree in the same bucket filed all thirteen of them back into the bin on
   * every restart (measured 2026-09-21). A new table, so no record shape
   * changes; an older vault simply has no graves, and there is nothing to
   * protect until the next purge.
   */
  version: 8,
  compatibleVersions: [1, 2, 3, 4, 5, 6, 7],
  layout: 'per-record',
  global: {
    schema: vaultGlobalSchema,
    initial: { sync: {} },
  },
  tables: {
    items: domainTable<string, Item>(itemSchema),
    attachments: domainTable<string, Attachment>(attachmentSchema),
    graves: domainTable<string, Grave>(graveSchema),
  },
})

export type VaultSpec = typeof vaultSpec
