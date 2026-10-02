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
import { type Attachment, type Item, type MasterParams, type VaultGlobal } from './spec.js';
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
    sealedRecords: number;
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
    unreadable: number;
    /** Parameter sets from other machines this vault has taken in. */
    otherMachines: number;
}
export declare class Vault {
    private readonly ctx;
    private readonly domain;
    /** Absolute path of the domain's unit directory, for diagnostics. */
    readonly unit: string;
    private closed;
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
    private readonly keys;
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
     * Parameter sets from other machines, minus anything that is really this one's.
     *
     * Filtered on the salt rather than trusted as given: the same machine showing
     * up twice would just mean deriving the same key twice.
     */
    private otherParamSets;
    /** Every parameter set this vault recognises: its own first, then other machines'. */
    private get paramSets();
    /**
     * The key new credentials are sealed with.
     *
     * This machine's own when it is held (that is what "my password" means), and
     * otherwise whichever one the user did unlock with — sealing with a key whose
     * parameters this vault knows is always recoverable, because those parameters
     * are on disk and the same password derives the same key again.
     */
    private get key();
    /** The keys to try against one record, this machine's own first. */
    private heldKeys;
    /** This machine's own key — the one the local master password derives. */
    private localKey;
    /** Sealed records no held key can open. */
    private unreadableSealed;
    /** Credential bodies that need the key, tombstones included. */
    get sealedRecords(): number;
    /**
     * The parameters that recognise the master password, when one has been set.
     *
     * Read by the push, which publishes them so another machine can open what it
     * pulled (`../remote/push.ts`).
     */
    get master(): MasterParams | undefined;
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
    adoptMaster(master: MasterParams): Promise<boolean>;
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
    adoptOtherMaster(master: MasterParams): Promise<boolean>;
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
     * Every digest the same plaintext would have under any held key.
     *
     * De-duplication reads a record's `secretDigest`, and that digest was made with
     * whichever key sealed it — so a credential pasted on this machine must be
     * recognised even when the copy already here came from the other one.
     *
     * @param plaintext - the credential as pasted.
     * @returns the digests to match against, empty while nothing is held.
     */
    secretDigests(plaintext: string): string[];
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
