/**
 * Deleting on the remote what the user deleted here.
 *
 * "Delete" has two very different meanings in this vault, and the merge made the
 * difference visible: a **soft delete** is a tombstone that travels, so other
 * devices learn about it; **emptying the recycle bin** is the user saying "gone",
 * and until this module existed it was only gone locally — the next pull brought
 * it back from the cloud.
 *
 * Deletion is targeted, never a sweep. A blind "delete whatever is not in my
 * vault" pass would remove another device's objects that this one simply has not
 * merged yet, which is data loss dressed as housekeeping.
 */

import type { Context } from '@deepseek-ai/cordis'

import type { Attachment } from '../vault/spec.js'
import { extensionOf } from './push.js'
import { remoteWriter } from './writer.js'

/** What the caller removed locally, so the same things can go from the cloud. */
export interface RemovedRecords {
  /** Record ids that no longer exist locally. */
  itemIds: readonly string[]
  /**
   * Attachment rows that no local record references any more.
   *
   * The row itself is needed, not just its id: the object's name carries an
   * extension derived from the file's own name and media type.
   */
  attachments: readonly Attachment[]
}

/** What one cleanup did. */
export interface RemoveOutcome {
  /** Objects deleted from the remote. */
  removed: number
  /** Things that went wrong, one line each. */
  failures: string[]
  /** Set when there is no remote to talk to — not an error, just nothing to do. */
  skipped?: boolean
}

/**
 * Remove the remote copies of records the user emptied out of the bin.
 *
 * Three objects per record at most: the machine-readable `.json`, the readable
 * `.txt`, and — for an attachment no other record still points at — its bytes
 * and its metadata row. The extension-less name is attempted too: objects
 * written before attachments carried extensions are exactly this shape, and this
 * is the only pass that will ever clean them up.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param removed - what was just deleted locally.
 * @returns how many objects went, and what could not.
 */
export async function removeRemoteRecords(
  ctx: Context,
  removed: RemovedRecords,
): Promise<RemoveOutcome> {
  if (removed.itemIds.length === 0 && removed.attachments.length === 0) {
    return { removed: 0, failures: [] }
  }

  const connection = await remoteWriter(ctx)
  if (connection.status !== 'ok') {
    // A missing remote is not a failure of the deletion — the local one already
    // happened, and the caller says so.
    return { removed: 0, failures: [], skipped: true }
  }
  return removeWith(connection.writer, connection.root, removed)
}

/**
 * The deletion itself, with the transport injected.

 * Split out the way the push and the merge are, so the naming rule — which
 * objects one record owns, and that an attachment's pre-extension name is asked
 * for too — is testable without a server.
 *
 * @param writer - one write/remove pair for the configured remote.
 * @param root - the sync root inside the configured directory.
 * @param removed - what was just deleted locally.
 * @returns how many objects went, and what could not.
 */
export async function removeWith(
  writer: { remove(path: string): Promise<void> },
  root: string,
  removed: RemovedRecords,
): Promise<RemoveOutcome> {
  const failures: string[] = []
  let removedCount = 0

  const drop = async (path: string): Promise<void> => {
    try {
      await writer.remove(path)
      removedCount += 1
    } catch (error) {
      failures.push(`${path}：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const id of removed.itemIds) {
    await drop(`${root}/items/${id}.json`)
    await drop(`${root}/items/${id}.txt`)
  }

  for (const record of removed.attachments) {
    await drop(`${root}/attachments/${record.id}.${extensionOf(record.filename, record.mime)}`)
    await drop(`${root}/attachments/${record.id}.meta.json`)
    // The pre-extension naming: harmless when it is not there.
    await drop(`${root}/attachments/${record.id}`)
  }

  return { removed: removedCount, failures }
}
