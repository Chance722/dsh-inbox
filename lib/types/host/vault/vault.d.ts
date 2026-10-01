/**
 * The vault facade: one open domain plus the operations the tools and the panel
 * need. Callers never touch the storage backend directly.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Category, CategorySource, Kind, Source } from '../../shared/vocabulary.js';
import { type ItemQuery } from './query.js';
/** A capture that needs the key while the vault is locked. */
export declare class VaultLockedError extends Error {
    constructor();
}
import { type Attachment, type Item, type VaultGlobal } from './spec.js';
/** Everything a caller supplies when filing something new. */
export interface NewItem {
    kind: Kind;
    category: Category;
    /** Defaults to `rule`: the vault files by rule unless told otherwise. */
    categorySource?: CategorySource;
    source: Source;
    title?: string;
    /** A headline fetched from the link's own page; see `link-title.ts`. */
    linkTitle?: string;
    /** A short code explaining a missed headline fetch (see `link-title.ts`). */
    linkTitleError?: string;
    text?: string;
    /** A sealed credential body, from `sealSecret` (never both with `text`). */
    secret?: string;
    /** The keyed digest that matches a re-paste of the same credential. */
    secretDigest?: string;
    url?: string;
    platform?: string;
    note?: string;
    tags?: readonly string[];
    attachmentIds?: readonly string[];
}
/** Fields a later edit may replace. Classification and the note are the point. */
export interface ItemPatch {
    category?: Category;
    /** Set to `user` when the person editing is the one choosing the category. */
    categorySource?: CategorySource;
    watchLater?: boolean;
    title?: string;
    linkTitle?: string;
    /** A short code explaining a missed headline fetch; empty string clears it. */
    linkTitleError?: string;
    note?: string;
    platform?: string;
    tags?: readonly string[];
    attachmentIds?: readonly string[];
}
/** Where the vault's key state stands, for the panel to show and the tools to check. */
export interface VaultLockState {
    /** A master password exists, so credentials can be sealed at all. */
    configured: boolean;
    /** The key is in memory: credentials can be read and written. */
    unlocked: boolean;
}
export declare class Vault {
    private readonly ctx;
    private readonly domain;
    /** Absolute path of the domain's unit directory, for diagnostics. */
    readonly unit: string;
    private closed;
    /**
     * The derived key, **memory only**.
     *
     * Nothing on disk can be used to read a credential: the master password is
     * never stored, the key is never stored, and a restart therefore locks the
     * vault again. That is the trade the red line asks for ("主密码永不上传"),
     * and it is why the panel has an explicit unlock.
     */
    private key?;
    private constructor();
    /**
     * Open the vault's domain over whatever backend the composition routed it to.
     *
     * @param ctx - host context carrying the storage domain facility.
     * @param unit - unit location, recorded for diagnostics only.
     * @returns the open vault.
     */
    static open(ctx: Context, unit?: string): Promise<Vault>;
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
    private migrateOnce;
    private get items();
    private get attachments();
    private get graves();
    /** Where the key state stands; what the panel shows and the tools consult. */
    get lockState(): VaultLockState;
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
    setMasterPassword(password: string): Promise<number>;
    /**
     * Derive the key from the stored salt and check it against the verifier.
     *
     * @param password - what the user typed.
     * @returns true when the vault is now unlocked.
     */
    unlock(password: string): Promise<boolean>;
    /** Drop the key. Credentials stay on disk, unreadable until the next unlock. */
    lock(): void;
    /**
     * Seal one credential body for storage.
     *
     * @param plaintext - the credential as the user pasted it.
     * @returns the envelope to store, and the keyed digest used for de-duplication.
     */
    sealSecret(plaintext: string): {
        secret: string;
        secretDigest: string;
    };
    /**
     * The plaintext behind a credential, when it can be read.
     *
     * @param item - the record.
     * @returns the plaintext, or undefined while locked.
     */
    secretText(item: Item): string | undefined;
    /**
     * The keyed digest a re-paste is matched against (see `spec.ts`).
     *
     * @param plaintext - the credential as pasted.
     * @returns a hex digest, stable for one vault and useless without its key.
     */
    digestOf(plaintext: string): string;
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
    private sealLegacySecrets;
    /**
     * Re-seal everything that was sealed with the previous key.
     *
     * @param previous - the key in use until a moment ago, if there was one.
     * @returns how many records were re-sealed.
     */
    private resealSecrets;
    /** Total records held, including soft-deleted ones. */
    get size(): number;
    /**
     * File a new item.
     *
     * @param input - the caller-owned fields; id and timestamps are assigned here.
     * @returns the stored record.
     */
    create(input: NewItem): Promise<Item>;
    /** Read one live or soft-deleted record. */
    get(id: string): Item | undefined;
    /** Records sitting in the recycle bin, newest first. */
    getBin(): Item[];
    /**
     * List records matching a query, newest first.
     *
     * @param query - filters and paging.
     * @returns matching records.
     */
    list(query?: ItemQuery): Item[];
    /**
     * Replace editable fields. The atomic read-modify-write keeps concurrent
     * edits from interleaving on the domain's write chain.
     *
     * @param id - record key.
     * @param patch - fields to replace.
     * @returns the stored record.
     */
    patch(id: string, patch: ItemPatch): Promise<Item>;
    /** Flag or unflag a record for later. */
    setWatchLater(id: string, on?: boolean): Promise<Item>;
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
    removeTag(tag: string): Promise<number>;
    /**
     * Soft delete: the record stops appearing in lists but keeps its bytes, so the
     * recycle bin (and restoring) needs no second table.
     */
    softDelete(id: string): Promise<Item>;
    /** Undo a soft delete. */
    restore(id: string): Promise<Item>;
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
    purge(id: string): Promise<boolean>;
    /**
     * When this id was emptied out of the bin, if it ever was.
     *
     * The merge asks this before taking a copy of a record this vault does not
     * have (see `newerThanPurge` in `../remote/merge.ts`).
     */
    purgedAt(id: string): string | undefined;
    /**
     * Record an attachment's metadata. The bytes stay in the store named by
     * `storeId`; this row is our own index over them, keyed by a generated id
     * because store ids are not path-safe.
     */
    addAttachment(input: Omit<Attachment, 'id' | 'createdAt'> & {
        createdAt?: string;
    }): Promise<Attachment>;
    /** Read one attachment record. */
    getAttachment(id: string): Attachment | undefined;
    /** Find our index row for a store-side attachment id, if we have one. */
    findAttachmentByStoreId(storeId: string): Attachment | undefined;
    /** Current sync state; M6 writes it. */
    get global(): VaultGlobal;
    /** Replace the global slot. */
    setGlobal(value: VaultGlobal): Promise<void>;
    /** Record today's model-fallback spend. */
    setModelSpend(spend: NonNullable<VaultGlobal['model']>, last?: string): Promise<void>;
    /** Record where the last WebDAV pull got to. */
    setSync(sync: VaultGlobal['sync']): Promise<void>;
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
    import(item: Item): Promise<Item>;
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
    importAttachment(record: Attachment): Promise<Attachment>;
    /** Release the domain handle. Idempotent. */
    close(): Promise<void>;
}
