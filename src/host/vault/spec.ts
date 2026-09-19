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

import { CATEGORIES, KINDS, SOURCES, STATUSES } from '../../shared/vocabulary.js'

/** ISO-8601 timestamp. Stored as a string so the medium stays human-readable. */
const timestamp = z.string().min(1)

export const itemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(KINDS),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES),
  source: z.enum(SOURCES),
  createdAt: timestamp,
  updatedAt: timestamp,
  /** Link title, or a short label the user gave a text note. */
  title: z.string().optional(),
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
  id: z.string().min(1),
  /** Content hash; identical bytes are stored once. */
  sha256: z.string().min(1),
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  createdAt: timestamp,
  filename: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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
  version: 1,
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
