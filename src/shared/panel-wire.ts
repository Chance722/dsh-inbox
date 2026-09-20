/**
 * The wire contract between the inbox panel (browser half) and the vault (host
 * half).
 *
 * Types and constants only: the browser bundle must not pull a schema library
 * or a host package (AGENTS.md constraint 11), so runtime validation lives in
 * `src/host/rpc.ts` and the shapes here stay structural.
 *
 * Transport: exact Fetch routes on the shared `/api` channel, registered
 * through `ctx.connection.fetch.register`, which the physical carrier only
 * dispatches after its Host/Origin trust fence and the signed browser cookie.
 * The panel posts with plain same-origin `fetch`; every answer is an
 * `InboxRpcResult`, so a refusal is an answer rather than a crash.
 */

import type { Category, CategorySource, Kind } from './vocabulary.js'

/** Authenticated path prefix every inbox endpoint lives under. */
export const INBOX_API_PREFIX = '/api/inbox'

/** File one submission (text, image bytes, generic file bytes). */
export const INBOX_ENDPOINT_CAPTURE = 'capture'

/** Page through records with filters. */
export const INBOX_ENDPOINT_LIST = 'list'

/** One record in full, including its attachment metadata. */
export const INBOX_ENDPOINT_DETAIL = 'detail'

/** Replace the editable fields of one record. */
export const INBOX_ENDPOINT_UPDATE = 'update'

/** Soft delete (the recycle bin) and undo. */
export const INBOX_ENDPOINT_DELETE = 'delete'
export const INBOX_ENDPOINT_RESTORE = 'restore'

/** Empty the recycle bin for real. */
export const INBOX_ENDPOINT_PURGE = 'purge'

/** Stream one attachment's bytes back to the panel. */
export const INBOX_ENDPOINT_ATTACHMENT = 'attachment'

/** Read or change the WebDAV configuration (the panel's ⚙ form). */
export const INBOX_ENDPOINT_WEBDAV = 'webdav'

/** Pull the remote folder right now, without waiting for the next start. */
export const INBOX_ENDPOINT_PULL = 'pull'

/** Ask the remote a handful of questions and report each answer. */
export const INBOX_ENDPOINT_PROBE = 'probe'

/** Read or write the panel's own preferences (list mode and friends). */
export const INBOX_ENDPOINT_UI = 'ui'

/** Operate on tags across records (currently: drop one everywhere). */
export const INBOX_ENDPOINT_TAGS = 'tags'
export const INBOX_ENDPOINT_SECRET = 'secret'
export const INBOX_ENDPOINT_PUSH = 'push'

/** What the panel sends to `webdav`: read the status, or save a patch. */
export interface WebdavRequest {
  action: 'read' | 'save'
  protocol?: RemoteProtocol
  baseUrl?: string
  directory?: string
  username?: string
  /** Empty string clears the stored password; absent leaves it alone. */
  password?: string
  endpoint?: string
  bucket?: string
  region?: string
  signatureVersion?: string
  accessKeyId?: string
  /** Empty string clears the stored S3 secret; absent leaves it alone. */
  accessKeySecret?: string
  /**
   * Identity sent as `User-Agent` for the protocol in this same patch; empty
   * string means "the plugin's own". Stored per protocol, because the identity
   * belongs to the *credential* and each protocol has its own.
   */
  userAgent?: string
}

/** Which remote protocol the vault pulls from. */
export const REMOTE_PROTOCOLS = ['webdav', 's3'] as const
export type RemoteProtocol = (typeof REMOTE_PROTOCOLS)[number]

/**
 * The non-secret half of the remote configuration.
 *
 * The wire still calls this endpoint `webdav` for historical reasons; it now
 * carries both protocols, and the field below is what decides which.
 */
export interface WebdavSettings {
  /** Which client the pull uses. */
  protocol: RemoteProtocol
  /** WebDAV: base URL, e.g. `https://data.cstcloud.cn/dav`. */
  /** Base URL, e.g. `https://data.cstcloud.cn/dav`. */
  baseUrl: string
  /** Folder under the base URL; the convention every device drops into. */
  directory: string
  username: string
  /** S3: endpoint host, e.g. `https://s3.cstcloud.cn`. */
  endpoint: string
  /** S3: bucket to read from. */
  bucket: string
  /** S3: covered by the signature even when the server ignores it. */
  region: string
  /** S3: only `v4` is implemented; the field exists so the choice is visible. */
  signatureVersion: string
  /** S3: the identifier, which is not a secret. */
  accessKeyId: string
  /**
   * What we call ourselves in the S3 request's `User-Agent` header.
   *
   * Empty means "use the plugin's own identity". Some gateways (数据胶囊 among
   * them) bind an access key to an application and reject every request whose
   * caller does not claim to be that application, so this is a real setting
   * rather than decoration.
   */
  userAgent: string
  /**
   * The same thing for the WebDAV request.
   *
   * A separate value on purpose: the gate is bound to the *credential*, and a
   * user may well have an S3 key bound to one application and a WebDAV account
   * bound to another. Sharing one field made switching protocols silently break
   * both, with an error that reads like a wrong password.
   */
  webdavUserAgent: string
}

