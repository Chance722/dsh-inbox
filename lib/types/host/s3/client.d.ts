/**
 * The smallest S3 surface the inbox needs: list one prefix, read one object.
 *
 * Signing is implemented rather than imported. A dependency would be the
 * obvious move, but this is ~60 lines of well-specified HMAC chaining, and the
 * alternative is shipping a second network stack inside a vault plugin whose
 * whole point is that nothing unexpected leaves the machine.
 *
 * Assumptions that keep it small, each of them honest about its limit:
 *   - **path-style** addressing (`<endpoint>/<bucket>/<key>`), which is what
 *     non-AWS S3 deployments such as 数据胶囊 accept;
 *   - **SigV4** (`AWS4-HMAC-SHA256`), with the region configurable because the
 *     signature covers it even when the server ignores it;
 *   - `UNSIGNED-PAYLOAD` is *not* used: every body we send is empty, so the
 *     payload hash is the SHA-256 of nothing.
 */
/** What the user fills in. The secret never lives here. */
export interface S3Config {
    /** e.g. `https://s3.cstcloud.cn` — no bucket, no trailing slash needed. */
    endpoint: string;
    bucket: string;
    /** Covered by the signature; defaults to `us-east-1` for non-AWS servers. */
    region?: string;
    /** Only v4 is implemented; the field exists so the choice is visible. */
    signatureVersion?: string;
    /** What to send as `User-Agent`; empty falls back to the plugin's own. */
    userAgent?: string;
}
/**
 * The identity this request presents.
 *
 * Not cosmetic: 数据胶囊 binds an access key to an application and answers
 * every request that does not claim to be that application with a body-less
 * 401 — identical, from the outside, to a wrong secret. The signature never
 * covers this header, so it can be set freely.
 *
 * @param config - endpoint, bucket, region, optional user agent.
 * @returns the header value to send.
 */
export declare function userAgentOf(config: S3Config): string;
/** One object found under the prefix. */
export interface RemoteObject {
    key: string;
    lastModified?: string;
    bytes?: number;
}
/** The subset of `fetch` this module uses, so tests can stand in for it. */
export interface S3ResponseLike {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    headers?: {
        get(name: string): string | null;
    };
}
export type S3FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body?: Uint8Array;
}) => Promise<S3ResponseLike>;
/** Everything a call needs besides the configuration. */
export interface S3Deps {
    fetch: S3FetchLike;
    accessKeyId: string;
    accessKeySecret: string;
    /** Injected so tests are not clock-dependent. */
    now?: Date;
}
/** `YYYYMMDDTHHMMSSZ`, the only date format SigV4 accepts. */
export declare function amzDate(now: Date): string;
/** The pieces of a signed request, exposed so a test can look at them. */
export interface SignedRequest {
    url: string;
    headers: Record<string, string>;
    canonicalRequest: string;
    signature: string;
}
/** `RFC 1123` date, the only one SigV2 accepts. */
export declare function rfc1123(now: Date): string;
/**
 * Sign one request with **SigV2**.
 *
 * Not legacy for its own sake: gateways that describe their older clients as
 * needing "SSL/TLS and path-style addressing" are usually v2-only, and a v4
 * request to one of them is answered with a bare 401 — which is exactly the
 * shape of the failure this implementation exists to fix.
 *
 * SigV2 signs a different thing than v4: the date, the content type, and the
 * *canonicalized resource* — and only the query parameters on the sub-resource
 * list take part, not ordinary ones like `prefix`.
 *
 * @param config - endpoint, bucket, region.
 * @param deps - credentials, fetch, clock.
 * @param method - HTTP method.
 * @param key - object key, empty for a bucket operation.
 * @param query - query parameters.
 * @returns the URL, headers, and the string that was signed.
 */
export declare function signRequestV2(config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>): SignedRequest & {
    stringToSign: string;
};
/**
 * Sign one request.
 *
 * @param config - endpoint, bucket, region.
 * @param deps - credentials, fetch, clock.
 * @param method - HTTP method.
 * @param key - object key, empty for a bucket operation.
 * @param query - query parameters, already encoded values.
 * @returns the URL, headers, and the intermediate values (for tests).
 */
export declare function signRequest(config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>, 
/**
 * The bytes a write is about to send.
 *
 * SigV4 signs the *payload*: a PUT signed as if it were empty is refused by
 * every strict gateway, which is why reads (no body) and writes (a body) must
 * go through the same function with the difference made explicit.
 */
body?: Uint8Array): SignedRequest;
/**
 * SigV4 with the **minimum** signed headers: `host` and `x-amz-date` only.
 *
 * The full form also signs `x-amz-content-sha256`, which is what AWS expects.
 * A gateway that implements a subset of v4 recomputes the canonical request
 * from the two headers it knows and then rejects every signature we send —
 * which is indistinguishable from a wrong key until you try this.
 *
 * @param config - endpoint, bucket, region.
 * @param deps - credentials, fetch, clock.
 * @param method - HTTP method.
 * @param key - object key.
 * @param query - query parameters.
 * @returns the signed request.
 */
