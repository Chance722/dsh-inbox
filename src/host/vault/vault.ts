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
    super('仓库锁着（或还没设主密码）：账密类内容要先在「设置 → 账密加密」里解锁才能存')
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
  type MasterParams,
  attachmentSchema,
  itemSchema,
  masterSchema,
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
  /**
   * Sealed credential bodies this vault holds, including tombstones.
   *
   * Non-zero while `configured` is false is the state a **second** machine lands
   * in after pulling another machine's records: the ciphertext arrived without
   * the parameters that turn a password into its key. It is not "no password
   * yet" — there is nothing here a fresh password could ever open — and the
   * panel says so instead of offering to set one (measured 2026-10-01: the
   * panel said 「还没设主密码」, the button answered 「仓库里已有 7 条密文…」, and
   * the user had no way forward).
   */
  sealedRecords: number
  /**
   * Sealed records **no key in memory can open**, counted only while a key is
   * held.
   *
   * What this means in practice: the records another machine sealed with a
   * password this one has not been given yet. Zero while the vault is locked
   * (everything is unreadable then, which the panel says with 「已锁定」), and
   * zero once the right password has been typed — so the number is exactly
   * "what is still waiting for a password", which is the only question the panel
   * cannot answer any other way.
   */
  unreadable: number
  /** Parameter sets from other machines this vault has taken in. */
  otherMachines: number
}

export class Vault {
  private closed = false

  /**
   * The derived keys, **memory only**, keyed by the salt each was derived with.
   *
   * Nothing on disk can be used to read a credential: no password is stored, no
   * key is stored, and a restart therefore locks the vault again. That is the
   * trade the red line asks for ("主密码永不上传"), and it is why the panel has
   * an explicit unlock.
   *
   * A machine that syncs holds **more than one** key while it is unlocked — its
   * own password's and the other machine's — because the parameters travel and
   * the passwords do not. Each record is then readable by whoever knows the
   * password that sealed it, which is the whole design (2026-10-02).
   */
  private readonly keys = new Map<string, Buffer>()

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

  private get graves() {
    return this.domain.table('graves')
  }

  /** Where the key state stands; what the panel shows and the tools consult. */
  get lockState(): VaultLockState {
    return {
      configured: this.global.master !== undefined,
      unlocked: this.keys.size > 0,
      sealedRecords: this.sealedRecords,
      unreadable: this.keys.size === 0 ? 0 : this.unreadableSealed(),
      otherMachines: this.otherParamSets().length,
    }
  }

  /**
   * Parameter sets from other machines, minus anything that is really this one's.
   *
   * Filtered on the salt rather than trusted as given: the same machine showing
   * up twice would just mean deriving the same key twice.
   */
  private otherParamSets(): MasterParams[] {
    const own = this.global.master
    return (this.global.masterOthers ?? []).filter((other) => other.salt !== own?.salt)
  }

  /** Every parameter set this vault recognises: its own first, then other machines'. */
  private get paramSets(): MasterParams[] {
    const own = this.global.master
    return own === undefined ? this.otherParamSets() : [own, ...this.otherParamSets()]
  }

  /**
   * The key new credentials are sealed with.
   *
   * This machine's own when it is held (that is what "my password" means), and
   * otherwise whichever one the user did unlock with — sealing with a key whose
   * parameters this vault knows is always recoverable, because those parameters
   * are on disk and the same password derives the same key again.
   */
  private get key(): Buffer | undefined {
    const own = this.global.master
    const mine = own === undefined ? undefined : this.keys.get(own.salt)
    return mine ?? this.keys.values().next().value
  }

  /** The keys to try against one record, this machine's own first. */
  private heldKeys(): Buffer[] {
    const held: Buffer[] = []
    for (const params of this.paramSets) {
      const key = this.keys.get(params.salt)
      if (key !== undefined) held.push(key)
    }
    return held
  }

  /** This machine's own key — the one the local master password derives. */
  private localKey(): Buffer | undefined {
    const own = this.global.master
    return own === undefined ? undefined : this.keys.get(own.salt)
  }

