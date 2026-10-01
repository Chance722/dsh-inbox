/**
 * One-way ingest, whatever the remote happens to speak.
 *
 * The protocol lives behind `RemoteSource`: WebDAV and S3 each know how to list
 * and read, and everything else — which file is new, what counts as text, how a
 * repeat is merged, what a failure looks like — happens exactly once, here.
 * Two copies of that logic would drift, and the drifting copy would be the one
 * that quietly files something twice.
 *
 * Deliberately one-way. Pulling only, never pushing, is what keeps this simple
 * enough to be trustworthy: there is no merge to get wrong, and the phone never
 * has to understand the vault.
 */
import { type AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { type PullResult } from '../../shared/panel-wire.js';
import type { S3Config, S3Deps } from '../s3/client.js';
import type { Vault } from '../vault/vault.js';
import { type WebdavDeps } from '../webdav/client.js';
export type { PullResult } from '../../shared/panel-wire.js';
/** One thing a remote offers to pull. */
export interface RemoteEntry {
    /** Remote path or key; also the display name's source. */
    path: string;
    lastModified?: string;
    contentType?: string;
}
/** What the ingest needs from a remote, and nothing more. */
export interface RemoteSource {
    list(): Promise<RemoteEntry[]>;
    read(entry: RemoteEntry): Promise<{
        bytes: Uint8Array;
        contentType: string;
    }>;
}
/**
 * Pull one remote and file everything new.
 *
 * Never throws: a remote that is down must not stop the harness from starting,
 * so every failure becomes a `failed` result the caller can show.
 *
 * @param vault - the open vault.
 * @param source - the protocol-specific read side.
 * @param attachments - the store that owns pulled bytes.
 * @returns what happened.
 */
export declare function ingestFrom(vault: Vault, source: RemoteSource, attachments: AttachmentStore, 
/** This machine's own sync root; anything else under `sync/` is a stranger. */
syncRoot?: string, 
/**
 * Sync roots found **outside** the listed scope, from a protocol-specific
 * probe. A listing scoped to our directory cannot see them, and without them
 * "the other machine's records never arrived" has no explanation to show.
 */
elsewhere?: {
    roots: readonly string[];
    records?: number;
}): Promise<PullResult>;
/** What the user configures for WebDAV. */
export interface WebdavConfig {
    baseUrl: string;
    directory?: string;
    username?: string;
}
/** Pull over WebDAV. */
export declare function pullRemote(vault: Vault, config: WebdavConfig, deps: WebdavDeps & {
    attachments: AttachmentStore;
}): Promise<PullResult>;
/**
 * Pull over S3.
 *
 * @param directory - the configured directory, exactly as the settings hold it.
 *   `/`, an empty string and "never set" all mean the default; the listing is
 *   scoped to it and the vault's own tree is `<directory>/sync`.
 *
 * This used to be handed the sync root as the *listing* prefix, and to treat
 * that same string as "ours": with S3 every object the vault had uploaded
 * therefore answered to a prefix that was not ours, so the panel reported
 * 「自己的同步对象 0 项」 and warned about another machine's directory — which was
 * this machine's own (measured 2026-09-21, a bucket holding both `sync/…` from
 * the older build and `inbox/sync/…` from this one).
 */
export declare function pullS3(vault: Vault, config: S3Config, directory: string | undefined, deps: S3Deps & {
    attachments: AttachmentStore;
}): Promise<PullResult>;