/** What the panel needs to render the form and its status. */
export interface WebdavStatus {
  settings: WebdavSettings
  /** Whether the WebDAV password is stored — never the value itself. */
  passwordSet: boolean
  /** Whether the S3 secret is stored — never the value itself. */
  secretSet: boolean
  settingsAvailable: boolean
  credentialsAvailable: boolean
}

/** What one pull did, for the panel and for the log. */
export interface PullResult {
  status: 'ok' | 'unconfigured' | 'failed'
  reason?: string
  pulled: number
  /**
   * Records another device pushed that this one took in (new here, or newer
   * than the local copy). Only the merge half of a pull can produce these.
   */
  merged?: number
  /** Attachment objects the merge had to fetch and admit locally. */
  attachments?: number
  failed: number
  /** Files the server listed but we skipped as already-seen. */
  skipped: number
  /** How many entries the remote listed at all: distinguishes "empty folder"
   * from "everything already ingested". */
  listed: number
  /** Set when the pull completed. */
  lastPullAt?: string
}

/**
 * What one push did.
 *
 * `partial` exists because the useful answer to "did it work" is often "these
 * twelve did, that one attachment could not be read" — a plain ok/failed would
 * have to throw that away.
 */
export interface PushResult {
  status: 'ok' | 'partial' | 'unconfigured' | 'failed'
  reason?: string
  /** Records written to the remote. */
  pushed: number
  /** Attachment objects written alongside them. */
  attachments: number
  /** Records the remote already had, untouched since the last push. */
  skipped: number
  /** Records the push considered (including tombstones). */
  listed: number
  lastPushAt?: string
}

/** One row of the connection self-test. */
export interface ProbeRow {
  label: string
  url: string
  status: number
  detail: string
}

/** What the self-test's rows add up to, in one line. */
export interface ProbeVerdict {
  ok: boolean
  /** The sentence itself, e.g. 「通道可用：v4 精简（只签 host + date）」. */
  title: string
  /** The thing to try next when it is not usable. */
  hint?: string
}

/** The statuses a successful read can come back with (206/207 included). */
function isSuccess(status: number): boolean {
  return status >= 200 && status < 300
}

/**
 * Turn the self-test's rows into one sentence.
 *
 * The matrix below it exists for the day something breaks (it is what tells a
 * gateway's four same-looking refusals apart), but nobody opening 入库设置 wants
 * to read eight rows to learn whether the channel works. This says yes or no,
 * names the shape that worked when there is one, and — when nothing worked —
 * points at the cause the statuses actually imply.
 *
 * @param rows - the self-test's rows, in the order they were tried.
 * @returns the verdict to show above them.
 */
export function probeVerdict(rows: readonly ProbeRow[]): ProbeVerdict {
  if (rows.length === 0) return { ok: false, title: '没有可用的自检结果' }

  const winner = rows.find((row) => isSuccess(row.status))
  if (winner !== undefined) {
    const shape = winner.label.replace(/\s*（[^）]*）\s*/g, '').trim()
    return { ok: true, title: `通道可用（可用形状：${shape}）` }
  }

  const statuses = new Set(rows.map((row) => row.status))
  if (statuses.has(0)) {
    const failed = rows.find((row) => row.status === 0)
    return { ok: false, title: '连不上', hint: failed?.detail ?? '' }
  }
  if (statuses.size === 1 && statuses.has(401)) {
    return {
      ok: false,
      title: '认证被拒（每一行都是 401）',
      hint: '不是签名写法的问题：把「客户端标识」填成 AccessKey 绑定的应用名（数据胶囊控制台里创建 key 时选的那个），或者换一次密钥，再自检。',
    }
  }
  if (statuses.size === 1 && statuses.has(403)) {
    return {
      ok: false,
      title: '权限被拒（每一行都是 403）',
      hint: '密钥认出来了，但不允许这个操作：检查桶/目录的授权，以及客户端标识是否与该 AccessKey 绑定的应用一致。',
    }
  }
  if (statuses.size === 1 && statuses.has(404)) {
    return { ok: false, title: '路径不存在（每一行都是 404）', hint: '检查桶名、endpoint 与目录前缀。' }
  }
  const first = rows[0]?.status ?? 0
  return {
    ok: false,
    title: `通道不可用（收到的状态：${[...statuses].join(' / ')}）`,
    hint: `逐行看下面的详情；第一行是 ${String(first)}。`,
  }
}

