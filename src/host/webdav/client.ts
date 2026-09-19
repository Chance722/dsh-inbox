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

import { DEFAULT_USER_AGENT } from '../../shared/constants.js'

/** Basic-auth credentials, when the server is not anonymous. */
export interface WebdavAuth {
  username: string
  password: string
}

/** One file found in a remote folder. */
export interface RemoteFile {
  /** Absolute path on the server, as the `href` reported it. */
  path: string
  /** `getlastmodified`, when the server sent one. */
  lastModified?: string
  /** `getcontenttype`, when the server sent one. */
  contentType?: string
}

/** The subset of `fetch` this module uses, so tests can stand in for it. */
export interface FetchResponseLike {
  ok: boolean
  status: number
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
  headers?: { get(name: string): string | null }
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponseLike>

/** Everything the client needs besides the URL. */
export interface WebdavDeps {
  fetch: FetchLike
  auth?: WebdavAuth
  /** What to send as `User-Agent`; empty falls back to the plugin's own. */
  userAgent?: string
}

/** Basic auth header, or nothing for an anonymous server. */
export function authHeaders(auth?: WebdavAuth): Record<string, string> {
  if (auth === undefined) return {}
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
  return { authorization: `Basic ${token}` }
}

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
export function userAgentHeaders(deps: WebdavDeps): Record<string, string> {
  const configured = deps.userAgent?.trim() ?? ''
  return { 'user-agent': configured.length === 0 ? DEFAULT_USER_AGENT : configured }
}

/** One joined URL that keeps the base path the user configured. */
export function joinUrl(base: string, part: string): string {
  const left = base.endsWith('/') ? base.slice(0, -1) : base
  const right = part.startsWith('/') ? part.slice(1) : part
  return `${left}/${right}`
}

const RESPONSE_BLOCK = /<[a-z0-9]*:?response\b[\s\S]*?<\/[a-z0-9]*:?response>/gi
const HREF = /<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i
const LAST_MODIFIED = /<[a-z0-9]*:?getlastmodified[^>]*>([\s\S]*?)<\/[a-z0-9]*:?getlastmodified>/i
const CONTENT_TYPE = /<[a-z0-9]*:?getcontenttype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?getcontenttype>/i
const IS_COLLECTION = /<[a-z0-9]*:?collection\s*\/?>/i

/** Undo the XML escapes a `href` can carry. */
function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * Read one `PROPFIND` answer into files, skipping the folder entries themselves.
 *
 * @param xml - the response body.
 * @param directory - the requested folder, so its own entry can be dropped.
 * @returns the files the server listed.
 */
export function parseListing(xml: string, directory: string): RemoteFile[] {
  const files: RemoteFile[] = []
  // The requested folder's own entry has to go. Compare against the folder
  // path, and treat the root as "nothing to compare" rather than as an empty
  // string — `endsWith('')` is true for every path, so a root listing used to
  // come back empty.
  const folder = directory.replace(/\/+$/, '')
  for (const block of xml.match(RESPONSE_BLOCK) ?? []) {
    if (IS_COLLECTION.test(block)) continue
    const href = HREF.exec(block)?.[1]
    if (href === undefined) continue
    const path = decode(href)
    if (folder.length > 0 && path.replace(/\/+$/, '').endsWith(folder)) continue
    const lastModified = LAST_MODIFIED.exec(block)?.[1]
    const contentType = CONTENT_TYPE.exec(block)?.[1]
    files.push({
      path,
      ...(lastModified === undefined ? {} : { lastModified: decode(lastModified) }),
      ...(contentType === undefined ? {} : { contentType: decode(contentType).split(';')[0] ?? '' }),
    })
  }
  return files
}

/**
 * Turn a refused response into an error that carries what the server said.
 *
 * The body is where these gateways explain themselves — `403 Client type
 * mismatch.` is a complete diagnosis, and dropping it leaves a status code that
 * reads like a credentials problem.
 *
 * @param what - which operation failed, in Chinese.
 * @param response - the refused response.
 * @returns the error to throw.
 */
async function refusal(what: string, response: FetchResponseLike): Promise<Error> {
  let body = ''
  try {
    body = (await response.text()).trim().slice(0, 200)
  } catch {
    // A body we cannot read must not replace the status we can.
  }
  const identity =
    response.status === 401 || response.status === 403
      ? '\n（这类网关常按客户端标识认人：这个账号绑定的应用名要填进设置的「客户端标识」）'
      : ''
  return new Error(
    `${what}失败：HTTP ${String(response.status)}${body.length === 0 ? '' : ` — ${body.replace(/\s+/g, ' ')}`}${identity}`,
  )
}

/** List the files directly inside one folder. */
export async function listFolder(
  baseUrl: string,
  directory: string,
  deps: WebdavDeps,
): Promise<RemoteFile[]> {
  const response = await deps.fetch(joinUrl(baseUrl, directory), {
    method: 'PROPFIND',
    headers: {
      depth: '1',
      'content-type': 'application/xml',
      ...authHeaders(deps.auth),
      ...userAgentHeaders(deps),
    },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontenttype/><d:resourcetype/></d:prop></d:propfind>',
  })
  if (!response.ok) {
    throw await refusal('列目录', response)
  }
  return parseListing(await response.text(), directory)
}

/** Fetch one file's bytes, with its content type when the server offers one. */
export async function readFile(
  path: string,
  deps: WebdavDeps,
  absoluteUrl?: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await deps.fetch(absoluteUrl ?? path, {
    method: 'GET',
    headers: { ...authHeaders(deps.auth), ...userAgentHeaders(deps) },
  })
  if (!response.ok) {
    throw await refusal('取文件', response)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const declared = response.headers?.get('content-type') ?? 'application/octet-stream'
  return { bytes, contentType: declared.split(';')[0] ?? 'application/octet-stream' }
}
