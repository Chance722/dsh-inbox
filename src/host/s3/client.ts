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

import { createHash, createHmac } from 'node:crypto'

/** What the user fills in. The secret never lives here. */
export interface S3Config {
  /** e.g. `https://s3.cstcloud.cn` — no bucket, no trailing slash needed. */
  endpoint: string
  bucket: string
  /** Covered by the signature; defaults to `us-east-1` for non-AWS servers. */
  region?: string
  /** Only v4 is implemented; the field exists so the choice is visible. */
  signatureVersion?: string
}

/** One object found under the prefix. */
export interface RemoteObject {
  key: string
  lastModified?: string
  bytes?: number
}

/** The subset of `fetch` this module uses, so tests can stand in for it. */
export interface S3ResponseLike {
  ok: boolean
  status: number
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
  headers?: { get(name: string): string | null }
}

export type S3FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<S3ResponseLike>

/**
 * Turn a refused response into something an operator can act on.
 *
 * S3 explains itself in the body (`<Error><Code>SignatureDoesNotMatch</Code>…`)
 * and, for 401, in `WWW-Authenticate`; a bare status code hides the one fact
 * that matters — whether the credential is wrong or the *signature version* is.
 *
 * @param response - the refused response.
 * @param what - which operation failed, in Chinese.
 * @returns the error to throw.
 */
async function refused(response: S3ResponseLike, what: string): Promise<Error> {
  let body = ''
  try {
    body = (await response.text()).trim().slice(0, 300)
  } catch {
    // A body we cannot read must not replace the status we can.
  }
  const challenge = response.headers?.get('www-authenticate') ?? ''
  const hints = [body, challenge.length === 0 ? '' : `WWW-Authenticate: ${challenge}`].filter(
    (part) => part.length > 0,
  )
  return new Error(
    `${what}失败：HTTP ${String(response.status)}${hints.length === 0 ? '' : ` — ${hints.join(' ')}`}`,
  )
}

/** Everything a call needs besides the configuration. */
export interface S3Deps {
  fetch: S3FetchLike
  accessKeyId: string
  accessKeySecret: string
  /** Injected so tests are not clock-dependent. */
  now?: Date
}

/** `YYYYMMDDTHHMMSSZ`, the only date format SigV4 accepts. */
export function amzDate(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').split('.')[0] ?? ''}Z`
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

/** RFC 3986 encoding, which differs from `encodeURIComponent` on `!'()*`. */
function encodePart(value: string, encodeSlash: boolean): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return encodeSlash ? encoded : encoded.replace(/%2F/g, '/')
}

/** The pieces of a signed request, exposed so a test can look at them. */
export interface SignedRequest {
  url: string
  headers: Record<string, string>
  canonicalRequest: string
  signature: string
}

