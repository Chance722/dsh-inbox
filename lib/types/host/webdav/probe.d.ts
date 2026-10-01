/**
 * The WebDAV self-test: one request that answers "is this channel usable".
 *
 * The S3 side needs a matrix because a gateway can refuse four different things
 * with the same status code. WebDAV does not: a `PROPFIND` on the configured
 * folder either works (the server answers a listing or a 404 for the path) or it
 * does not, and the status says which. So this is deliberately one row — the
 * panel turns it into one sentence.
 *
 * Read-only by construction: `PROPFIND` with no body, and nothing else.
 */
import type { ProbeRow } from '../../shared/panel-wire.js';
import { type WebdavDeps } from './client.js';
/**
 * Ask the configured folder for its listing.
 *
 * @param deps - fetch, credentials and the identity to present.
 * @param baseUrl - the remote base URL from the settings.
 * @param directory - the folder inside it, as configured.
 * @returns one row: what was asked, and what came back.
 */
export declare function probeWebdav(deps: WebdavDeps, baseUrl: string, directory: string): Promise<ProbeRow[]>;
