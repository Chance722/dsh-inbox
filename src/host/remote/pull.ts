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

import {
  INBOX_IMAGE_TYPES,
  syncDirectory,
  syncRootFor,
  type PullResult,
} from '../../shared/panel-wire.js'
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
 * The `…/sync` prefix a remote path carries, if it carries one.
 *
 * Only the two segments ending at `sync` are kept, so a WebDAV href
 * (`/dav/inbox/sync/items/x.json`) and an S3 key (`inbox/sync/items/x.json`)
 * both answer `inbox/sync`. That is what lets this machine tell its own upload
 * queue apart from a **different** one: another machine with another directory
 * writes `inbox/sync/...` while this one writes `sync/...`, and until now both
 * were silently skipped as "ours" (measured 2026-09-20).
 *
 * @param path - the remote path or key.
 * @returns the prefix, or undefined when the path is not in any sync area.
 */
function syncPrefixOf(path: string): string | undefined {
  const parts = path.split('/').filter((part) => part.length > 0)
  const at = parts.lastIndexOf('sync')
  if (at === -1) return undefined
  return parts.slice(0, at + 1).slice(-2).join('/')
}

/** The later of two optional ISO timestamps, tolerating either being absent. */
function laterOf(current: string | undefined, candidate: string | undefined): string | undefined {
  if (candidate === undefined) return current
  if (current === undefined) return candidate
  return Date.parse(candidate) > Date.parse(current) ? candidate : current
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
  /** This machine's own sync root; anything else under `sync/` is a stranger. */
  syncRoot: string = syncRootFor(undefined),
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
  /**
   * Why the skipped ones were skipped.
   *
   * "跳过 77" on its own is unanswerable — "our own upload queue" and "older
   * than the last pull" are different facts, and only the second one is a
   * surprise. Measured 2026-09-20: a push from another machine came back as
   * "列出 78 / 跳过 77 / 失败 1" and the number alone said nothing about which
   * it was.
   */
  let skippedSync = 0
  let skippedOlder = 0
  let skippedForeign = 0
  /**
   * What the cloud holds, in the unit a person thinks in.
   *
   * "远端列出 78 项" is an object count: one record is `items/<id>.json` plus
   * its `.txt`, and a record with a picture adds the attachment *and* that
   * attachment's `.meta.json`. Seven records therefore look like thirty
   * objects, and the number the reader actually wants — how many records the
   * cloud has — was nowhere on the line (asked 2026-09-21). Counted from the
   * listing we already walk, so it costs nothing extra.
   */
  let remoteRecords = 0
  let remoteAttachments = 0
  /** Other machines' sync roots, in the order the listing revealed them. */
  const foreignSyncRoots = new Set<string>()
  /**
   * The newest entry that actually worked.
   *
   * The cursor used to jump to "now" whatever happened, which meant a file that
   * failed once — a hiccup mid-download — was never looked at again, because it
   * was suddenly older than the cursor. Advancing only as far as the last
   * *success* leaves the failures newer than the cursor, so the next pull
   * retries them (and re-ingesting a file twice is harmless: repeats merge).
   */
  let newestSuccess: string | undefined
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
    const prefix = syncPrefixOf(entry.path)
    if (prefix !== undefined && prefix !== syncRoot) {
      // Someone else's upload queue: never ingest it as files (its records are
      // already records), but say so instead of folding it into "skipped".
      skipped += 1
      skippedForeign += 1
      foreignSyncRoots.add(prefix)
      continue
    }
    if (prefix !== undefined) {
      skipped += 1
      skippedSync += 1
      const parts = entry.path.split('/').filter((part) => part.length > 0)
      const folder = parts[parts.length - 2] ?? ''
      const name = parts[parts.length - 1] ?? ''
      if (folder === 'items' && name.endsWith('.json')) remoteRecords += 1
      else if (folder === 'attachments' && !name.endsWith('.meta.json')) remoteAttachments += 1
      continue
    }
    if (!isNewer(entry, lastPullAt)) {
      skipped += 1
      skippedOlder += 1
      continue
    }
    const name = nameOf(entry.path)
    try {
      const finished = entry.lastModified
      const fetched = await source.read(entry)

      if (looksTextual(name, entry.contentType ?? fetched.contentType)) {
        await captureText(vault, new TextDecoder().decode(fetched.bytes), 'webdav')
        pulled += 1
        newestSuccess = laterOf(newestSuccess, finished)
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
          newestSuccess = laterOf(newestSuccess, finished)
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
      newestSuccess = laterOf(newestSuccess, finished)
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
  // Nothing succeeded and something failed: leave the cursor where it was, so
  // the next pull tries again instead of skipping the whole folder.
  const cursor = failed > 0 && newestSuccess === undefined ? lastPullAt : (newestSuccess ?? now)
  await vault.setSync({ ...vault.global.sync, lastPullAt: cursor })
  return {
    status: 'ok',
    pulled,
    failed,
    skipped,
    skippedSync,
    skippedOlder,
    skippedForeign,
    remoteRecords,
    remoteAttachments,
    syncRoot,
    ...(foreignSyncRoots.size === 0 ? {} : { foreignSyncRoots: [...foreignSyncRoots] }),
    listed,
    lastPullAt: cursor,
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
  // `/` and "never set" both mean the default directory — the same rule the
  // writer and the merge use, so the three cannot disagree about where `sync/` is.
  const directory = `/${syncDirectory(config.directory ?? DEFAULT_DIRECTORY)}`

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
    // WebDAV resolves the sync root from the same directory rule the writer uses.
    syncRootFor(config.directory),
  )
}

/**
 * Pull over S3.
 *
 * @param directory - the configured directory, exactly as the settings hold it.
 *   `/`, an empty string and "never set" all mean the default; the listing is
 *   scoped to it and the vault's own tree is `<directory>/sync`.
 *
 * This used to be handed the sync root as the *listing* prefix, and to treat
 * that same string as "ours": with S3 every object the vault had uploaded
 * therefore answered to a prefix that was not ours, so the panel reported
 * 「自己的同步对象 0 项」 and warned about another machine's directory — which was
 * this machine's own (measured 2026-09-21, a bucket holding both `sync/…` from
 * the older build and `inbox/sync/…` from this one).
 */
export async function pullS3(
  vault: Vault,
  config: S3Config,
  directory: string | undefined,
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

  /** The directory to list: `inbox` for `/`, `''` and "unset" alike. */
  const scope = syncDirectory(directory)
  return ingestFrom(
    vault,
    {
      list: async () =>
        (await listPrefix(config, `${scope}/`, deps)).map((object) => ({
          path: object.key,
          ...(object.lastModified === undefined ? {} : { lastModified: object.lastModified }),
        })),
      read: async (entry) => readObject(config, entry.path, deps),
    },
    deps.attachments,
    // The vault's own tree, resolved by the same rule the writer uses.
    syncRootFor(directory),
  )
}
