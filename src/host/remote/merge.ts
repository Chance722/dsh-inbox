/**
 * Bringing other devices' records into this one.
 *
 * The rules are the user's (2026-09-20): a conflict is settled by `updatedAt` —
 * **newer wins, no conflict copies** — deletes travel as tombstones, and what
 * the push wrote is the source of truth, not the `.txt` beside it (a rendered
 * view has no fields to compare).
 *
 * The objects under `sync/` are ours, which is exactly why the *drop folder*
 * pull skips that whole tree — but "ours" does not mean "written by this
 * machine". A record this device has never seen is simply a local miss.
 */

import type { Attachment, Item } from '../vault/spec.js'
import type { Vault } from '../vault/vault.js'
import { admitEncodedFile, admitEncodedImages, type AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Context } from '@deepseek-ai/cordis'

import { INBOX_IMAGE_TYPES } from '../../shared/panel-wire.js'
import { listPrefix, readObject, type S3Config, type S3Deps } from '../s3/client.js'
import { listFolder, readFile, type WebdavDeps } from '../webdav/client.js'
import { activeUserAgent, readPassword, readS3Secret, readSettings, type WebdavSettings } from '../webdav/config.js'
import { s3Fetch, webdavFetch } from '../webdav/run.js'
import { syncRoot } from './push.js'

/** The merge's admission callbacks, named so the wiring below reads plainly. */
type Admit = {
  image: (bytes: Uint8Array, mime: string, name: string) => Promise<{ storeId: string } | undefined>
  file: (bytes: Uint8Array, name: string) => Promise<{ storeId: string } | undefined>
}

/** One object in the vault's own tree on the remote. */
export interface SyncObject {
  path: string
  lastModified?: string
}

/**
 * The slice of a remote this module reads.
 *
 * Both protocols can answer these two questions (S3 by prefix, WebDAV by
 * `PROPFIND`), and keeping the seam this thin is what lets the merge be tested
 * without either of them.
 */
export interface SyncTree {
  list(prefix: string): Promise<SyncObject[]>
  read(path: string): Promise<Uint8Array>
}

/** What one merge did. */
export interface MergeOutcome {
  /** Records that were new here, or overwritten because the remote was newer. */
  merged: number
  /** Records the remote had and this machine already had, newer or equal. */
  kept: number
  /** Attachment objects pulled down (bytes plus their row). */
  attachments: number
  /** Things that went wrong, one line each. */
  failures: string[]
}

/** The wrapper every pushed record carries. */
interface PackedItem {
  format?: unknown
  record?: unknown
}

/** The wrapper every pushed attachment row carries. */
interface PackedAttachment {
  format?: unknown
  attachment?: unknown
}

/** The file name out of a remote path. */
function nameOf(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0)
  return parts[parts.length - 1] ?? path
}

/** The row id a pushed object belongs to, when the name follows our naming. */
function idOf(path: string): string | undefined {
  const name = decodeURIComponent(nameOf(path))
  // `<id>.json` and `<id>.<ext>` for attachments; anything else (the `.txt`
  // view, a folder marker, an object from an older layout) is not ours to read.
  const match = /^([0-9a-fA-F-]{36})\.([A-Za-z0-9]{1,8})$/.exec(name)
  return match?.[1]
}

/** Parse one pushed record, refusing anything that is not one. */
function itemOf(bytes: Uint8Array): Item | undefined {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PackedItem
    if (parsed.format !== 'dsh-inbox-item/1') return undefined
    const record = parsed.record as Item | undefined
    if (record === undefined || typeof record.id !== 'string') return undefined
    if (typeof record.updatedAt !== 'string') return undefined
    return record
  } catch {
    return undefined
  }
}

