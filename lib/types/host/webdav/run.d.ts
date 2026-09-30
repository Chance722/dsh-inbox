/**
 * One pull, wired for real: reads the configuration, resolves the password, and
 * hands the whole thing to the ingest.
 *
 * Both callers (startup and the panel's button) go through here, so what the
 * button does and what a restart does cannot drift apart.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { S3FetchLike } from '../s3/client.js';
import type { Vault } from '../vault/vault.js';
import { type PullResult } from '../remote/pull.js';
import type { FetchLike } from './client.js';
/** The global fetch, adapted to the client's injected-fetch shape. */
export declare const webdavFetch: FetchLike;
/**
 * The same adapter for the S3 client.
 *
 * The body has to be forwarded here, and it *was not* until a real bucket
 * showed it: every PUT left with an empty payload, the gateway accepted them
 * all, and the cloud drive filled up with 0-byte objects while the push happily
 * reported success. A fake fetch in a unit test cannot catch that — it is this
 * one-line omission that the *adapter* had, not the client.
 */
export declare const s3Fetch: S3FetchLike;
/**
 * Pull once.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - the store that owns pulled bytes.
 * @returns the pull's outcome; never throws.
 */
export declare function runPull(ctx: Context, vault: Vault, attachments: AttachmentStore | undefined): Promise<PullResult>;
