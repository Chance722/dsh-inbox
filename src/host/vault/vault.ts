/**
 * The vault facade: one open domain plus the operations the tools and the panel
 * need. Callers never touch the storage backend directly.
 */

import { randomUUID } from 'node:crypto'

import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'

import type {
  Category,
  CategorySource,
  Kind,
  Source,
  Status,
} from '../../shared/vocabulary.js'
import { selectItems, type ItemQuery } from './query.js'
import {
  type Attachment,
  type Item,
  vaultGlobalSchema,
  type VaultGlobal,
  type VaultSpec,
  vaultSpec,
} from './spec.js'

/** Everything a caller supplies when filing something new. */
export interface NewItem {
  kind: Kind
  category: Category
  /** Defaults to `rule`: the vault files by rule unless told otherwise. */
  categorySource?: CategorySource
  source: Source
  title?: string
  text?: string
  url?: string
  platform?: string
  note?: string
  tags?: readonly string[]
  attachmentIds?: readonly string[]
}

/** Fields a later edit may replace. Classification and the note are the point. */
export interface ItemPatch {
  category?: Category
  /** Set to `user` when the person editing is the one choosing the category. */
  categorySource?: CategorySource
  status?: Status
  title?: string
  note?: string
  platform?: string
  tags?: readonly string[]
  attachmentIds?: readonly string[]
}

export class Vault {
  private closed = false

  private constructor(
    private readonly ctx: Context,
    private readonly domain: Domain<VaultSpec>,
    /** Absolute path of the domain's unit directory, for diagnostics. */
    readonly unit: string,
  ) {}

  /**
   * Open the vault's domain over whatever backend the composition routed it to.
   *
   * @param ctx - host context carrying the storage domain facility.
   * @param unit - unit location, recorded for diagnostics only.
   * @returns the open vault.
   */
  static async open(ctx: Context, unit = ''): Promise<Vault> {
    const domain = await ctx.storageDomain.open(vaultSpec)
    return new Vault(ctx, domain, unit)
  }

  private get items() {
    return this.domain.table('items')
  }

  private get attachments() {
    return this.domain.table('attachments')
  }

  /** Total records held, including soft-deleted ones. */
  get size(): number {
    return this.items.size
  }

  /**
   * File a new item.
   *
   * @param input - the caller-owned fields; id and timestamps are assigned here.
   * @returns the stored record.
   */
  async create(input: NewItem): Promise<Item> {
    const now = new Date().toISOString()
    const item: Item = {
      id: randomUUID(),
      kind: input.kind,
      category: input.category,
      categorySource: input.categorySource ?? 'rule',
      status: 'unread',
      source: input.source,
      createdAt: now,
      updatedAt: now,
      tags: [...(input.tags ?? [])],
      attachmentIds: [...(input.attachmentIds ?? [])],
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.text === undefined ? {} : { text: input.text }),
      ...(input.url === undefined ? {} : { url: input.url }),
      ...(input.platform === undefined ? {} : { platform: input.platform }),
      ...(input.note === undefined ? {} : { note: input.note }),
    }
    await this.items.put(item.id, item)
    return item
  }

  /** Read one live or soft-deleted record. */
  get(id: string): Item | undefined {
    return this.items.get(id)
  }

  /** Records sitting in the recycle bin, newest first. */
  getBin(): Item[] {
    return this.list({ includeDeleted: true }).filter((item) => item.deletedAt !== undefined)
  }

  /**
   * List records matching a query, newest first.
   *
   * @param query - filters and paging.
   * @returns matching records.
   */
  list(query: ItemQuery = {}): Item[] {
    return selectItems([...this.items.entries()].map(([, item]) => item), query)
  }

  /**
   * Replace editable fields. The atomic read-modify-write keeps concurrent
   * edits from interleaving on the domain's write chain.
   *
   * @param id - record key.
   * @param patch - fields to replace.
   * @returns the stored record.
   */
  async patch(id: string, patch: ItemPatch): Promise<Item> {
    return this.items.update(id, (current) => {
      const next: Item = { ...current, updatedAt: new Date().toISOString() }
      if (patch.category !== undefined) next.category = patch.category
      if (patch.categorySource !== undefined) next.categorySource = patch.categorySource
      if (patch.status !== undefined) next.status = patch.status
      if (patch.title !== undefined) next.title = patch.title
      if (patch.note !== undefined) next.note = patch.note
      if (patch.platform !== undefined) next.platform = patch.platform
      if (patch.tags !== undefined) next.tags = [...patch.tags]
      if (patch.attachmentIds !== undefined) next.attachmentIds = [...patch.attachmentIds]
      return next
    })
  }

  /** Mark read/unread. */
  async setRead(id: string, read = true): Promise<Item> {
    return this.patch(id, { status: read ? 'read' : 'unread' })
  }

  /**
   * Soft delete: the record stops appearing in lists but keeps its bytes, so the
   * recycle bin (and restoring) needs no second table.
   */
  async softDelete(id: string): Promise<Item> {
    return this.items.update(id, (current) => ({
      ...current,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }

  /** Undo a soft delete. */
  async restore(id: string): Promise<Item> {
    return this.items.update(id, (current) => {
      const { deletedAt: _dropped, ...rest } = current
      return { ...rest, updatedAt: new Date().toISOString() }
    })
  }

  /**
   * Delete one record for good, together with its attachment rows.
   *
   * The bytes behind an attachment live in dsh's own store, which never deletes
   * automatically — emptying the recycle bin drops our references, not their
   * objects. A row another record still references is left alone.
   *
   * @param id - record key.
   * @returns whether the record existed.
   */
  async remove(id: string): Promise<boolean> {
    const item = this.items.get(id)
    if (item === undefined) return false

    const stillReferenced = new Set<string>()
    for (const [, other] of this.items.entries()) {
      if (other.id === id) continue
      for (const attachmentId of other.attachmentIds) stillReferenced.add(attachmentId)
    }
    for (const attachmentId of item.attachmentIds) {
      if (!stillReferenced.has(attachmentId)) await this.attachments.delete(attachmentId)
    }
    return this.items.delete(id)
  }

  /**
   * Record an attachment's metadata. The bytes stay in the store named by
   * `storeId`; this row is our own index over them, keyed by a generated id
   * because store ids are not path-safe.
   */
  async addAttachment(
    input: Omit<Attachment, 'id' | 'createdAt'> & { createdAt?: string },
  ): Promise<Attachment> {
    const record: Attachment = {
      ...input,
      id: randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
    await this.attachments.put(record.id, record)
    return record
  }

  /** Read one attachment record. */
  getAttachment(id: string): Attachment | undefined {
    return this.attachments.get(id)
  }

  /** Find our index row for a store-side attachment id, if we have one. */
  findAttachmentByStoreId(storeId: string): Attachment | undefined {
    for (const [, record] of this.attachments.entries()) {
      if (record.storeId === storeId) return record
    }
    return undefined
  }

  /** Current sync state; M6 writes it. */
  get global(): VaultGlobal {
    return this.domain.global.get() as VaultGlobal
  }

  /** Replace the global slot. */
  async setGlobal(value: VaultGlobal): Promise<void> {
    await this.domain.global.set(vaultGlobalSchema.parse(value))
  }

  /** Release the domain handle. Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.domain.close()
  }
}