function attachmentOf(bytes: Uint8Array): Omit<Attachment, 'storeId'> | undefined {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PackedAttachment
    if (parsed.format !== 'dsh-inbox-attachment/1') return undefined
    const row = parsed.attachment as Omit<Attachment, 'storeId'> | undefined
    if (row === undefined || typeof row.id !== 'string' || typeof row.mime !== 'string') {
      return undefined
    }
    return row
  } catch {
    return undefined
  }
}

/** Whether a remote record should replace the local one, if there is one. */
function wins(remote: Item, local: Item | undefined): boolean {
  if (local === undefined) return true
  const incoming = Date.parse(remote.updatedAt)
  const current = Date.parse(local.updatedAt)
  if (Number.isNaN(incoming) || Number.isNaN(current)) return false
  // Strictly newer: equal timestamps mean the two sides agree (a record this
  // machine just pushed comes back with the same `updatedAt` it left with).
  return incoming > current
}

/**
 * Pull other devices' records out of `sync/` and settle them against the local
 * vault, then fetch whatever attachment bytes those records need.
 *
 * @param vault - the open vault.
 * @param tree - the remote, as two questions.
 * @param prefix - the sync root inside the configured directory.
 * @param admit - how bytes become a local attachment (the harness's own
 *   admission, so a pulled image is validated exactly like a pasted one).
 * @returns what happened, including the lines worth showing.
 */
export async function mergeOnce(
  vault: Vault,
  tree: SyncTree,
  prefix: string,
  admit: {
    image: Admit['image']
    file: Admit['file']
  },
): Promise<MergeOutcome> {
  const failures: string[] = []
  let merged = 0
  let kept = 0
  let attachments = 0

  let objects: SyncObject[]
  try {
    objects = await tree.list(`${prefix}/items/`)
  } catch (error) {
    return { merged: 0, kept: 0, attachments: 0, failures: [`列远端同步目录失败：${reasonOf(error)}`] }
  }

  /** Attachment rows this merge brought in, to fetch bytes for afterwards. */
  const wanted = new Map<string, string>()
  /** Where each attachment's bytes are: `<id>` → its object, listed once. */
  const bytesAt = new Map<string, string>()
  try {
    for (const object of await tree.list(`${prefix}/attachments/`)) {
      const id = idOf(object.path)
      if (id === undefined || nameOf(object.path).endsWith('.meta.json')) continue
      bytesAt.set(id, object.path)
    }
  } catch (error) {
    failures.push(`列远端附件目录失败：${reasonOf(error)}`)
  }

  for (const object of objects) {
    const id = idOf(object.path)
    const name = decodeURIComponent(nameOf(object.path))
    if (id === undefined || !name.endsWith('.json')) continue
    try {
      const remote = itemOf(await tree.read(object.path))
      if (remote === undefined) {
        failures.push(`${name}：不是本插件的记录格式`)
        continue
      }
      const local = vault.get(remote.id)
      if (!wins(remote, local)) {
        kept += 1
        continue
      }
      await vault.import(remote)
      merged += 1
      for (const attachmentId of remote.attachmentIds) {
        // Only the ones this vault lacks: an attachment already here (its own
        // push, or an earlier merge) is left alone.
        if (vault.getAttachment(attachmentId) === undefined) {
          wanted.set(attachmentId, remote.id)
        }
      }
    } catch (error) {
      failures.push(`${name}：${reasonOf(error)}`)
    }
  }

  for (const [attachmentId, owner] of wanted) {
    try {
      const meta = attachmentOf(await tree.read(`${prefix}/attachments/${attachmentId}.meta.json`))
      if (meta === undefined) {
        failures.push(`附件 ${attachmentId}（记录 ${owner}）：远端没有它的元数据`)
        continue
      }
      const sibling = bytesAt.get(attachmentId)
      if (sibling === undefined) {
        failures.push(`附件 ${attachmentId}（记录 ${owner}）：远端没有它的字节`)
        continue
      }
      const bytes = await tree.read(sibling)
      const name = meta.filename ?? `${attachmentId}.${extensionOfName(sibling)}`
      const stored = meta.mime.startsWith('image/')
        ? await admit.image(bytes, meta.mime, name)
        : await admit.file(bytes, name)
      if (stored === undefined) {
        failures.push(`附件 ${attachmentId}：本机附件仓库拒绝了它`)
        continue
      }
      await vault.importAttachment({ ...meta, storeId: stored.storeId })
      attachments += 1
    } catch (error) {
      failures.push(`附件 ${attachmentId}：${reasonOf(error)}`)
    }
  }

  return { merged, kept, attachments, failures }
}