export declare function signRequestV4Minimal(config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>): SignedRequest;
/**
 * SigV4 with **`UNSIGNED-PAYLOAD`** as the content hash — what the official SDKs
 * send for a GET over HTTPS.
 *
 * This is the third and last shape worth trying: the full form signs the hash of
 * the empty body, the minimal form omits the header, and this one declares the
 * payload deliberately unsigned. A gateway that validates the *value* rather
 * than recomputing it accepts only this one.
 *
 * @param config - endpoint, bucket, region.
 * @param deps - credentials, fetch, clock.
 * @param method - HTTP method.
 * @param key - object key.
 * @param query - query parameters.
 * @returns the signed request.
 */
export declare function signRequestUnsignedPayload(config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>): SignedRequest;
/**
 * Read a ListObjectsV2 answer.
 *
 * @param xml - the response body.
 * @returns the objects it listed.
 */
export declare function parseListing(xml: string): RemoteObject[];
/**
 * List objects under a prefix.
 *
 * Tries ListObjects **V2** first and falls back to **V1** when the server
 * refuses it. Both answer with the same `<Contents>` shape, so the parser does
 * not care; what differs is that plenty of gateways implement only V1 and
 * answer a `list-type=2` request with a server error rather than an S3 error —
 * which is exactly the shape of a 500 that says "unknown runtime exception".
 *
 * @param config - endpoint, bucket, region.
 * @param prefix - key prefix, e.g. `inbox/`.
 * @param deps - credentials, fetch, clock.
 * @returns the objects found.
 */
export declare function listPrefix(config: S3Config, prefix: string, deps: S3Deps, 
/** Extra query parameters, e.g. `{ delimiter: '/', 'max-keys': '1' }`. */
extra?: Record<string, string>): Promise<RemoteObject[]>;
/**
 * The top-level folders a bucket has.
 *
 * `delimiter=/` collapses everything below the first slash into
 * `<CommonPrefixes>`, which is the cheap way to ask "what else lives up here?" —
 * one request, however many objects the bucket holds. It is what makes "another
 * machine synced into a different directory" visible: that machine's records are
 * not under our directory, so a listing scoped to ours can never see them, and
 * the silence looks exactly like "nothing new" (asked 2026-09-21).
 *
 * @param config - endpoint, bucket, region.
 * @param deps - credentials, fetch, clock.
 * @returns folder names without the trailing slash, e.g. `['inbox', 'sync']`.
 */
export declare function listTopLevel(config: S3Config, deps: S3Deps): Promise<string[]>;
/**
 * Read the folder names out of a `delimiter=/` listing.
 *
 * @param xml - the response body.
 * @returns each prefix without its trailing slash.
 */
export declare function parsePrefixes(xml: string): string[];
/** Fetch one object's bytes, with its content type when the server sends one. */
export declare function readObject(config: S3Config, key: string, deps: S3Deps): Promise<{
    bytes: Uint8Array;
    contentType: string;
}>;
/**
 * Write one object.
 *
 * The payload goes into the signature (see {@link signRequest}), which is the
 * one thing that makes a write different from every read this client has done
 * until now: a gateway that checks the payload hash refuses a PUT signed as if
 * it had no body. `content-length` and `content-type` ride along unsigned —
 * they are not part of `signedHeaders`, and servers accept exactly that.
 *
 * @param config - endpoint, bucket, region, signature version.
 * @param key - object key.
 * @param body - the bytes to store.
 * @param deps - credentials, fetch, clock.
 * @param contentType - what the bytes are, when the caller knows.
 */
export declare function putObject(config: S3Config, key: string, body: Uint8Array, deps: S3Deps, contentType?: string): Promise<void>;
/**
 * Remove one object.
 *
 * Idempotent on purpose: S3 answers 204 for a key that was never there, and the
 * callers here delete objects they *believe* exist (a record's files, an
 * attachment's bytes) — a missing one is the state they wanted, not a failure.
 *
 * @param config - endpoint, bucket, region, signature version.
 * @param key - object key.
 * @param deps - credentials, fetch, clock.
 */
export declare function deleteObject(config: S3Config, key: string, deps: S3Deps): Promise<void>;
/**
 * Pick the signer for a configuration.
 *
 * @param config - endpoint, bucket, region, signatureVersion.
 * @returns the signer to use.
 */
export declare function signer(config: S3Config): (config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>, body?: Uint8Array) => SignedRequest;
