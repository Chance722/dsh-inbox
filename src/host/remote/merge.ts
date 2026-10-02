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

import { masterSchema, type Attachment, type Item, type MasterParams } from '../vault/spec.js'
import type { Vault } from '../vault/vault.js'
import { admitEncodedFile, admitEncodedImages, type AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Context } from '@deepseek-ai/cordis'

import { INBOX_IMAGE_TYPES } from '../../shared/panel-wire.js'
import { listPrefix, readObject, type S3Config, type S3Deps } from '../s3/client.js'
import { listFolder, readFile, type WebdavDeps } from '../webdav/client.js'
import { activeUserAgent, readPassword, readS3Secret, readSettings, type WebdavSettings } from '../webdav/config.js'
import { s3Fetch, webdavFetch } from '../webdav/run.js'
import { syncRoot } from './writer.js'

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
  /**
   * How many of {@link merged} arrived as deletions.
   *
   * A deleted record travels as an ordinary record with deletedAt set, so a
   * merge that brings deletions looks exactly like one that brings updates until
   * somebody opens the recycle bin (measured 2026-09-21: 19 merged — 6 new
   * records and 13 tombstones, and the bin went from empty to thirteen).
   */
  deletions: number
  /**
   * How many of {@link merged} were ids this vault did not have at all.
   *
   * "19 records came over" and "the vault grew by 6" are both true at once, and
   * the reader who just watched a number expects them to match (asked
   * 2026-09-21, after merging an abandoned tree whose copies mostly overlapped).
   */
  added: number
  /**
   * Copies of records this vault **emptied out of the bin** — left alone, on
   * purpose, because a purge is not a deletion to be argued with.
   *
   * Counted apart from {@link kept}: "the cloud has a copy you already have" and
   * "the cloud has a copy of something you threw away" are different sentences,
   * and only the second one answers "so why did the emptied records stay empty
   * this time?" (2026-09-21).
   */
  purged: number
  /** Records the remote had and this machine already had, newer or equal. */
  kept: number
  /** Attachment objects pulled down (bytes plus their row). */
  attachments: number
  /** The remote's key parameters were taken over; see `adoptMasterParams`. */
  masterAdopted: boolean
  /** One sentence about the key parameters, when they are the reason to act. */
  masterNote?: string
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

