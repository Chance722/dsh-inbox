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
}

/** Basic auth header, or nothing for an anonymous server. */
export function authHeaders(auth?: WebdavAuth): Record<string, string> {
  if (auth === undefined) return {}
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
  return { authorization: `Basic ${token}` }
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
  for (const block of xml.match(RESPONSE_BLOCK) ?? []) {
    if (IS_COLLECTION.test(block)) continue
    const href = HREF.exec(block)?.[1]
    if (href === undefined) continue
    const path = decode(href)
    if (path.replace(/\/$/, '').endsWith(directory.replace(/\/$/, ''))) continue
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

/** List the files directly inside one folder. */
export async function listFolder(
  baseUrl: string,
  directory: string,
  deps: WebdavDeps,
): Promise<RemoteFile[]> {
  const response = await deps.fetch(joinUrl(baseUrl, directory), {
    method: 'PROPFIND',
    headers: { depth: '1', 'content-type': 'application/xml', ...authHeaders(deps.auth) },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getlastmodified/><d:getcontenttype/><d:resourcetype/></d:prop></d:propfind>',
  })
  if (!response.ok) {
    throw new Error(`列目录失败：HTTP ${String(response.status)}`)
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
    headers: { ...authHeaders(deps.auth) },
  })
  if (!response.ok) {
    throw new Error(`取文件失败：HTTP ${String(response.status)}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const declared = response.headers?.get('content-type') ?? 'application/octet-stream'
  return { bytes, contentType: declared.split(';')[0] ?? 'application/octet-stream' }
}
