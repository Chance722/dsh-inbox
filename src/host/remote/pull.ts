/**
 * One-way ingest, whatever the remote happens to speak.
 *
 * The protocol lives behind `RemoteSource`: WebDAV and S3 each know how to list
 * and read, and everything else — which file is new, what counts as text, how a
 * repeat is merged, what a failure looks like — happens exactly once, here.
 * Two copies of that logic would drift, and the drifting copy would be the one
 * that quietly files something twice.
 *
 * Deliberately one-way. Pulling only, never pushing, is what keeps this simple
 * enough to be trustworthy: there is no merge to get wrong, and the phone never
 * has to understand the vault.
 */

import { admitEncodedFile, admitEncodedImages, type AttachmentStore } from '@deepseek-ai/dsh-attachment'

import { INBOX_IMAGE_TYPES, type PullResult } from '../../shared/panel-wire.js'
import { captureImage, captureText } from '../capture.js'
import type { S3Config, S3Deps } from '../s3/client.js'
import { listPrefix, readObject } from '../s3/client.js'
import type { Vault } from '../vault/vault.js'
import { listFolder, readFile, type WebdavDeps } from '../webdav/client.js'

export type { PullResult } from '../../shared/panel-wire.js'

/** One thing a remote offers to pull. */
export interface RemoteEntry {
  /** Remote path or key; also the display name's source. */
  path: string
  lastModified?: string
  contentType?: string
}

/** What the ingest needs from a remote, and nothing more. */
export interface RemoteSource {
  list(): Promise<RemoteEntry[]>
  read(entry: RemoteEntry): Promise<{ bytes: Uint8Array; contentType: string }>
}

const DEFAULT_DIRECTORY = '/inbox'

/** Text-ish remote files are read as text, so a copied link stays a link. */
const TEXT_TYPES = ['text/', 'application/json']
const TEXT_SUFFIXES = ['.txt', '.md', '.url', '.json']

function looksTextual(name: string, contentType: string | undefined): boolean {
  const lower = name.toLowerCase()
  if (TEXT_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true
  return contentType !== undefined && TEXT_TYPES.some((prefix) => contentType.startsWith(prefix))
}

/**
 * Whether a remote path belongs to the vault's own upload queue.
 *
 * Matched anywhere in the path, not just at the root: the configured directory
 * is whatever the user typed, and the sync root sits under it.
 *
 * @param path - the remote path or key.
 * @returns true when this is something the push wrote.
 */
function isSyncObject(path: string): boolean {
  return path.split('/').some((part) => part === 'sync')
}

/** The file name out of a remote path or key. */
function nameOf(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0)
  return decodeURIComponent(parts[parts.length - 1] ?? path)
}

/** Whether an entry is newer than the last pull. */
function isNewer(entry: RemoteEntry, lastPullAt: string | undefined): boolean {
  if (lastPullAt === undefined) return true
  if (entry.lastModified === undefined) return true
  const seen = Date.parse(lastPullAt)
  const remote = Date.parse(entry.lastModified)
  if (Number.isNaN(seen) || Number.isNaN(remote)) return true
  return remote > seen
}

/**
 * Pull one remote and file everything new.
 *
 * Never throws: a remote that is down must not stop the harness from starting,
 * so every failure becomes a `failed` result the caller can show.
 *
 * @param vault - the open vault.
 * @param source - the protocol-specific read side.
 * @param attachments - the store that owns pulled bytes.
 * @returns what happened.
 */