/** Raster formats dsh's own attachment store accepts, and we therefore pass through. */
export const INBOX_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type InboxImageType = (typeof INBOX_IMAGE_TYPES)[number]

/** One browser-submitted image: base64 bytes plus the declared media type. */
export interface WireImage {
  mediaType: InboxImageType
  data: string
  name?: string
}

/** One browser-submitted generic file, stored byte-for-byte. */
export interface WireFile {
  data: string
  name?: string
  /**
   * What the browser said this file is, when it said anything.
   *
   * Kept only for media the panel can render (`video/*`, `audio/*`): a generic
   * file's bytes are stored verbatim on the file path, and the media type the
   * panel later serves them with has to be one that cannot execute — an
   * attacker-declared `text/html` or `image/svg+xml` served from the panel's own
   * origin would be a script injection, which is why the host allowlists this
   * instead of trusting it.
   */
  mediaType?: string
}

/** Everything one panel submission can carry. */
export interface CaptureRequest {
  text?: string
  images?: WireImage[]
  files?: WireFile[]
}

/** How many records a submission stored, and how many merged into existing ones. */
export interface CaptureResult {
  stored: number
  /** Records that absorbed this capture instead of a new one being written. */
  merged: number
  /**
   * The subset of `merged` that was sitting in the recycle bin and came back
   * out — a repeat that *does* change the list, and says something different.
   */
  restored: number
}

/** Which shelf a list is asking about. */
export type ListScope = 'live' | 'bin'

/** Filters and paging for one list call. */
export interface ListRequest {
  scope?: ListScope
  categories?: Category[]
  /** Filter to the records the user flagged for later. */
  watchLater?: boolean
  kinds?: Kind[]
  /** Every listed tag must be present. */
  tags?: string[]
  /** Case-insensitive substring over title, text, url, note and tags. */
  text?: string
  limit?: number
  offset?: number
}

/** One row of the panel's list. */
export interface EntrySummary {
  id: string
  kind: Kind
  category: Category
  /** Who chose the category; absent on records written before M5. */
  categorySource?: CategorySource
  /**
   * The one flag the user manages himself: "I want to come back to this".
   *
   * Replaces the old read/unread pair, which claimed to know something the
   * software cannot know and made every capture start life as "unread".
   */
  watchLater: boolean
  title?: string
  /**
   * The headline fetched from the link's own page, when there is one.
   *
   * Second only to a name the user typed, and never a substitute for one: this
   * is somebody else's words, so the pane keeps showing which is which.
   */
  linkTitle?: string
  /**
   * Why no headline arrived, as a short code (`network:…`, `http:404`,
   * `not-html:…`, `no-title`). The pane translates it — a link that quietly
   * keeps its URL looks like a broken feature rather than a site that refused.
   */
  linkTitleError?: string
  /**
   * The file name the record arrived with, when it has one.
   *
   * A picture or a file carries no text of its own, so without this its row has
   * nothing to be called but 「（无标题）」 — which is what an uploaded photo used
   * to show. It is a **fallback, never an override**: a name the user typed wins
   * over it, and a credential record ignores it entirely (its heading is fixed;
   * see `src/client/heading.ts`).
   */
  attachmentName?: string
  /** A short excerpt of the stored text, already trimmed by the host. */
  preview?: string
  url?: string
  platform?: string
  note?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  /** How many attachments the record references. */
  attachmentCount: number
  /**
   * The first attachment the panel can render itself — the card's picture.
   *
   * Not just pictures any more: a video or an audio file gets a play tile in the
   * same slot and opens in the panel's own lightbox. `previewMime` says which of
   * the three it is, because the card has to draw it differently — and because a
   * `<video>` needs to know it is one before it fetches the bytes.
   */
  previewId?: string
  /** That attachment's MIME type: `image/*`, `video/*` or `audio/*`. */
  previewMime?: string
  /** Present while the record sits in the recycle bin. */
  deletedAt?: string
}

/** One attachment's metadata, as the detail view shows it. */
export interface AttachmentSummary {
  id: string
  mime: string
  bytes: number
  filename?: string
  width?: number
  height?: number
  /** True when the panel can render a thumbnail through the attachment route. */
  image: boolean
}

/** One record in full. */
export interface EntryDetail extends EntrySummary {
  text?: string
  attachments: AttachmentSummary[]
}