  /** Sealed records no held key can open. */
  private unreadableSealed(): number {
    let count = 0
    for (const [, item] of this.items.entries()) {
      if (item.secret !== undefined && this.secretText(item) === undefined) count += 1
    }
    return count
  }

  /** Credential bodies that need the key, tombstones included. */
  get sealedRecords(): number {
    let count = 0
    for (const [, item] of this.items.entries()) {
      if (item.secret !== undefined) count += 1
    }
    return count
  }

  /**
   * The parameters that recognise the master password, when one has been set.
   *
   * Read by the push, which publishes them so another machine can open what it
   * pulled (`../remote/push.ts`).
   */
  get master(): MasterParams | undefined {
    return this.global.master
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

      "The old key" means **this machine's own**, not any key in memory: another
      machine's records are sealed with a password this machine may well hold for
      reading, and re-sealing those would take them away from the machine that
      owns them (asked 2026-10-02: each password opens its own records).
    */
    const sealedAlready = [...this.items.entries()].filter(([, item]) => item.secret !== undefined)
    const previous = this.localKey()
    if (sealedAlready.length > 0 && previous === undefined) {
      const count = String(sealedAlready.length)
      throw new Error(
        this.global.master === undefined
          ? `仓库里已有 ${count} 条密文，但本机没有解开它们的主密码参数：先点一次「同步」把参数拉回来，` +
              '再用原来那台机器的主密码解锁，之后才能换密码'
          : `仓库里已有 ${count} 条密文，本机现在锁着：先用本机现在的主密码解锁，` +
              '才能把它们改封成新密码（否则它们会再也打不开）',
      )
    }

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
    this.keys.set(salt.toString('base64'), key)
    return (await this.resealSecrets(previous)) + (await this.sealLegacySecrets())
  }

  /**
   * Take over another machine's key parameters.
   *
   * The half of sync that turns "the bytes arrived" into "the password you
   * already know opens them" (see `../remote/merge.ts`). Nothing here can read
   * the records: the parameters say *how* to derive the key, the password is
   * still what derives it, so the vault stays locked until someone types it.
   *
   * Refused when this machine already has parameters of its own — those seal
   * local records, and silently swapping them would make the local records
   * unreadable in exchange for the remote ones.
   *
   * @param master - the parameters the remote published, already parsed.
   * @returns whether they were taken.
   */
  async adoptMaster(master: MasterParams): Promise<boolean> {
    if (this.global.master !== undefined) return false
    await this.setGlobal({ ...this.global, master: masterSchema.parse(master) })
    return true
  }

  /**
   * Remember another machine's parameters, keeping this machine's own.
   *
   * The other half of adopting: when both machines set a password of their own,
   * neither one's parameters may win — records on both sides must stay readable
   * with the password that sealed them, and typing that password here has to be
   * possible (`unlock` derives against every known set). Nothing is unlocked by
   * this call, and nothing already readable changes.
   *
   * @param master - the parameters the remote published, already parsed.
   * @returns whether they were new.
   */
  async adoptOtherMaster(master: MasterParams): Promise<boolean> {
    const parsed = masterSchema.parse(master)
    const own = this.global.master
    if (own !== undefined && own.salt === parsed.salt) return false
    const others = this.global.masterOthers ?? []
    if (others.some((other) => other.salt === parsed.salt)) return false
    await this.setGlobal({ ...this.global, masterOthers: [...others, parsed] })
    return true
  }

  /**
   * Derive the key from the stored salt and check it against the verifier.
   *
   * **Every** parameter set is tried, this machine's own first, and every one
   * whose verifier opens is kept. That is what makes "type the other machine's
   * password" work without giving up your own: two passwords, two keys, and each
   * record readable by the one that sealed it. A password both machines share
   * opens both sets in this single call, which is why the shared-password case
   * needs nothing special.
   *
   * @param password - what the user typed.
   * @returns true when the password matched at least one known set.
   */
  async unlock(password: string): Promise<boolean> {
    let matched = false
    for (const params of this.paramSets) {
      const key = deriveKey(password, Buffer.from(params.salt, 'base64'), params.kdf)
      if (open(key, params.verifier) !== VERIFIER_PLAINTEXT) continue
      this.keys.set(params.salt, key)
      matched = true
    }
    if (!matched) return false
    await this.sealLegacySecrets()
    return true
  }

