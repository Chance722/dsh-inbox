/**
 * One pull, wired for real: reads the configuration, resolves the password, and
 * hands the whole thing to the ingest.
 *
 * Both callers (startup and the panel's button) go through here, so what the
 * button does and what a restart does cannot drift apart.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'

import type { Vault } from '../vault/vault.js'
import type { FetchLike, WebdavDeps } from './client.js'
import { readPassword, readSettings } from './config.js'
import { pullRemote, type PullResult } from './pull.js'

/** The global fetch, adapted to the client's injected-fetch shape. */
export const webdavFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    ...(init.body === undefined ? {} : { body: init.body }),
  })
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    arrayBuffer: () => response.arrayBuffer(),
    headers: { get: (name: string) => response.headers.get(name) },
  }
}

/**
 * Pull once.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - the store that owns pulled bytes.
 * @returns the pull's outcome; never throws.
 */
export async function runPull(
  ctx: Context,
  vault: Vault,
  attachments: AttachmentStore | undefined,
): Promise<PullResult> {
  const settings = readSettings(ctx)
  if (settings.baseUrl.trim().length === 0) {
    return { status: 'unconfigured', reason: '还没配置 WebDAV 地址', pulled: 0, failed: 0, skipped: 0 }
  }
  if (attachments === undefined) {
    return {
      status: 'failed',
      reason: '这个组合里没有附件仓库，拉下来的文件没处放',
      pulled: 0,
      failed: 0,
      skipped: 0,
    }
  }

  const password = await readPassword(ctx)
  const deps: WebdavDeps & { attachments: AttachmentStore } = {
    fetch: webdavFetch,
    attachments,
    ...(settings.username.length === 0 || password === undefined
      ? {}
      : { auth: { username: settings.username, password } }),
  }
  return pullRemote(vault, settings, deps)
}
