/**
 * Sending the vault to the remote.
 *
 * The rules this implements are the ones the user decided on 2026-09-20:
 * **only credential bodies travel encrypted** (they are ciphertext on disk
 * already), everything else goes up as it is; a conflict is settled by writing
 * what is newer; and the layout is `sync/items/<id>.json` plus
 * `sync/attachments/<id>` under the configured directory — one file per object,
 * so "increment" is "whatever got touched since last time".
 *
 * Deliberately *not* here yet: deleting remote objects for records the user
 * emptied out of the bin, and merging what other devices pushed. Those are the
 * next two steps; this one only ever adds and overwrites.
 */

import type { AttachmentStore, FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Context } from '@deepseek-ai/cordis'

import type { PushResult } from '../../shared/panel-wire.js'
import { putObject, type S3Config, type S3Deps } from '../s3/client.js'
import { s3Fetch, webdavFetch } from '../webdav/run.js'
import { activeUserAgent, readPassword, readS3Secret, readSettings, type WebdavSettings } from '../webdav/config.js'
import { writeFile } from '../webdav/client.js'
import type { Attachment, Item } from '../vault/spec.js'
import type { Vault } from '../vault/vault.js'

/** What one write to the remote looks like, whichever protocol is configured. */
type Writer = (path: string, bytes: Uint8Array, contentType: string) => Promise<void>

/** The `AttachmentStore` reference shapes the store's own read methods want. */
function imageRef(record: Attachment): ImageAttachmentRef {
  return {
    attachmentId: record.storeId as ImageAttachmentRef['attachmentId'],
    mediaType: record.mime as ImageAttachmentRef['mediaType'],
    bytes: record.bytes,
    width: record.width ?? 0,
    height: record.height ?? 0,
    ...(record.filename === undefined ? {} : { name: record.filename }),
  }
}

function fileRef(record: Attachment): FileAttachmentRef {
  return {
    attachmentId: record.storeId as FileAttachmentRef['attachmentId'],
    name: record.filename ?? 'file',
    bytes: record.bytes,
  }
}

/** The bytes of one attachment, whichever lane it was stored on. */
async function bytesOf(
  attachments: AttachmentStore,
  record: Attachment,
): Promise<Uint8Array | undefined> {
  try {
    if (record.mime.startsWith('image/')) {
      return (await attachments.readImage(imageRef(record))).data
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of attachments.readFileStream(fileRef(record))) chunks.push(chunk)
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const joined = new Uint8Array(total)
    let at = 0
    for (const chunk of chunks) {
      joined.set(chunk, at)
      at += chunk.byteLength
    }
    return joined
  } catch {
    // A record can reference bytes this host does not hold (pulled elsewhere,
    // or a store that cannot hand them out). The record still syncs; its bytes
    // are reported as skipped rather than failing the whole push.
    return undefined
  }
}

/** The JSON one record becomes on the remote. */
function packItem(item: Item): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ format: 'dsh-inbox-item/1', record: item }, undefined, 0),
  )
}

/** Suffix per media type, so a stored object is recognisable outside this plugin. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/json': 'json',
}

/**
 * The object name one attachment gets on the remote.
 *
 * `<our id>.<extension>`: the id keeps it unique and idempotent, the extension
 * keeps it *readable* — a cloud drive with a folder full of extension-less files
 * cannot preview a photo, cannot open it, and cannot tell you which one is which.
 * The user asked exactly that question ("我的图片呢？都是 json 文件？"), and a bare
 * id was the whole reason.
 *
 * @param attachmentId - our row id for the attachment.
 * @param mime - its media type.
 * @returns the file name to PUT.
 */
export function attachmentObjectName(attachmentId: string, mime: string): string {
  const extension = EXTENSIONS[mime.toLowerCase()] ?? 'bin'
  return `${attachmentId}.${extension}`
}

/** The metadata a pulling device needs to re-create the record's attachment row. */
function packAttachment(record: Attachment): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(
      {
        format: 'dsh-inbox-attachment/1',
        attachment: {
          id: record.id,
          mime: record.mime,
          bytes: record.bytes,
          ...(record.filename === undefined ? {} : { filename: record.filename }),
          ...(record.width === undefined ? {} : { width: record.width }),
          ...(record.height === undefined ? {} : { height: record.height }),
          ...(record.sha256 === undefined ? {} : { sha256: record.sha256 }),
        },
      },
      undefined,
      0,
    ),
  )
}

/**
 * Push everything that changed since the last push.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes live.
 * @returns what happened, including the reasons a caller can show.
 */
