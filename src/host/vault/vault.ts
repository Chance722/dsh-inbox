/**
 * The vault facade: one open domain plus the operations the tools and the panel
 * need. Callers never touch the storage backend directly.
 */

import { createHmac, randomUUID } from 'node:crypto'

import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'

import type { Category, CategorySource, Kind, Source } from '../../shared/vocabulary.js'
import { selectItems, type ItemQuery } from './query.js'
import { DEFAULT_KDF, deriveKey, newSalt, open, seal, type KdfParams } from '../crypto/secret-box.js'

/**
 * The one plaintext the verifier seals. Opening it with a candidate key is how
 * "is this the right master password" gets answered without storing a hash of
 * the password itself.
 */
const VERIFIER_PLAINTEXT = 'dsh-inbox master password check'

/** A capture that needs the key while the vault is locked. */
export class VaultLockedError extends Error {
  constructor() {
    super('仓库锁着（或还没设主密码）：账密类内容要先在「入库设置 → 账密加密」里解锁才能存')
    this.name = 'VaultLockedError'
  }
}
/**
 * The tag version 1/2 used to carry "not consumed yet". The flag replaced it,
 * so the migration strips it rather than leaving two ways to say one thing.
 */
const RETIRED_TAG = '待看'
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
  /** A headline fetched from the link's own page; see `link-title.ts`. */
  linkTitle?: string
  /** A short code explaining a missed headline fetch (see `link-title.ts`). */
  linkTitleError?: string
  text?: string
  /** A sealed credential body, from `sealSecret` (never both with `text`). */
  secret?: string
  /** The keyed digest that matches a re-paste of the same credential. */
  secretDigest?: string
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
  watchLater?: boolean
  title?: string
  linkTitle?: string
  /** A short code explaining a missed headline fetch; empty string clears it. */
  linkTitleError?: string
  note?: string
  platform?: string
  tags?: readonly string[]
  attachmentIds?: readonly string[]
}

/** Where the vault's key state stands, for the panel to show and the tools to check. */
export interface VaultLockState {
  /** A master password exists, so credentials can be sealed at all. */
  configured: boolean
  /** The key is in memory: credentials can be read and written. */
  unlocked: boolean
}

export class Vault {
  private closed = false

