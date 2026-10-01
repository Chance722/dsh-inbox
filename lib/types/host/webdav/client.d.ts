/**
 * The smallest WebDAV surface the inbox needs: list one folder, read one file.
 *
 * No dependency and no XML library: a `PROPFIND` answer is read with two small
 * expressions over the response blocks, because the alternative (a full parser)
 * buys nothing for the two fields we actually use.
 *
 * `fetch` is injected so the whole thing is testable without a server, and the
 * caller never sees bytes it did not ask for.
 */
/** Basic-auth credentials, when the server is not anonymous. */
export interface WebdavAuth {
    username: string;
    password: string;
}
/** One file found in a remote folder. */
export interface RemoteFile {
    /** Absolute path on the server, as the `href` reported it. */
    path: string;
    /** `getlastmodified`, when the server sent one. */
    lastModified?: string;
    /** `getcontenttype`, when the server sent one. */
    contentType?: string;
}
/** The subset of `fetch` this module uses, so tests can stand in for it. */
export interface FetchResponseLike {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    headers?: {
        get(name: string): string | null;
    };
}
export type FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
}) => Promise<FetchResponseLike>;
/** Everything the client needs besides the URL. */
export interface WebdavDeps {
    fetch: FetchLike;
    auth?: WebdavAuth;
    /** What to send as `User-Agent`; empty falls back to the plugin's own. */
    userAgent?: string;
}
/** Basic auth header, or nothing for an anonymous server. */
export declare function authHeaders(auth?: WebdavAuth): Record<string, string>;
/**
 * The identity this request presents.
 *
 * Same header, same reason as the S3 side: 数据胶囊 answers a request that
 * does not claim to be the application its access key is bound to with
 * `403 Client type mismatch.`, and nothing in the status code hints at it.
 *
 * @param deps - the client's dependencies.
 * @returns the header to send.
 */
export declare function userAgentHeaders(deps: WebdavDeps): Record<string, string>;
/** One joined URL that keeps the base path the user configured. */
export declare function joinUrl(base: string, part: string): string;
/**
 * Write one file.
 *
 * WebDAV needs none of the S3 ceremony — a `PUT` with the bytes and the auth
 * header is the whole protocol — which is exactly why the push path can share
 * one interface with the S3 client (`remote/write.ts`).
 *
 * @param baseUrl - the configured base.
 * @param path - the file's path under it.
 * @param bytes - what to store.
 * @param deps - fetch, credentials and the identity to present.
 * @param contentType - what the bytes are.
 */
export declare function writeFile(baseUrl: string, path: string, bytes: Uint8Array, deps: WebdavDeps, contentType?: string): Promise<void>;
/**
 * Remove one file.
 *
 * A 404 counts as success: the object the caller wanted gone is gone. Anything
 * else 4xx/5xx is reported with the server's own words, because a read-only
 * share is a real answer and "删除失败" alone would hide it.
 *
 * @param baseUrl - the configured base.
 * @param path - the file's path under it.
 * @param deps - fetch, credentials and the identity to present.
 */
export declare function deleteFile(baseUrl: string, path: string, deps: WebdavDeps): Promise<void>;
/**
 * Read one `PROPFIND` answer into files, skipping the folder entries themselves.
 *
 * @param xml - the response body.
 * @param directory - the requested folder, so its own entry can be dropped.
 * @returns the files the server listed.
 */
export declare function parseListing(xml: string, directory: string): RemoteFile[];
/** List the files directly inside one folder. */
export declare function listFolder(baseUrl: string, directory: string, deps: WebdavDeps): Promise<RemoteFile[]>;
/** Fetch one file's bytes, with its content type when the server offers one. */
export declare function readFile(path: string, deps: WebdavDeps, absoluteUrl?: string): Promise<{
    bytes: Uint8Array;
    contentType: string;
}>;
