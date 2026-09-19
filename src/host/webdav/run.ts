/**
 * One pull, wired for real: reads the configuration, resolves the password, and
 * hands the whole thing to the ingest.
 *
 * Both callers (startup and the panel's button) go through here, so what the
 * button does and what a restart does cannot drift apart.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'

import type { S3FetchLike } from '../s3/client.js'
import type { Vault } from '../vault/vault.js'
import { pullRemote, pullS3, type PullResult } from '../remote/pull.js'
import type { FetchLike, WebdavDeps } from './client.js'
import { readPassword, readS3Secret, readSettings } from './config.js'

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

/** The same adapter for the S3 client, which sends no body either. */
export const s3Fetch: S3FetchLike = async (url, init) => {
  const response = await fetch(url, { method: init.method, headers: init.headers })
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
  if (attachments === undefined) {
    return {
      status: 'failed',
      reason: '这个组合里没有附件仓库，拉下来的文件没处放',
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0,
    }
  }

  if (settings.protocol === 's3') {
    const secret = await readS3Secret(ctx)
    if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
      return {
        status: 'unconfigured',
        reason: '还没配置 S3 的 endpoint 或 bucket',
        pulled: 0,
        failed: 0,
        skipped: 0,
        listed: 0,
      }
    }
    if (secret === undefined) {
      return {
        status: 'unconfigured',
        reason: '还没存 S3 的 AccessKey Secret',
        pulled: 0,
        failed: 0,
        skipped: 0,
        listed: 0,
      }
    }
    return pullS3(
      vault,
      {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
      },
      settings.directory.replace(/^\//, ''),
      {
        fetch: s3Fetch,
        accessKeyId: settings.accessKeyId,
        accessKeySecret: secret,
        attachments,
      },
    )
  }

  if (settings.baseUrl.trim().length === 0) {
    return { status: 'unconfigured', reason: '还没配置 WebDAV 地址', pulled: 0, failed: 0, skipped: 0, listed: 0 }
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