export async function pushRemote(
  ctx: Context,
  vault: Vault,
  attachments: AttachmentStore | undefined,
  /** `all` ignores the cursor and sends everything again — the repair button. */
  options: { all?: boolean } = {},
): Promise<PushResult> {
  if (attachments === undefined) return failed('这个组合里没有附件仓库，附件没法上传')
  const settings = readSettings(ctx)

  let writer: Writer
  let basePath: string
  try {
    if (settings.protocol === 's3') {
      const secret = await readS3Secret(ctx)
      if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
        return unconfigured('还没配置 S3 的 endpoint 或 bucket')
      }
      if (secret === undefined) return unconfigured('还没存 AccessKey Secret')
      const config: S3Config = {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
        userAgent: activeUserAgent(settings),
      }
      const deps: S3Deps = {
        fetch: s3Fetch,
        accessKeyId: settings.accessKeyId,
        accessKeySecret: secret,
      }
      writer = (path, bytes, contentType) => putObject(config, path, bytes, deps, contentType)
      basePath = s3Root(settings)
    } else {
      if (settings.baseUrl.trim().length === 0) {
        return unconfigured('还没配置远端地址')
      }
      const password = await readPassword(ctx)
      const deps = {
        fetch: webdavFetch,
        ...(settings.username.length === 0 || password === undefined
          ? {}
          : { auth: { username: settings.username, password } }),
        userAgent: activeUserAgent(settings),
      }
      const base = settings.baseUrl
      writer = (path, bytes, contentType) => writeFile(base, path, bytes, deps, contentType)
      basePath = webdavRoot(settings)
    }
  } catch (error) {
    return failed(reasonOf(error))
  }
  return pushOnce(vault, attachments, writer, basePath, options)
}

/**
 * The push itself, with the transport injected.
 *
 * Split out the same way the pull is (`pullOnce` behind `pullRemote`), and for
 * the same reason: the interesting rules — what counts as "changed", what
 * happens when one write of twenty fails, that an attachment is uploaded once
 * however many records point at it — are worth testing without a server.
 *
 * @param vault - the open vault.
 * @param attachments - where attachment bytes live.
 * @param writer - one write to the remote.
 * @param basePath - the sync root inside the configured directory.
 * @param options - `all` re-sends records the cursor thinks are already up.
 * @returns what happened.
 */
export async function pushOnce(
  vault: Vault,
  attachments: AttachmentStore,
  writer: Writer,
  basePath: string,
  options: { all?: boolean } = {},
): Promise<PushResult> {
  const lastPushAt = options.all === true ? undefined : vault.global.sync.lastPushAt
  const items = vault.list({ includeDeleted: true })
  let pushed = 0
  let attachmentCount = 0
  let skipped = 0
  const failures: string[] = []

  // Attachments are pushed once per push, however many records reference them:
  // the store is content-addressed, so the same bytes are the same object.
  const seenAttachments = new Set<string>()

  for (const item of items) {
    // A record the user has since emptied out of the bin is gone from the
    // domain, but not from the remote — that deletion is the next step.
    if (lastPushAt !== undefined && item.updatedAt <= lastPushAt) {
      skipped += 1
      continue
    }
    try {
      await writer(`${basePath}/items/${item.id}.json`, packItem(item), 'application/json')
      pushed += 1
    } catch (error) {
      failures.push(`记录 ${item.id}：${reasonOf(error)}`)
      continue
    }

    for (const attachmentId of item.attachmentIds) {
      if (seenAttachments.has(attachmentId)) continue
      seenAttachments.add(attachmentId)
      const record = vault.getAttachment(attachmentId)
      if (record === undefined) continue
      const bytes = await bytesOf(attachments, record)
      if (bytes === undefined) {
        failures.push(`附件 ${attachmentId}：本机拿不到字节`)
        continue
      }
      try {
        await writer(
          `${basePath}/attachments/${attachmentObjectName(attachmentId, record.mime)}`,
          bytes,
          record.mime,
        )
        // The row travels beside the bytes: without the original name, the
        // intrinsic size and the digest, another device could download the file
        // but never rebuild the record that points at it.
        await writer(
          `${basePath}/attachments/${attachmentId}.meta.json`,
          packAttachment(record),
          'application/json',
        )
        attachmentCount += 1
      } catch (error) {
        failures.push(`附件 ${attachmentId}：${reasonOf(error)}`)
      }
    }
  }

  const now = new Date().toISOString()
  if (pushed > 0 || attachmentCount > 0) await vault.setSync({ ...vault.global.sync, lastPushAt: now })

  return {
    status: failures.length === 0 ? 'ok' : pushed + attachmentCount === 0 ? 'failed' : 'partial',
    pushed,
    attachments: attachmentCount,
    skipped,
    listed: items.length,
    lastPushAt: now,
    ...(failures.length === 0 ? {} : { reason: failures.slice(0, 3).join('；') }),
  }
}

function s3Root(settings: WebdavSettings): string {
  const prefix = settings.directory.replace(/^\/+|\/+$/g, '')
  return prefix.length === 0 ? 'sync' : `${prefix}/sync`
}

function webdavRoot(settings: WebdavSettings): string {
  const prefix = settings.directory.replace(/^\/+|\/+$/g, '')
  return prefix.length === 0 ? 'sync' : `${prefix}/sync`
}

function failed(reason: string): PushResult {
  return {
    status: 'failed',
    reason,
    pushed: 0,
    attachments: 0,
    skipped: 0,
    listed: 0,
  }
}

function unconfigured(reason: string): PushResult {
  return { ...failed(reason), status: 'unconfigured' }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