  /**
   * The derived key, **memory only**.
   *
   * Nothing on disk can be used to read a credential: the master password is
   * never stored, the key is never stored, and a restart therefore locks the
   * vault again. That is the trade the red line asks for ("主密码永不上传"),
   * and it is why the panel has an explicit unlock.
   */
  private key?: Buffer

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
    const vault = new Vault(ctx, domain, unit)
    await vault.migrateOnce()
    return vault
  }

  /**
   * Bring records written by version 1/2 into the version-3 shape: strip the
   * `待看` tag, because the flag now says the same thing.
   *
   * The old read/unread pair is **not** converted, on purpose. 待看 is the
   * user's own mark, and back-filling it would have flagged twelve records on
   * their behalf at first launch.
   *
   * (A note for whoever reads this next: you cannot even see the old `status`
   * from here. The domain validates on read and zod drops unknown keys, so by
   * the time a record reaches this loop the field is gone — measured, after the
   * first version of this migration silently converted nothing and the rail
   * read 「待看 0」.)
   */
  private async migrateOnce(): Promise<void> {
    for (const [key, stored] of this.items.entries()) {
      if (!stored.tags.includes(RETIRED_TAG)) continue
      await this.items.put(key, {
        ...stored,
        tags: stored.tags.filter((tag) => tag !== RETIRED_TAG),
      })
    }
  }

  private get items() {
    return this.domain.table('items')
  }

  private get attachments() {
    return this.domain.table('attachments')
  }

  /** Where the key state stands; what the panel shows and the tools consult. */
  get lockState(): VaultLockState {
    return { configured: this.global.master !== undefined, unlocked: this.key !== undefined }
  }

  /**
   * Set (or replace) the master password, and seal everything that needs it.
   *
   * Replacing it is allowed on purpose: a user who wrote the password down
   * badly, or wants a stronger one, must be able to fix that. Records sealed
   * with the *old* password are re-sealed with the new key, which is why the
   * old password has to be supplied again in the panel.
   *
   * @param password - the new master password, never stored anywhere.
   * @returns how many records were sealed in the process.
   */
  async setMasterPassword(password: string): Promise<number> {
    /*
      Changing the password means re-sealing what the old one sealed, so the old
      key has to be in hand. Refusing here (rather than quietly leaving those
      records sealed with a password nobody has any more) is the difference
      between an inconvenience and losing a credential forever.
    */
    const sealedAlready = [...this.items.entries()].filter(([, item]) => item.secret !== undefined)
    if (sealedAlready.length > 0 && this.key === undefined) {
      throw new Error(
        `仓库里已有 ${String(sealedAlready.length)} 条密文，但现在是锁定状态：先用现有主密码解锁，再更换主密码`,
      )
    }

    const previous = this.key
    const salt = newSalt()
    const kdf: KdfParams = DEFAULT_KDF
    const key = deriveKey(password, salt, kdf)
    await this.setGlobal({
      ...this.global,
      master: {
        version: 1,
        salt: salt.toString('base64'),
        kdf,
        verifier: seal(key, VERIFIER_PLAINTEXT),
      },
    })
    this.key = key
    return (await this.resealSecrets(previous)) + (await this.sealLegacySecrets())
  }

  /**
   * Derive the key from the stored salt and check it against the verifier.
   *
   * @param password - what the user typed.
   * @returns true when the vault is now unlocked.
   */
  async unlock(password: string): Promise<boolean> {
    const master = this.global.master
    if (master === undefined) return false
    const key = deriveKey(password, Buffer.from(master.salt, 'base64'), master.kdf)
    if (open(key, master.verifier) !== VERIFIER_PLAINTEXT) return false
    this.key = key
    await this.sealLegacySecrets()
    return true
  }

  /** Drop the key. Credentials stay on disk, unreadable until the next unlock. */
  lock(): void {
    this.key = undefined
  }

  /**
   * Seal one credential body for storage.
   *
   * @param plaintext - the credential as the user pasted it.
   * @returns the envelope to store, and the keyed digest used for de-duplication.
   */
  sealSecret(plaintext: string): { secret: string; secretDigest: string } {
    const key = this.key
    if (key === undefined) throw new VaultLockedError()
    return { secret: seal(key, plaintext), secretDigest: this.digestOf(plaintext) }
  }

  /**
   * The plaintext behind a credential, when it can be read.
   *
   * @param item - the record.
   * @returns the plaintext, or undefined while locked.
   */
  secretText(item: Item): string | undefined {
    if (item.secret === undefined) return undefined
    return this.key === undefined ? undefined : open(this.key, item.secret)
  }

  /**
   * The keyed digest a re-paste is matched against (see `spec.ts`).
   *
   * @param plaintext - the credential as pasted.
   * @returns a hex digest, stable for one vault and useless without its key.
   */
  digestOf(plaintext: string): string {
    const key = this.key
    if (key === undefined) throw new VaultLockedError()
    return createHmac('sha256', key).update(plaintext).digest('hex')
  }

  /**
   * Move credentials that are still sitting in `text` into the sealed field.
   *
   * Version-5 vaults kept a credential's body in plain text — that is what this
   * whole change is about — so the first unlock rewrites them. A record that is
   * not a `secret` is left alone, even if it looks like one: the category is the
   * user's own statement about what a record is.
   *
   * @returns how many records were sealed.
   */
  private async sealLegacySecrets(): Promise<number> {
    let sealed = 0
    for (const [id, item] of this.items.entries()) {
      if (item.category !== 'secret' || item.text === undefined) continue
      const { secret, secretDigest } = this.sealSecret(item.text)
      const { text: _dropped, ...rest } = item
      await this.items.put(id, { ...rest, secret, secretDigest })
      sealed += 1
    }
    return sealed
  }

  /**
   * Re-seal everything that was sealed with the previous key.
   *
   * @param previous - the key in use until a moment ago, if there was one.
   * @returns how many records were re-sealed.
   */
  private async resealSecrets(previous: Buffer | undefined): Promise<number> {
    if (previous === undefined) return 0
    let resealed = 0
    for (const [id, item] of this.items.entries()) {
      if (item.secret === undefined) continue
      const plaintext = open(previous, item.secret)
      if (plaintext === undefined) continue
      const { secret, secretDigest } = this.sealSecret(plaintext)
      await this.items.put(id, { ...item, secret, secretDigest })
      resealed += 1
    }
    return resealed
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
      source: input.source,
      createdAt: now,
      updatedAt: now,
      tags: [...(input.tags ?? [])],
      attachmentIds: [...(input.attachmentIds ?? [])],
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.linkTitle === undefined ? {} : { linkTitle: input.linkTitle }),
      ...(input.linkTitleError === undefined ? {} : { linkTitleError: input.linkTitleError }),
      ...(input.text === undefined ? {} : { text: input.text }),
      ...(input.secret === undefined ? {} : { secret: input.secret }),
      ...(input.secretDigest === undefined ? {} : { secretDigest: input.secretDigest }),
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
      if (patch.watchLater !== undefined) {
        if (patch.watchLater) next.watchLater = true
        else delete next.watchLater
      }
      /*
        An empty title means "no title", not a title that happens to be blank.

        The panel's name field clears by emptying, and a stored empty string
        would win the heading chain in `src/client/heading.ts` (`?? ` only skips
        `undefined`) — the row would go blank instead of falling back to the
        file name it came with.
      */
      if (patch.title !== undefined) {
        if (patch.title.trim().length === 0) delete next.title
        else next.title = patch.title
      }
      if (patch.linkTitle !== undefined) next.linkTitle = patch.linkTitle
      if (patch.linkTitleError !== undefined) {
        if (patch.linkTitleError.length === 0) delete next.linkTitleError
        else next.linkTitleError = patch.linkTitleError
      }
      if (patch.note !== undefined) next.note = patch.note
      if (patch.platform !== undefined) next.platform = patch.platform
      if (patch.tags !== undefined) next.tags = [...patch.tags]
      if (patch.attachmentIds !== undefined) next.attachmentIds = [...patch.attachmentIds]
      return next
    })
  }

  /** Flag or unflag a record for later. */
  async setWatchLater(id: string, on = true): Promise<Item> {
    return this.patch(id, { watchLater: on })
  }

  /**
   * Strip one tag from every record that carries it.
   *
   * A tag is not an entity here — it is a word on a record — so "delete this
   * tag" can only mean "take this word off everything". Returns how many
   * records changed, so the panel can say so instead of guessing.
   *
   * @param tag - the exact tag to remove.
   * @returns the number of records that carried it.
   */
  async removeTag(tag: string): Promise<number> {
    const touched = [...this.items.entries()].filter(([, item]) => item.tags.includes(tag))
    for (const [key, item] of touched) {
      await this.items.put(key, { ...item, tags: item.tags.filter((value) => value !== tag) })
    }
    return touched.length
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

  /** Record today's model-fallback spend. */
  async setModelSpend(
    spend: NonNullable<VaultGlobal['model']>,
    last?: string,
  ): Promise<void> {
    await this.setGlobal({ ...this.global, model: { ...spend, ...(last === undefined ? {} : { last }) } })
  }

  /** Record where the last WebDAV pull got to. */
  async setSync(sync: VaultGlobal['sync']): Promise<void> {
    await this.setGlobal({ ...this.global, sync })
  }

  /** Release the domain handle. Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.domain.close()
  }
}
