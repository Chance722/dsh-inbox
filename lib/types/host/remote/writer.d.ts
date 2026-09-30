/**
 * The one place that turns settings into "somewhere to put and remove objects".
 *
 * Push writes, purge deletes, and both need the same three answers: which
 * protocol, which credentials, and where the vault's own tree begins. Building
 * that twice is how the two halves drift — the push root and the merge root
 * disagreeing by one slash would look exactly like "the other device never sent
 * anything", and a purge that deleted from a different prefix would leave
 * everything behind.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type WebdavSettings } from '../webdav/config.js';
/** Everything the vault does to the remote. */
export interface RemoteWriter {
    write(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
    remove(path: string): Promise<void>;
}
/** Either a usable writer, or the reason there is none. */
export type RemoteWriterResult = {
    status: 'ok';
    writer: RemoteWriter;
    root: string;
} | {
    status: 'unconfigured';
    reason: string;
} | {
    status: 'failed';
    reason: string;
};
/**
 * Where the vault's own objects live inside the configured directory.
 *
 * @param settings - the remote settings.
 * @returns the path prefix, without a trailing slash.
 */
export declare function syncRoot(settings: WebdavSettings): string;
/**
 * Build the writer for whatever this profile is configured with.
 *
 * @param ctx - host context carrying settings and credentials.
 * @returns the writer and the sync root, or why there is none.
 */
export declare function remoteWriter(ctx: Context): Promise<RemoteWriterResult>;
