/**
 * Bringing other devices' records into this one.
 *
 * The rules are the user's (2026-09-20): a conflict is settled by `updatedAt` —
 * **newer wins, no conflict copies** — deletes travel as tombstones, and what
 * the push wrote is the source of truth, not the `.txt` beside it (a rendered
 * view has no fields to compare).
 *
 * The objects under `sync/` are ours, which is exactly why the *drop folder*
 * pull skips that whole tree — but "ours" does not mean "written by this
 * machine". A record this device has never seen is simply a local miss.
 */
import type { Vault } from '../vault/vault.js';
import { type AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { Context } from '@deepseek-ai/cordis';
/** The merge's admission callbacks, named so the wiring below reads plainly. */
type Admit = {
    image: (bytes: Uint8Array, mime: string, name: string) => Promise<{
        storeId: string;
    } | undefined>;
    file: (bytes: Uint8Array, name: string) => Promise<{
        storeId: string;
    } | undefined>;
};
/** One object in the vault's own tree on the remote. */
export interface SyncObject {
    path: string;
    lastModified?: string;
}
/**
 * The slice of a remote this module reads.
 *
 * Both protocols can answer these two questions (S3 by prefix, WebDAV by
 * `PROPFIND`), and keeping the seam this thin is what lets the merge be tested
 * without either of them.
 */
export interface SyncTree {
    list(prefix: string): Promise<SyncObject[]>;
    read(path: string): Promise<Uint8Array>;
}
/** What one merge did. */
export interface MergeOutcome {
    /** Records that were new here, or overwritten because the remote was newer. */
    merged: number;
    /**
     * How many of {@link merged} arrived as deletions.
     *
     * A deleted record travels as an ordinary record with deletedAt set, so a
     * merge that brings deletions looks exactly like one that brings updates until
     * somebody opens the recycle bin (measured 2026-09-21: 19 merged — 6 new
     * records and 13 tombstones, and the bin went from empty to thirteen).
     */
    deletions: number;
    /**
     * How many of {@link merged} were ids this vault did not have at all.
     *
     * "19 records came over" and "the vault grew by 6" are both true at once, and
     * the reader who just watched a number expects them to match (asked
     * 2026-09-21, after merging an abandoned tree whose copies mostly overlapped).
     */
    added: number;
    /**
     * Copies of records this vault **emptied out of the bin** — left alone, on
     * purpose, because a purge is not a deletion to be argued with.
     *
     * Counted apart from {@link kept}: "the cloud has a copy you already have" and
     * "the cloud has a copy of something you threw away" are different sentences,
     * and only the second one answers "so why did the emptied records stay empty
     * this time?" (2026-09-21).
     */
    purged: number;
    /** Records the remote had and this machine already had, newer or equal. */
    kept: number;
    /** Attachment objects pulled down (bytes plus their row). */
    attachments: number;
    /** Things that went wrong, one line each. */
    failures: string[];
}
/**
 * Pull other devices' records out of `sync/` and settle them against the local
 * vault, then fetch whatever attachment bytes those records need.
 *
 * @param vault - the open vault.
 * @param tree - the remote, as two questions.
 * @param prefix - the sync root inside the configured directory.
 * @param admit - how bytes become a local attachment (the harness's own
 *   admission, so a pulled image is validated exactly like a pasted one).
 * @returns what happened, including the lines worth showing.
 */
export declare function mergeOnce(vault: Vault, tree: SyncTree, prefix: string, admit: {
    image: Admit['image'];
    file: Admit['file'];
}): Promise<MergeOutcome>;
/**
 * The merge, wired for real: read the configuration, build a tree over `sync/`,
 * and hand it to {@link mergeOnce}.
 *
 * Called by every pull the product has (startup, the panel's refresh, 立即同步) so
 * "another device's records show up" does not depend on which button you press.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes go.
 * @returns the counts and the lines worth showing; never throws.
 */
export declare function mergeRemote(ctx: Context, vault: Vault, attachments: AttachmentStore, 
/**
 * Further sync trees to merge, on top of this machine's own.
 *
 * The pull hands over the trees it found elsewhere in the bucket (a machine
 * that used to sync under another directory leaves one behind). Each is read
 * exactly like our own: per record, `id` + `updatedAt` decides.
 */
extraRoots?: readonly string[]): Promise<MergeOutcome>;
export {};