function extensionOfName(path: string): string {
  return /\.([A-Za-z0-9]{1,8})$/.exec(nameOf(path))?.[1]?.toLowerCase() ?? 'bin'
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The merge, wired for real: read the configuration, build a tree over `sync/`,
 * and hand it to {@link mergeOnce}.
 *
 * Called by every pull the product has (startup, the panel's refresh, 立即同步) so
 * "another device's records show up" does not depend on which button you press.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes go.
 * @returns the counts and the lines worth showing; never throws.
 */
export async function mergeRemote(
  ctx: Context,
  vault: Vault,
  attachments: AttachmentStore,
): Promise<MergeOutcome> {
  const settings = readSettings(ctx)
  const prefix = syncRoot(settings)
  try {
    const tree =
      settings.protocol === 's3'
        ? await s3Tree(ctx, settings)
        : await webdavTree(ctx, settings)
    if (tree === undefined) return { merged: 0, kept: 0, attachments: 0, failures: [] }
    return await mergeOnce(vault, tree, prefix, admitWith(attachments))
  } catch (error) {
    return { merged: 0, kept: 0, attachments: 0, failures: [reasonOf(error)] }
  }
}

/** How bytes become a local attachment: the harness's own admission, either path. */
function admitWith(store: AttachmentStore): Admit {
  return {
    image: async (bytes, mime, name) => {
      if (!(INBOX_IMAGE_TYPES as readonly string[]).includes(mime)) return undefined
      const data = Buffer.from(bytes).toString('base64')
      const [ref] = await admitEncodedImages(store, [
        { mediaType: mime as (typeof INBOX_IMAGE_TYPES)[number], data, name },
      ])
      return ref === undefined ? undefined : { storeId: ref.attachmentId }
    },
    file: async (bytes, name) => {
      const ref = await admitEncodedFile(store, {
        data: Buffer.from(bytes).toString('base64'),
        name,
      })
      return { storeId: ref.attachmentId }
    },
  }
}

async function s3Tree(ctx: Context, settings: WebdavSettings): Promise<SyncTree | undefined> {
  const secret = await readS3Secret(ctx)
  if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) return undefined
  if (secret === undefined) return undefined
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
  return {
    list: async (path) =>
      (await listPrefix(config, path, deps)).map((entry) => ({
        path: entry.key,
        ...(entry.lastModified === undefined ? {} : { lastModified: entry.lastModified }),
      })),
    read: async (path) => (await readObject(config, path, deps)).bytes,
  }
}

async function webdavTree(ctx: Context, settings: WebdavSettings): Promise<SyncTree | undefined> {
  if (settings.baseUrl.trim().length === 0) return undefined
  const password = await readPassword(ctx)
  const deps: WebdavDeps = {
    fetch: webdavFetch,
    ...(settings.username.length === 0 || password === undefined
      ? {}
      : { auth: { username: settings.username, password } }),
    userAgent: activeUserAgent(settings),
  }
  const baseUrl = settings.baseUrl
  return {
    list: async (path) =>
      (await listFolder(baseUrl, path, deps)).map((file) => ({
        path: file.path,
        ...(file.lastModified === undefined ? {} : { lastModified: file.lastModified }),
      })),
    read: async (path) =>
      (await readFile(path, deps, path.startsWith('http') ? path : undefined)).bytes,
  }
}
