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
  failed: number
  /** Files the server listed but we skipped as already-seen. */
  skipped: number
  /** How many entries the remote listed at all: distinguishes "empty folder"
   * from "everything already ingested". */
  listed: number
  /** Set when the pull completed. */
  lastPullAt?: string
}

/** One row of the connection self-test. */
export interface ProbeRow {
  label: string
  url: string
  status: number
  detail: string
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
  merged: number
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
  /** The first image attachment, when the record has one — the card's picture. */
  thumbnailId?: string
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

export interface IdRequest {
  id: string
}

export interface IdResult {
  entry: EntrySummary
}

export interface PurgeResult {
  removed: number
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