/** A filter value and how many records carry it. */
export interface FacetCount<T> {
  value: T
  count: number
}

/** One page of records plus the numbers the header and filter bar show. */
export interface ListResult {
  entries: EntrySummary[]
  /** Records matching the filters, paging ignored. */
  matched: number
  /** Live records overall. */
  total: number
  /** Live records flagged 待看, overall. */
  watchLater: number
  /** Records sitting in the recycle bin. */
  deleted: number
  /** Facets are computed over live records only. */
  categories: FacetCount<Category>[]
  tags: FacetCount<string>[]
}

export interface DetailRequest {
  id: string
}

export interface DetailResult {
  entry: EntryDetail
}

/** The editable fields. Omitted fields keep their stored value. */
export interface UpdateRequest {
  id: string
  category?: Category
  watchLater?: boolean
  note?: string
  title?: string
  tags?: string[]
}

export interface UpdateResult {
  entry: EntrySummary
}

/** How the vault's key stands, and what the panel may do about it. */
export interface SecretStatus {
  /** A master password exists. Without one, nothing can be sealed. */
  configured: boolean
  /** The key is in this process's memory: credentials can be read and written. */
  unlocked: boolean
  /**
   * How many credentials the last unlock moved out of plain text. Zero most of
   * the time; non-zero exactly once, on the unlock after this feature arrived.
   */
  sealed?: number
}

/**
 * What the panel sends to `secret`.
 *
 * `password` travels over the panel's own token-fenced route and is used to
 * derive a key in memory; it is never written anywhere, which is why unlocking
 * is something the user does again after every restart.
 */
export interface SecretRequest {
  action: 'status' | 'set' | 'unlock' | 'lock'
  password?: string
}

export interface IdRequest {
  id: string
}

export interface IdResult {
  entry: EntrySummary
}

export interface PurgeResult {
  removed: number
  /** Objects the same cleanup deleted from the remote, when one is configured. */
  remoteRemoved?: number
  /** True when there is no remote configured — nothing to clean up there. */
  remoteSkipped?: boolean
  /** What the remote deletion could not do. */
  reason?: string
}

/** Carrier-neutral failure, mirroring Connection's `ConnectionRpcFailure`. */
export interface InboxRpcFailure {
  code: string
  message: string
  details: Record<string, unknown>
}

/** Business outcome of one call: a refused request is an answer, not a crash. */
export type InboxRpcResult<T> = { ok: true; value: T } | { ok: false; error: InboxRpcFailure }

/** How many records one page holds. */
export const LIST_LIMIT = 50

/**
 * How many records the panel asks for at a time.
 *
 * Twelve, not fifty: the list is made of cards now, and a page that has to be
 * scrolled twice before you see the pager is a page you cannot count.
 */
export const PAGE_SIZE = 12

/**
 * The two list densities the panel offers.
 *
 * There used to be a third (`rows`, one wide card per line). It went when the
 * user pointed out that the type badge it led with repeated what the metadata
 * line already said, and that two densities cover both habits: `grid` for
 * pictures, `compact` for volume. A stored `rows` is no longer a value this
 * list accepts, so readers fall back to the default — which is `grid`.
 */
export const UI_LIST_MODES = ['grid', 'compact'] as const
export type UiListMode = (typeof UI_LIST_MODES)[number]

/** What the panel remembers about itself. */
export interface UiPrefs {
  /** How the record list is laid out. */
  listMode: UiListMode
}

/** What the panel sends to `ui`: read the preferences, or change them. */
export interface UiRequest {
  action: 'read' | 'save'
  listMode?: UiListMode
}

/** What the panel sends to `tags`. */
export interface TagRequest {
  action: 'remove'
  /** The exact tag to strip from every record that carries it. */
  tag: string
}

/** How much stored text a list row shows before the panel truncates it. */
export const PREVIEW_CHARS = 140

/** Most attachments one submission may carry; mirrors the composer's own ceiling. */
export const MAX_ATTACHMENTS_PER_SUBMISSION = 20

/** Ceiling on the user's own note, so one edit cannot bloat the domain. */
export const MAX_NOTE_CHARS = 2_000

/** Tag limits: a filter list nobody can read is worse than no tags. */
export const MAX_TAGS = 20
export const MAX_TAG_CHARS = 40

/** Ceiling on one filter's free text. */
export const MAX_FILTER_CHARS = 200

/**
 * Ceiling on the name a user gives a record.
 *
 * It is a heading, not a document: the ceiling is here so a runaway paste into
 * the name field cannot bloat the domain, and the card ellipsises long before
 * this number is ever reached.
 */
export const MAX_TITLE_CHARS = 300