export async function ingestFrom(
  vault: Vault,
  source: RemoteSource,
  attachments: AttachmentStore,
): Promise<PullResult> {
  const lastPullAt = vault.global.sync.lastPullAt

  let entries: RemoteEntry[]
  try {
    entries = await source.list()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { status: 'failed', reason, pulled: 0, failed: 0, skipped: 0, listed: 0 }
  }

  const listed = entries.length
  let pulled = 0
  let failed = 0
  let skipped = 0
  /** Why the entries that failed failed; the panel shows the first few. */
  const failures: string[] = []

  for (const entry of entries) {
    /*
      Never eat our own upload queue.

      The push writes records to `<prefix>/sync/items/*.json`, and a remote
      listing is recursive (S3 lists by prefix; WebDAV hands back collections).
      Without this guard the next pull re-captures everything the vault just
      uploaded — the same records, again, as pasted text.
    */
    if (isSyncObject(entry.path)) {
      skipped += 1
      continue
    }
    if (!isNewer(entry, lastPullAt)) {
      skipped += 1
      continue
    }
    const name = nameOf(entry.path)
    try {
      const fetched = await source.read(entry)

      if (looksTextual(name, entry.contentType ?? fetched.contentType)) {
        await captureText(vault, new TextDecoder().decode(fetched.bytes), 'webdav')
        pulled += 1
        continue
      }

      const data = Buffer.from(fetched.bytes).toString('base64')
      const mediaType = entry.contentType ?? fetched.contentType
      if ((INBOX_IMAGE_TYPES as readonly string[]).includes(mediaType)) {
        const [ref] = await admitEncodedImages(attachments, [
          { mediaType: mediaType as (typeof INBOX_IMAGE_TYPES)[number], data, name },
        ])
        if (ref !== undefined) {
          await captureImage(
            vault,
            {
              id: ref.attachmentId,
              mime: ref.mediaType,
              bytes: ref.bytes,
              width: ref.width,
              height: ref.height,
              filename: name,
            },
            'webdav',
          )
          pulled += 1
          continue
        }
      }

      const ref = await admitEncodedFile(attachments, { data, name })
      await captureImage(
        vault,
        { id: ref.attachmentId, mime: mediaType, bytes: ref.bytes, filename: name },
        'webdav',
      )
      pulled += 1
    } catch (error) {
      /*
        One bad file must not stop the rest — but it must not vanish either.
        "failed: 1" with no name is a number nobody can act on; the first few
        names go back to the panel, and the real reason goes to the log.
      */
      failed += 1
      failures.push(`${name}：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const now = new Date().toISOString()
  await vault.setSync({ ...vault.global.sync, lastPullAt: now })
  return {
    status: 'ok',
    pulled,
    failed,
    skipped,
    listed,
    lastPullAt: now,
    ...(failures.length === 0 ? {} : { reason: failures.slice(0, 3).join('；') }),
  }
}

/** What the user configures for WebDAV. */
export interface WebdavConfig {
  baseUrl: string
  directory?: string
  username?: string
}

/** Pull over WebDAV. */
export async function pullRemote(
  vault: Vault,
  config: WebdavConfig,
  deps: WebdavDeps & { attachments: AttachmentStore },
): Promise<PullResult> {
  const baseUrl = config.baseUrl.trim()
  if (baseUrl.length === 0) {
    return {
      status: 'unconfigured',
      reason: '还没配置 WebDAV 地址',
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0,
    }
  }
  const directory = config.directory ?? DEFAULT_DIRECTORY

  return ingestFrom(
    vault,
    {
      list: async () => (await listFolder(baseUrl, directory, deps)).map((file) => ({
        path: file.path,
        ...(file.lastModified === undefined ? {} : { lastModified: file.lastModified }),
        ...(file.contentType === undefined ? {} : { contentType: file.contentType }),
      })),
      read: async (entry) =>
        readFile(entry.path, deps, entry.path.startsWith('http') ? entry.path : undefined),
    },
    deps.attachments,
  )
}

/** Pull over S3. */
export async function pullS3(
  vault: Vault,
  config: S3Config,
  prefix: string,
  deps: S3Deps & { attachments: AttachmentStore },
): Promise<PullResult> {
  if (config.endpoint.trim().length === 0 || config.bucket.trim().length === 0) {
    return {
      status: 'unconfigured',
      reason: '还没配置 S3 的 endpoint 或 bucket',
      pulled: 0,
      failed: 0,
      skipped: 0,
      listed: 0,
    }
  }

  return ingestFrom(
    vault,
    {
      list: async () =>
        (await listPrefix(config, prefix, deps)).map((object) => ({
          path: object.key,
          ...(object.lastModified === undefined ? {} : { lastModified: object.lastModified }),
        })),
      read: async (entry) => readObject(config, entry.path, deps),
    },
    deps.attachments,
  )
}