/** `RFC 1123` date, the only one SigV2 accepts. */
export function rfc1123(now: Date): string {
  return now.toUTCString()
}

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
export function signRequestV2(
  config: S3Config,
  deps: S3Deps,
  method: string,
  key: string,
  query: Record<string, string> = {},
): SignedRequest & { stringToSign: string } {
  const date = rfc1123(deps.now ?? new Date())
  const base = config.endpoint.replace(/\/$/, '')
  const canonicalUri = `/${encodePart(config.bucket, false)}${
    key.length === 0 ? '' : `/${encodePart(key, false)}`
  }`
  const queryString = Object.entries(query)
    .map(([name, value]) => `${encodePart(name, true)}=${encodePart(value, true)}`)
    .sort()
    .join('&')

  // Only the sub-resources below belong in the canonical resource; `prefix`,
  // `list-type` and friends stay in the URL and out of the signature.
  const subResource = (['acl', 'location', 'versioning'] as const).find(
    (name) => query[name] !== undefined,
  )
  const canonicalResource = `${canonicalUri}${subResource === undefined ? '' : `?${subResource}`}`

  const stringToSign = [method, '', '', date, canonicalResource].join('\n')
  const signature = createHmac('sha1', deps.accessKeySecret).update(stringToSign).digest('base64')

  return {
    url: `${base}${canonicalUri}${queryString.length === 0 ? '' : `?${queryString}`}`,
    headers: {
      date,
      authorization: `AWS ${deps.accessKeyId}:${signature}`,
    },
    canonicalRequest: stringToSign,
    signature,
    stringToSign,
  }
}

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
export function signRequest(
  config: S3Config,
  deps: S3Deps,
  method: string,
  key: string,
  query: Record<string, string> = {},
): SignedRequest {
  const now = deps.now ?? new Date()
  const stamp = amzDate(now)
  const day = stamp.slice(0, 8)
  const region = config.region ?? 'us-east-1'
  const base = config.endpoint.replace(/\/$/, '')

  const canonicalUri = `/${encodePart(config.bucket, false)}${
    key.length === 0 ? '' : `/${encodePart(key, false)}`
  }`
  const canonicalQuery = Object.entries(query)
    .map(([name, value]) => `${encodePart(name, true)}=${encodePart(value, true)}`)
    .sort()
    .join('&')

  const payloadHash = sha256Hex('')
  const host = new URL(base).host
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${stamp}\n`

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${day}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${deps.accessKeySecret}`, day), region), 's3'), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  return {
    url: `${base}${canonicalUri}${canonicalQuery.length === 0 ? '' : `?${canonicalQuery}`}`,
    headers: {
      host,
      'x-amz-date': stamp,
      'x-amz-content-sha256': payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${deps.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    canonicalRequest,
    signature,
  }
}

const KEY_BLOCK = /<Key>([\s\S]*?)<\/Key>/i
const LAST_MODIFIED = /<LastModified>([\s\S]*?)<\/LastModified>/i
const SIZE = /<Size>([\s\S]*?)<\/Size>/i
const CONTENTS = /<Contents>[\s\S]*?<\/Contents>/gi

/** Undo the XML escapes a key can carry (keys legitimately contain `&`). */
function decode(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/**
 * Read a ListObjectsV2 answer.
 *
 * @param xml - the response body.
 * @returns the objects it listed.
 */
export function parseListing(xml: string): RemoteObject[] {
  const objects: RemoteObject[] = []
  for (const block of xml.match(CONTENTS) ?? []) {
    const key = KEY_BLOCK.exec(block)?.[1]
    if (key === undefined) continue
    const lastModified = LAST_MODIFIED.exec(block)?.[1]
    const size = SIZE.exec(block)?.[1]
    const parsedSize = size === undefined ? undefined : Number.parseInt(size, 10)
    objects.push({
      key: decode(key),
      ...(lastModified === undefined ? {} : { lastModified: decode(lastModified) }),
      ...(parsedSize === undefined || Number.isNaN(parsedSize) ? {} : { bytes: parsedSize }),
    })
  }
  return objects
}

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
export async function listPrefix(
  config: S3Config,
  prefix: string,
  deps: S3Deps,
): Promise<RemoteObject[]> {
  const sign = signer(config)

  const v2 = sign(config, deps, 'GET', '', { 'list-type': '2', prefix })
  const first = await deps.fetch(v2.url, { method: 'GET', headers: v2.headers })
  if (first.ok) return parseListing(await first.text())

  // Only a server-side failure justifies the fallback; a 4xx is an answer
  // (wrong key, missing permission) and asking again would just repeat it.
  const refusal = await refused(first, '列对象')
  if (first.status < 500) throw refusal

  const v1 = sign(config, deps, 'GET', '', { prefix })
  const second = await deps.fetch(v1.url, { method: 'GET', headers: v1.headers })
  if (!second.ok) {
    // Report both: the first explains why we tried the older call at all.
    throw new Error(`${await refused(second, '列对象（V1 回退）').then((e) => e.message)}\n首次尝试：${refusal.message}`)
  }
  return parseListing(await second.text())
}

/** Fetch one object's bytes, with its content type when the server sends one. */
export async function readObject(
  config: S3Config,
  key: string,
  deps: S3Deps,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const signed = signer(config)(config, deps, 'GET', key)
  const response = await deps.fetch(signed.url, { method: 'GET', headers: signed.headers })
  if (!response.ok) throw await refused(response, '取对象')
  const bytes = new Uint8Array(await response.arrayBuffer())
  const declared = response.headers?.get('content-type') ?? 'application/octet-stream'
  return { bytes, contentType: declared.split(';')[0] ?? 'application/octet-stream' }
}

/**
 * Pick the signer for a configuration.
 *
 * @param config - endpoint, bucket, region, signatureVersion.
 * @returns the signer to use.
 */
export function signer(
  config: S3Config,
): (config: S3Config, deps: S3Deps, method: string, key: string, query?: Record<string, string>) => SignedRequest {
  return config.signatureVersion?.toLowerCase() === 'v2' ? signRequestV2 : signRequest
}
