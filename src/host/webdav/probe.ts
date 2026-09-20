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

import type { ProbeRow } from '../../shared/panel-wire.js'
import { authHeaders, joinUrl, userAgentHeaders, type WebdavDeps } from './client.js'

/** How much of a body to keep: enough for a gateway's own explanation. */
const EXCERPT = 120

/**
 * Ask the configured folder for its listing.
 *
 * @param deps - fetch, credentials and the identity to present.
 * @param baseUrl - the remote base URL from the settings.
 * @param directory - the folder inside it, as configured.
 * @returns one row: what was asked, and what came back.
 */
export async function probeWebdav(
  deps: WebdavDeps,
  baseUrl: string,
  directory: string,
): Promise<ProbeRow[]> {
  const url = joinUrl(baseUrl.replace(/\/+$/, ''), directory.replace(/^\/+/, ''))
  const headers = {
    ...authHeaders(deps.auth),
    ...userAgentHeaders(deps),
    depth: '0',
  }
  try {
    const response = await deps.fetch(url, { method: 'PROPFIND', headers })
    let detail = ''
    try {
      detail = (await response.text()).trim().slice(0, EXCERPT).replace(/\s+/g, ' ')
    } catch {
      detail = '(读不到响应体)'
    }
    return [{ label: 'PROPFIND 目录（只读）', url, status: response.status, detail }]
  } catch (error) {
    return [
      {
        label: 'PROPFIND 目录（只读）',
        url,
        status: 0,
        detail: error instanceof Error ? error.message : String(error),
      },
    ]
  }
}