  /** Drop the key. Credentials stay on disk, unreadable until the next unlock. */
  lock(): void {
    this.keys.clear()
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
    for (const key of this.heldKeys()) {
      const plaintext = open(key, item.secret)
      if (plaintext !== undefined) return plaintext
    }
    return undefined
  }

  /**
   * Every digest the same plaintext would have under any held key.
   *
   * De-duplication reads a record's `secretDigest`, and that digest was made with
   * whichever key sealed it — so a credential pasted on this machine must be
   * recognised even when the copy already here came from the other one.
   *
   * @param plaintext - the credential as pasted.
   * @returns the digests to match against, empty while nothing is held.
   */
  secretDigests(plaintext: string): string[] {
    return this.heldKeys().map((key) => createHmac('sha256', key).update(plaintext).digest('hex'))
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
   * Delete one record for good, together with its attachment rows, and leave a
   * grave behind so nothing that is still in the cloud can file it again.
   *
   * The bytes behind an attachment live in dsh's own store, which never deletes
   * automatically — emptying the recycle bin drops our references, not their
   * objects. A row another record still references is left alone.
   *
   * The grave is the other half of that sentence, and it is why this is not
   * called `remove` any more: deleting the row really does take this machine's
   * copy away, but a copy under a *different* `sync/` tree in the same bucket
   * survives the purge of our own tree (`../remote/remove.ts` only ever deletes
   * under this vault's root), and the merge has no local row to outrank it with.
   * Measured 2026-09-21: thirteen emptied tombstones came back into the bin on
   * every `dsh` restart. The grave is what makes "gone" stick; it holds the id
   * and the moment, no content.
   *
   * @param id - record key.
   * @returns whether the record existed.
   */
  async purge(id: string): Promise<boolean> {
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
    await this.items.delete(id)
    await this.graves.put(id, { id, purgedAt: new Date().toISOString() })
    return true
  }

  /**
   * When this id was emptied out of the bin, if it ever was.
   *
   * The merge asks this before taking a copy of a record this vault does not
   * have (see `newerThanPurge` in `../remote/merge.ts`).
   */
  purgedAt(id: string): string | undefined {
    return this.graves.get(id)?.purgedAt
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

  /**
   * Write a record exactly as another device had it.
   *
   * The merge's only write, and deliberately not `create`: an imported record
   * keeps the id other devices already know, the `createdAt` it was made with and
   * the `updatedAt` the conflict was settled on. Re-stamping any of them would
   * make the next pull decide the other way and bounce the record back and forth.
   *
   * @param item - the record, already validated by the merge's own parse.
   * @returns the stored record.
   */
  async import(item: Item): Promise<Item> {
    /*
      Validated *here*, with the same schema the domain reads with.

      A record that fails validation does not fail one read — it stops the whole
      vault from opening ("bad records fail open" is deliberate). So an import
      that trusts the remote's word is a way to wedge the vault from the cloud:
      this is exactly what happened when a pushed attachment row forgot a field.
      The parse throws, the merge reports one line, and the vault still opens.
    */
    const parsed = itemSchema.parse(item) as Item
    await this.items.put(parsed.id, parsed)
    return parsed
  }

  /**
   * The same for one attachment's row.
   *
   * `storeId` is the *local* store's id for the bytes the merge just admitted;
   * everything else — our row id in particular — travels with the object so the
   * record's `attachmentIds` still point at something.
   *
   * @param record - the row, with a local `storeId`.
   * @returns the stored row.
   */
  async importAttachment(record: Attachment): Promise<Attachment> {
    // `createdAt` defaults rather than throws: a row that arrived without one is
    // reconstructable (the bytes and their type are what matter), while a row
    // without `mime` is not — and the schema is what tells the two apart.
    const parsed = attachmentSchema.parse(
      Object.assign({ createdAt: new Date().toISOString() }, record),
    ) as Attachment
    await this.attachments.put(parsed.id, parsed)
    return parsed
  }

  /** Release the domain handle. Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.domain.close()
  }
}
