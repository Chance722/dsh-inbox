/**
 * One-way ingest: whatever other devices dropped into the remote `inbox/`
 * folder becomes vault records.
 *
 * Deliberately one-way. Pulling only, never pushing, is what keeps this simple
 * enough to be trustworthy: there is no merge to get wrong, and the phone never
 * has to understand the vault.
 *
 * Repeat safety comes from content addressing rather than bookkeeping: pulling
 * the same bytes twice produces the same attachment id, and the capture path
 * merges it into the record that already exists. `lastPullAt` is only a cheap
 * filter so a startup does not re-download everything.
 */

import { admitEncodedFile, admitEncodedImages, type AttachmentStore } from '@deepseek-ai/dsh-attachment'

import { INBOX_IMAGE_TYPES } from '../../shared/panel-wire.js'
import { captureImage, captureText } from '../capture.js'
import type { Vault } from '../vault/vault.js'
import { listFolder, readFile, type RemoteFile, type WebdavDeps } from './client.js'

/** What the user configures. The password never lives here — see M6b. */
export interface WebdavConfig {
  /** Base URL, e.g. `https://data.cstcloud.cn/dav`. */
  baseUrl: string
  /** Folder under the base URL. */
  directory?: string
  username?: string
}

/** What one pull did, for the panel and for the log. */
export interface PullResult {
  status: 'ok' | 'unconfigured' | 'failed'
  reason?: string
  pulled: number
  failed: number
  /** Files the server listed but we skipped as already-seen. */
  skipped: number
  /** Set when the pull completed. */
  lastPullAt?: string
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

/** The file name out of a WebDAV href. */
function nameOf(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0)
  return decodeURIComponent(parts[parts.length - 1] ?? path)
}

/** Whether a listing entry is newer than the last pull. */
function isNewer(file: RemoteFile, lastPullAt: string | undefined): boolean {
  if (lastPullAt === undefined) return true
  if (file.lastModified === undefined) return true
  const seen = Date.parse(lastPullAt)
  const remote = Date.parse(file.lastModified)
  if (Number.isNaN(seen) || Number.isNaN(remote)) return true
  return remote > seen
}

/**
 * Pull the remote folder once and file everything new.
 *
 * Never throws: a broken WebDAV server must not stop the harness from starting,
 * so every failure becomes a `failed` result the caller can show.
 *
 * @param vault - the open vault.
 * @param config - where to pull from.
 * @param deps - fetch, optional auth, and the attachment store for bytes.
 * @returns what happened.
 */
export async function pullRemote(
  vault: Vault,
  config: WebdavConfig,
  deps: WebdavDeps & { attachments: AttachmentStore },
): Promise<PullResult> {
  const baseUrl = config.baseUrl.trim()
  if (baseUrl.length === 0) {
    return { status: 'unconfigured', reason: '还没配置 WebDAV 地址', pulled: 0, failed: 0, skipped: 0 }
  }

  const directory = config.directory ?? DEFAULT_DIRECTORY
  const lastPullAt = vault.global.sync.lastPullAt

  let files: RemoteFile[]
  try {
    files = await listFolder(baseUrl, directory, deps)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { status: 'failed', reason, pulled: 0, failed: 0, skipped: 0 }
  }

  let pulled = 0
  let failed = 0
  let skipped = 0

  for (const file of files) {
    if (!isNewer(file, lastPullAt)) {
      skipped += 1
      continue
    }
    const name = nameOf(file.path)
    try {
      const url = file.path.startsWith('http') ? file.path : undefined
      const fetched = await readFile(file.path, deps, url)

      if (looksTextual(name, file.contentType ?? fetched.contentType)) {
        await captureText(vault, new TextDecoder().decode(fetched.bytes), 'webdav')
        pulled += 1
        continue
      }

      const data = Buffer.from(fetched.bytes).toString('base64')
      const mediaType = file.contentType ?? fetched.contentType
      const isImage = (INBOX_IMAGE_TYPES as readonly string[]).includes(mediaType)
      if (isImage) {
        const [ref] = await admitEncodedImages(deps.attachments, [
          { mediaType: mediaType as (typeof INBOX_IMAGE_TYPES)[number], data, name },
        ])
        if (ref !== undefined) {
          await captureImage(
            vault,
            { id: ref.attachmentId, mime: ref.mediaType, bytes: ref.bytes, width: ref.width, height: ref.height, filename: name },
            'webdav',
          )
          pulled += 1
          continue
        }
      }

      const ref = await admitEncodedFile(deps.attachments, { data, name })
      await captureImage(
        vault,
        { id: ref.attachmentId, mime: mediaType, bytes: ref.bytes, filename: name },
        'webdav',
      )
      pulled += 1
    } catch {
      // One bad file must not stop the rest; the counter is what the panel shows.
      failed += 1
    }
  }

  const now = new Date().toISOString()
  await vault.setSync({ ...vault.global.sync, lastPullAt: now })
  return { status: 'ok', pulled, failed, skipped, lastPullAt: now }
}