/** The wrapper the master password's parameters travel in. */
interface PackedMaster {
  format?: unknown
  master?: unknown
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

/** Parse one published set of key parameters, refusing anything that is not one. */
function masterOf(bytes: Uint8Array): MasterParams | undefined {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as PackedMaster
    if (parsed.format !== 'dsh-inbox-master/1') return undefined
    const result = masterSchema.safeParse(parsed.master)
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

/**
 * The remote's published key parameters, as a path `read` will accept.
 *
 * **Through the listing, never hand-built.** `SyncTree.read` takes the path the
 * *listing* handed out, because the two protocols disagree about what a path is:
 * S3 answers with the key (`inbox/sync/master.json`), WebDAV with the server's
 * own href (`/dav/inbox/sync/master.json`). A constructed `inbox/sync/master.json`
 * is neither a URL nor a key for WebDAV — the fetch dies on "Failed to parse
 * URL" and the user's one way out of the stuck state goes with it (caught by
 * writing the test below, not by the type checker).
 *
 * @param tree - the remote, as two questions.
 * @param prefix - the sync root being merged.
 * @returns the path to read, or undefined when the remote has not published one.
 */
async function findMasterObject(tree: SyncTree, prefix: string): Promise<string | undefined> {
  const wanted = `${prefix}/master.json`
  for (const object of await tree.list(`${prefix}/`)) {
    if (nameOf(object.path) !== 'master.json') continue
    // Compared without decoding: neither the prefix nor the file name has
    // anything in it that a URL-escaped href would spell differently, and
    // `decodeURIComponent` throws on a stray `%` that a real href can carry.
    if (!object.path.replace(/\/+$/, '').endsWith(wanted)) continue
    return object.path
  }
  return undefined
}

/**
 * Take the remote's key parameters, keeping whatever this machine already has.
 *
 * The other half of "the password works on every machine". The push publishes
 * `sync/master.json`; this picks it up, and the two cases are handled by what
 * the vault already knows:
 *
 * - **Nothing of our own** → adopt: this machine then treats the other one's
 *   password as its master, which is what "已经设了主密码（和另一台保持一致）"
 *   means in the panel.
 * - **A password of our own** → keep it, and remember the other's beside it
 *   (`masterOthers`). Neither side's records are lost: each is opened by the
 *   password that sealed it, and typing both here unlocks both. If the two
 *   machines happen to share one password, that single password matches both
 *   sets in one `unlock` call — nothing special to do.
 *
 * Read whenever this vault is holding sealed records, not only when it has no
 * parameters: "the other machine's parameters are missing" is exactly the state
 * where its records cannot be opened, and that state is reachable from both
 * sides of the conflict.
 *
 * Note what this cannot do: open anything. It moves the salt, the work factors
 * and the sealed constant; the key still has to be derived from a password
 * somebody types.
 *
 * @param vault - the open vault.
 * @param tree - the remote, as two questions.
 * @param prefix - the sync root being merged.
 * @returns whether they were taken, and the sentence the panel should show.
 */
async function adoptMasterParams(
  vault: Vault,
  tree: SyncTree,
  prefix: string,
): Promise<{ adopted: boolean; note?: string }> {
  const state = vault.lockState
  if (state.sealedRecords === 0) return { adopted: false }

  let path: string | undefined
  try {
    path = await findMasterObject(tree, prefix)
  } catch (error) {
    return {
      adopted: false,
      note: `本机有 ${String(state.sealedRecords)} 条密文，但列远端同步目录失败（${reasonOf(error)}）：稍后再拉一次`,
    }
  }
  if (path === undefined) {
    return {
      adopted: false,
      note: `本机有 ${String(state.sealedRecords)} 条密文，远端还没有解锁参数：先在原来那台机器上同步一次`,
    }
  }

  let bytes: Uint8Array
  try {
    bytes = await tree.read(path)
  } catch (error) {
    return {
      adopted: false,
      note: `本机有 ${String(state.sealedRecords)} 条密文，解锁参数取不下来（${reasonOf(error)}）`,
    }
  }

  const parsed = masterOf(bytes)
  if (parsed === undefined) {
    return {
      adopted: false,
      note: `远端的 ${path} 不是本插件的解锁参数格式，${String(state.sealedRecords)} 条密文暂时解不开`,
    }
  }
  if (await vault.adoptMaster(parsed)) {
    return {
      adopted: true,
      note: '已取回解锁参数：现在可以输原来那台机器的主密码',
    }
  }
  if (await vault.adoptOtherMaster(parsed)) {
    return {
      adopted: false,
      note: '已记下另一台机器的解锁参数：它的密文可以用它的密码解开，本机的密码照旧',
    }
  }
  return { adopted: false }
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
 * Whether a copy of a record nobody here has any more is new enough to survive
 * the grave its purge left behind.
 *
 * This is the one place where "no local copy" is not automatically "take it".
 * Emptying the recycle bin is the user saying *gone*, and the copy that shows up
 * afterwards is not a conflict — it is the same record, older, filed by
 * machinery (an older `sync/` tree in the same bucket, a device that has not
 * pulled the tombstone) that has no idea the user threw it away. Without this
 * the startup pull put thirteen of them back into the bin on every restart
 * (measured 2026-09-21).
 *
 * The comparison has the same shape as `wins`, deliberately: strictly newer
 * than the purge wins, everything else is dead. So another device that
 * genuinely *edits* the record after the purge still brings it back — that is a
 * real change, and it is settled by `updatedAt` like every other conflict.
 *
 * @param vault - the vault that holds the graves.
 * @param remote - the copy the cloud is offering.
 * @returns true when the copy is new enough to be taken.
 */
function newerThanPurge(vault: Vault, remote: Item): boolean {
  const purged = vault.purgedAt(remote.id)
  if (purged === undefined) return true
  // An unreadable timestamp is not "newer": `wins` is equally unwilling to
  // settle a comparison it cannot make, and the state it would settle into is
  // "the record the user emptied is back".
  return Date.parse(remote.updatedAt) > Date.parse(purged)
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
  let added = 0
  let deletions = 0
  let purged = 0
  let kept = 0
  let attachments = 0
  let objects: SyncObject[]
  try {
    objects = await tree.list(`${prefix}/items/`)
  } catch (error) {
    return {
      merged: 0,
      added: 0,
      deletions: 0,
      purged: 0,
      kept: 0,
      attachments: 0,
      masterAdopted: false,
      failures: [`列远端同步目录失败：${reasonOf(error)}`],
    }
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
      if (local === undefined && !newerThanPurge(vault, remote)) {
        purged += 1
        continue
      }
      if (!wins(remote, local)) {
        kept += 1
        continue
      }
      await vault.import(remote)
      merged += 1
      if (local === undefined) added += 1
      if (remote.deletedAt !== undefined) deletions += 1
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

  /*
    The key parameters, and only now.

    After the records, not before: the whole reason to read them is to open what
    this pull just filed, and "does this vault hold ciphertext it cannot open"
    is a question whose answer is zero until the loop above has run. Reading them
    first would take a second pull to have any effect — which is exactly the
    kind of one-pull-late bug the user would read as "sync does not work".
  */
  const master = await adoptMasterParams(vault, tree, prefix)

  return {
    merged,
    added,
    deletions,
    purged,
    kept,
    attachments,
    masterAdopted: master.adopted,
    ...(master.note === undefined ? {} : { masterNote: master.note }),
    failures,
  }
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
  /**
   * Further sync trees to merge, on top of this machine's own.
   *
   * The pull hands over the trees it found elsewhere in the bucket (a machine
   * that used to sync under another directory leaves one behind). Each is read
   * exactly like our own: per record, `id` + `updatedAt` decides.
   */
  extraRoots: readonly string[] = [],
): Promise<MergeOutcome> {
  const settings = readSettings(ctx)
  const prefix = syncRoot(settings)
  try {
    const tree =
      settings.protocol === 's3'
        ? await s3Tree(ctx, settings)
        : await webdavTree(ctx, settings)
    if (tree === undefined) {
      return {
        merged: 0,
        added: 0,
        deletions: 0,
        purged: 0,
        kept: 0,
        attachments: 0,
        masterAdopted: false,
        failures: [],
      }
    }
    const admit = admitWith(attachments)
    const outcome = await mergeOnce(vault, tree, prefix, admit)
    for (const root of extraRoots) {
      if (root === prefix) continue
      const extra = await mergeOnce(vault, tree, root, admit)
      outcome.merged += extra.merged
      outcome.added += extra.added
      outcome.deletions += extra.deletions
      outcome.purged += extra.purged
      outcome.kept += extra.kept
      outcome.attachments += extra.attachments
      /*
        A tree that had the parameters decides for the whole pull — the first one
        that is read is the one that matters, because after taking them this
        vault is configured and every later tree's parameters are refused. The
        note travels on the same rule: the first sentence about them is the one
        the user has not already read.
      */
      outcome.masterAdopted = outcome.masterAdopted || extra.masterAdopted
      if (outcome.masterNote === undefined && extra.masterNote !== undefined) {
        outcome.masterNote = extra.masterNote
      }
      outcome.failures.push(...extra.failures)
    }
    return outcome
  } catch (error) {
    return {
      merged: 0,
      added: 0,
      deletions: 0,
      purged: 0,
      kept: 0,
      attachments: 0,
      masterAdopted: false,
      failures: [reasonOf(error)],
    }
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
