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
import { mergeRemote } from '../remote/merge.js'
import type { FetchLike, WebdavDeps } from './client.js'
import { activeUserAgent, readPassword, readS3Secret, readSettings } from './config.js'

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
 * The same adapter for the S3 client.
 *
 * The body has to be forwarded here, and it *was not* until a real bucket
 * showed it: every PUT left with an empty payload, the gateway accepted them
 * all, and the cloud drive filled up with 0-byte objects while the push happily
 * reported success. A fake fetch in a unit test cannot catch that — it is this
 * one-line omission that the *adapter* had, not the client.
 */
export const s3Fetch: S3FetchLike = async (url, init) => {
  // `Uint8Array<ArrayBufferLike>` is what TypeScript infers for a byte array and
  // is not structurally a `BodyInit`, though every runtime accepts it as one.
  // The cast is the whole difference; sending it is not.
  const body = init.body === undefined ? undefined : (init.body as unknown as BodyInit)
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    ...(body === undefined ? {} : { body }),
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
  return withMerge(ctx, vault, attachments, await pullDropFolder(ctx, vault, attachments))
}

/**
 * Fold another device's push into the local vault, and report it beside the
 * drop-folder numbers.
 *
 * It runs after the drop-folder ingest for every trigger the product has —
 * startup, the panel's refresh, 立即同步 — because "the other computer's records
 * show up" must not depend on which button was pressed. A merge failure never
 * turns a good pull into a bad one: it becomes one more line in `reason`.
 *
 * @param ctx - host context.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes go.
 * @param pulled - what the drop-folder half did.
 * @returns the combined answer.
 */
async function withMerge(
  ctx: Context,
  vault: Vault,
  attachments: AttachmentStore | undefined,
  pulled: PullResult,
): Promise<PullResult> {
  if (pulled.status !== 'ok' || attachments === undefined) return pulled
  const outcome = await mergeRemote(ctx, vault, attachments)
  const troubles = [...(pulled.failed > 0 && pulled.reason !== undefined ? [pulled.reason] : []), ...outcome.failures]
  return {
    ...pulled,
    merged: outcome.merged,
    attachments: outcome.attachments,
    failed: pulled.failed + outcome.failures.length,
    ...(troubles.length === 0 ? {} : { reason: troubles.slice(0, 3).join('；') }),
  }
}

/** The half that reads the drop folder: files other devices leave for us. */
async function pullDropFolder(
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
        userAgent: activeUserAgent(settings),
      },
      // The configured directory, not a pre-trimmed string: `/`, `''` and
      // "unset" all mean the default, and the ingest resolves the vault's own
      // root from the same rule the writer uses.
      settings.directory,
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
    userAgent: activeUserAgent(settings),
    ...(settings.username.length === 0 || password === undefined
      ? {}
      : { auth: { username: settings.username, password } }),
  }
  return pullRemote(vault, settings, deps)
}
