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
import type { Category, CategorySource, Kind } from './vocabulary.js';
/** Authenticated path prefix every inbox endpoint lives under. */
export declare const INBOX_API_PREFIX = "/api/inbox";
/** File one submission (text, image bytes, generic file bytes). */
export declare const INBOX_ENDPOINT_CAPTURE = "capture";
/** Page through records with filters. */
export declare const INBOX_ENDPOINT_LIST = "list";
/** One record in full, including its attachment metadata. */
export declare const INBOX_ENDPOINT_DETAIL = "detail";
/** Replace the editable fields of one record. */
export declare const INBOX_ENDPOINT_UPDATE = "update";
/** Soft delete (the recycle bin) and undo. */
export declare const INBOX_ENDPOINT_DELETE = "delete";
export declare const INBOX_ENDPOINT_RESTORE = "restore";
/** Empty the recycle bin for real. */
export declare const INBOX_ENDPOINT_PURGE = "purge";
/** Stream one attachment's bytes back to the panel. */
export declare const INBOX_ENDPOINT_ATTACHMENT = "attachment";
/** Read or change the WebDAV configuration (the panel's ⚙ form). */
export declare const INBOX_ENDPOINT_WEBDAV = "webdav";
/** Pull the remote folder right now, without waiting for the next start. */
export declare const INBOX_ENDPOINT_PULL = "pull";
/** Ask the remote a handful of questions and report each answer. */
export declare const INBOX_ENDPOINT_PROBE = "probe";
/** Read or write the panel's own preferences (list mode and friends). */
export declare const INBOX_ENDPOINT_UI = "ui";
/** Operate on tags across records (currently: drop one everywhere). */
export declare const INBOX_ENDPOINT_TAGS = "tags";
export declare const INBOX_ENDPOINT_SECRET = "secret";
export declare const INBOX_ENDPOINT_PUSH = "push";
/** What the panel sends to `webdav`: read the status, or save a patch. */
export interface WebdavRequest {
    action: 'read' | 'save';
    protocol?: RemoteProtocol;
    baseUrl?: string;
    directory?: string;
    /** Merge other sync trees in the same bucket, not just this directory's. */
    adoptForeignRoots?: boolean;
    username?: string;
    /** Empty string clears the stored password; absent leaves it alone. */
    password?: string;
    endpoint?: string;
    bucket?: string;
    region?: string;
    signatureVersion?: string;
    accessKeyId?: string;
    /** Empty string clears the stored S3 secret; absent leaves it alone. */
    accessKeySecret?: string;
    /**
     * Identity sent as `User-Agent` for the protocol in this same patch; empty
     * string means "the plugin's own". Stored per protocol, because the identity
     * belongs to the *credential* and each protocol has its own.
     */
    userAgent?: string;
}
/** Which remote protocol the vault pulls from. */
export declare const REMOTE_PROTOCOLS: readonly ["webdav", "s3"];
export type RemoteProtocol = (typeof REMOTE_PROTOCOLS)[number];
/**
 * The non-secret half of the remote configuration.
 *
 * The wire still calls this endpoint `webdav` for historical reasons; it now
 * carries both protocols, and the field below is what decides which.
 */
export interface WebdavSettings {
    /** Which client the pull uses. */
    protocol: RemoteProtocol;
    /** WebDAV: base URL, e.g. `https://data.cstcloud.cn/dav`. */
    /** Base URL, e.g. `https://data.cstcloud.cn/dav`. */
    baseUrl: string;
    /** Folder under the base URL; the convention every device drops into. */
    directory: string;
    /**
     * Also merge `…/sync` trees found **outside** the configured directory.
     *
     * Off by default, because the directory is what tells two vaults apart and a
     * bucket can be shared. On, this is what a person means by "it is all my
     * cloud drive": a machine that used to sync somewhere else leaves its records
     * behind, and they come back (asked 2026-09-21, 19 records). Merging settles
     * per record by `id` + `updatedAt`, so an older tree cannot overwrite a newer
     * copy — and a record the user **emptied out of the bin** stays gone: the
     * grave that `purge` leaves is the thing such a copy cannot outrank (it used
     * to, and thirteen emptied tombstones came back into the bin on every restart
     * — measured 2026-09-21).
     */
    adoptForeignRoots: boolean;
    username: string;
    /** S3: endpoint host, e.g. `https://s3.cstcloud.cn`. */
    endpoint: string;
    /** S3: bucket to read from. */
    bucket: string;
    /** S3: covered by the signature even when the server ignores it. */
    region: string;
    /** S3: only `v4` is implemented; the field exists so the choice is visible. */
    signatureVersion: string;
    /** S3: the identifier, which is not a secret. */
    accessKeyId: string;
    /**
     * What we call ourselves in the S3 request's `User-Agent` header.
     *
     * Empty means "use the plugin's own identity". Some gateways (数据胶囊 among
     * them) bind an access key to an application and reject every request whose
     * caller does not claim to be that application, so this is a real setting
     * rather than decoration.
     */
    userAgent: string;
    /**
     * The same thing for the WebDAV request.
     *
     * A separate value on purpose: the gate is bound to the *credential*, and a
     * user may well have an S3 key bound to one application and a WebDAV account
     * bound to another. Sharing one field made switching protocols silently break
     * both, with an error that reads like a wrong password.
     */
    webdavUserAgent: string;
}
/** What the panel needs to render the form and its status. */
export interface WebdavStatus {
    settings: WebdavSettings;
    /** Whether the WebDAV password is stored — never the value itself. */
    passwordSet: boolean;
    /** Whether the S3 secret is stored — never the value itself. */
    secretSet: boolean;
    settingsAvailable: boolean;
    credentialsAvailable: boolean;
}
/** What one pull did, for the panel and for the log. */
/** The directory a sync uses when the user never named one. */
export declare const DEFAULT_SYNC_DIRECTORY = "inbox";
/**
 * The directory a sync actually uses, decided in one place.
 *
 * `/`, an empty string and "never named one" all mean the default. They used to
 * mean different things depending on which path read them: `syncRoot()` turned a
 * stripped-empty directory into the *bucket root* (`sync/`) while the
 * drop-folder ingest defaulted to `/inbox`, so two machines set up through the
 * same dialog could write to `sync/` and `inbox/sync/` respectively — and the
 * merge, which reads its own prefix, then found nothing and reported nothing new
 * (measured 2026-09-20).
 *
 * @param raw - whatever the settings hold, if anything.
 * @returns the directory without leading or trailing slashes; never empty.
 */
export declare function syncDirectory(raw: string | undefined): string;
/**
 * Where the vault's own objects live: `<directory>/sync`.
 *
 * Shared by the writer, the drop-folder ingest and the display, so "which
 * prefix is mine" has one answer on both sides of the wire.
 *
 * @param raw - the configured directory, if any.
 * @returns the sync root, e.g. `inbox/sync`.
 */
export declare function syncRootFor(raw: string | undefined): string;
export interface PullResult {
    status: 'ok' | 'unconfigured' | 'failed';
    reason?: string;
    pulled: number;
    /**
     * Records another device pushed that this one took in (new here, or newer
     * than the local copy). Only the merge half of a pull can produce these.
     */
    merged?: number;
    /** How many of {@link merged} were ids this vault did not have at all. */
    added?: number;
    /**
     * Copies the cloud still holds of records this vault **emptied out of the bin**.
     *
     * Not taken in, on purpose: `purge` leaves a grave, and a copy that is not
     * *newer* than it does not come back (see `graves` in `src/host/vault/spec.ts`).
     * Reported because a reader who just emptied the bin is owed the sight of the
     * older tree trying and being refused.
     */
    purged?: number;
    /** How many of {@link merged} were deletions (they land in the recycle bin). */
    deletions?: number;
    /** Attachment objects the merge had to fetch and admit locally. */
    attachments?: number;
    /**
     * The remote's master-password parameters were taken over this pull.
     *
     * The one piece of this result that changes what the user can *do*: records
     * that came over as ciphertext before can now be unlocked, with the password
     * of the machine that sealed them.
     */
    masterAdopted?: boolean;
    /**
     * One sentence about the key parameters, when they are the reason something
     * does not work — "this vault holds 7 sealed records and the parameters that
     * would open them are not here" is otherwise indistinguishable from "the
     * records came over fine".
     */
    masterNote?: string;
    /**
     * Records the cloud holds that this vault **already had** (same id, not older).
     *
     * This is the answer to "why is the cloud's copy not coming over?": it is the
     * same record, and the merge settles per record by `id` + `updatedAt` rather
     * than by which machine uploaded it — a record this machine pushed comes back
     * with the timestamp it left with, so it is kept, not re-filed.
     */
    kept?: number;
    failed: number;
    /** Files the server listed but we skipped as already-seen. */
    skipped: number;
    /**
     * How many of {@link skipped} were the vault's own upload queue (`sync/…`).
     *
     * Optional because the older shape of this result (and every test that builds
     * one by hand) predates the split.
     */
    skippedSync?: number;
    /** How many of {@link skipped} were older than the last pull's cursor. */
    skippedOlder?: number;
    /**
     * How many of {@link skipped} were **folders**, not files.
     *
     * S3 has no folders, so a folder the user made in the cloud console is a
     * placeholder object whose key ends with `/` — and the listing hands the drop
     * folder's own placeholder back like any other object. Reading one is not a
     * file read: 数据胶囊 answers `HTTP 500 {"msg":"未知运行时异常"}`, which the
     * panel showed as `失败 1：inbox：取对象失败：HTTP 500 …` on every refresh,
     * because a failed entry pins the pull cursor (measured 2026-09-21). They are
     * skipped by shape now; the count is here for whoever is debugging a listing.
     */
    skippedFolders?: number;
    /**
     * How many of {@link skipped} sat under a `…/sync/` prefix that is **not**
     * ours — another machine syncing under a different directory.
     */
    skippedForeign?: number;
    /** Those other prefixes, e.g. `['inbox/sync']`; the panel warns about them. */
    foreignSyncRoots?: string[];
    /** How many `items/*.json` records those other prefixes hold together. */
    foreignRecords?: number;
    /** This machine's own sync root, so the warning can name both sides. */
    syncRoot?: string;
    /**
     * How many **records** the cloud holds, as opposed to how many objects that
     * takes: `items/<id>.json` files under this machine's own sync root.
     */
    remoteRecords?: number;
    /** How many attachments the cloud holds (`attachments/<id>.<ext>`, no descriptors). */
    remoteAttachments?: number;
    /** How many entries the remote listed at all: distinguishes "empty folder"
     * from "everything already ingested". */
    listed: number;
    /** Set when the pull completed. */
    lastPullAt?: string;
}
/**
 * What one push did.
 *
 * `partial` exists because the useful answer to "did it work" is often "these
 * twelve did, that one attachment could not be read" — a plain ok/failed would
 * have to throw that away.
 */
export interface PushResult {
    status: 'ok' | 'partial' | 'unconfigured' | 'failed';
    reason?: string;
    /** Records written to the remote. */
    pushed: number;
    /** Attachment objects written alongside them. */
    attachments: number;
    /** Records the remote already had, untouched since the last push. */
    skipped: number;
    /** Records the push considered (including tombstones). */
    listed: number;
    lastPushAt?: string;
}
/** One row of the connection self-test. */
export interface ProbeRow {
    label: string;
    url: string;
    status: number;
    detail: string;
}
/** What the self-test's rows add up to, in one line. */
export interface ProbeVerdict {
    ok: boolean;
    /** The sentence itself, e.g. 「通道可用：v4 精简（只签 host + date）」. */
    title: string;
    /** The thing to try next when it is not usable. */
    hint?: string;
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
export declare function probeVerdict(rows: readonly ProbeRow[]): ProbeVerdict;
/** Raster formats dsh's own attachment store accepts, and we therefore pass through. */
export declare const INBOX_IMAGE_TYPES: readonly ["image/png", "image/jpeg", "image/webp", "image/gif"];
export type InboxImageType = (typeof INBOX_IMAGE_TYPES)[number];
/** One browser-submitted image: base64 bytes plus the declared media type. */
export interface WireImage {
    mediaType: InboxImageType;
    data: string;
    name?: string;
}
/** One browser-submitted generic file, stored byte-for-byte. */
export interface WireFile {
    data: string;
    name?: string;
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
    mediaType?: string;
}
/** Everything one panel submission can carry. */
export interface CaptureRequest {
    text?: string;
    images?: WireImage[];
    files?: WireFile[];
}
/** How many records a submission stored, and how many merged into existing ones. */
export interface CaptureResult {
    stored: number;
    /** Records that absorbed this capture instead of a new one being written. */
    merged: number;
    /**
     * The subset of `merged` that was sitting in the recycle bin and came back
     * out — a repeat that *does* change the list, and says something different.
     */
    restored: number;
}
/** Which shelf a list is asking about. */
export type ListScope = 'live' | 'bin';
/** Filters and paging for one list call. */
export interface ListRequest {
    scope?: ListScope;
    categories?: Category[];
    /** Filter to the records the user flagged for later. */
    watchLater?: boolean;
    kinds?: Kind[];
    /** Every listed tag must be present. */
    tags?: string[];
    /** Case-insensitive substring over title, text, url, note and tags. */
    text?: string;
    limit?: number;
    offset?: number;
}
/** One row of the panel's list. */
export interface EntrySummary {
    id: string;
    kind: Kind;
    category: Category;
    /** Who chose the category; absent on records written before M5. */
    categorySource?: CategorySource;
    /**
     * The one flag the user manages himself: "I want to come back to this".
     *
     * Replaces the old read/unread pair, which claimed to know something the
     * software cannot know and made every capture start life as "unread".
     */
    watchLater: boolean;
    title?: string;
    /**
     * The headline fetched from the link's own page, when there is one.
     *
     * Second only to a name the user typed, and never a substitute for one: this
     * is somebody else's words, so the pane keeps showing which is which.
     */
    linkTitle?: string;
    /**
     * Why no headline arrived, as a short code (`network:…`, `http:404`,
     * `not-html:…`, `no-title`). The pane translates it — a link that quietly
     * keeps its URL looks like a broken feature rather than a site that refused.
     */
    linkTitleError?: string;
    /**
     * The file name the record arrived with, when it has one.
     *
     * A picture or a file carries no text of its own, so without this its row has
     * nothing to be called but 「（无标题）」 — which is what an uploaded photo used
     * to show. It is a **fallback, never an override**: a name the user typed wins
     * over it, and a credential record ignores it entirely (its heading is fixed;
     * see `src/client/heading.ts`).
     */
    attachmentName?: string;
    /** A short excerpt of the stored text, already trimmed by the host. */
    preview?: string;
    url?: string;
    platform?: string;
    note?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    /** How many attachments the record references. */
    attachmentCount: number;
    /**
     * The first attachment the panel can render itself — the card's picture.
     *
     * Not just pictures any more: a video or an audio file gets a play tile in the
     * same slot and opens in the panel's own lightbox. `previewMime` says which of
     * the three it is, because the card has to draw it differently — and because a
     * `<video>` needs to know it is one before it fetches the bytes.
     */
    previewId?: string;
    /** That attachment's MIME type: `image/*`, `video/*` or `audio/*`. */
    previewMime?: string;
    /** Present while the record sits in the recycle bin. */
    deletedAt?: string;
}
/** One attachment's metadata, as the detail view shows it. */
export interface AttachmentSummary {
    id: string;
    mime: string;
    bytes: number;
    filename?: string;
    width?: number;
    height?: number;
    /** True when the panel can render a thumbnail through the attachment route. */
    image: boolean;
}
/** One record in full. */
export interface EntryDetail extends EntrySummary {
    text?: string;
    attachments: AttachmentSummary[];
}
/** A filter value and how many records carry it. */
export interface FacetCount<T> {
    value: T;
    count: number;
}
/** One page of records plus the numbers the header and filter bar show. */
export interface ListResult {
    entries: EntrySummary[];
    /** Records matching the filters, paging ignored. */
    matched: number;
    /** Live records overall. */
    total: number;
    /** Live records flagged 待看, overall. */
    watchLater: number;
    /** Records sitting in the recycle bin. */
    deleted: number;
    /** Facets are computed over live records only. */
    categories: FacetCount<Category>[];
    tags: FacetCount<string>[];
}
export interface DetailRequest {
    id: string;
}
export interface DetailResult {
    entry: EntryDetail;
}
/** The editable fields. Omitted fields keep their stored value. */
export interface UpdateRequest {
    id: string;
    category?: Category;
    watchLater?: boolean;
    note?: string;
    title?: string;
    tags?: string[];
}
export interface UpdateResult {
    entry: EntrySummary;
}
/** How the vault's key stands, and what the panel may do about it. */
export interface SecretStatus {
    /** A master password exists. Without one, nothing can be sealed. */
    configured: boolean;
    /** The key is in this process's memory: credentials can be read and written. */
    unlocked: boolean;
    /**
     * Sealed credential bodies the vault holds.
     *
     * Non-zero with `configured: false` means the records came from another
     * machine and their key parameters have not arrived (or do not exist here):
     * the panel must say "locked, bring the parameters over" rather than
     * "no password yet", because no password typed here could open them.
     */
    sealedRecords: number;
    /**
     * Sealed records no key in memory can open — counted only while at least one
     * key *is* in memory.
     *
     * The panel's "还有 N 条来自别的机器" line: records another machine sealed with
     * a password this one has not been given yet. Zero while locked (everything is
     * unreadable then, and the card says 「已锁定」) and zero once every password in
     * play has been typed.
     */
    unreadable: number;
    /** Parameter sets from other machines this vault has taken in. */
    otherMachines: number;
    /**
     * How many credentials the last unlock moved out of plain text. Zero most of
     * the time; non-zero exactly once, on the unlock after this feature arrived.
     */
    sealed?: number;
}
/**
 * What the panel sends to `secret`.
 *
 * `password` travels over the panel's own token-fenced route and is used to
 * derive a key in memory; it is never written anywhere, which is why unlocking
 * is something the user does again after every restart.
 */
export interface SecretRequest {
    action: 'status' | 'set' | 'unlock' | 'lock';
    password?: string;
}
export interface IdRequest {
    id: string;
}
export interface IdResult {
    entry: EntrySummary;
}
export interface PurgeResult {
    removed: number;
    /** Objects the same cleanup deleted from the remote, when one is configured. */
    remoteRemoved?: number;
    /** True when there is no remote configured — nothing to clean up there. */
    remoteSkipped?: boolean;
    /** What the remote deletion could not do. */
    reason?: string;
}
/** Carrier-neutral failure, mirroring Connection's `ConnectionRpcFailure`. */
export interface InboxRpcFailure {
    code: string;
    message: string;
    details: Record<string, unknown>;
}
/** Business outcome of one call: a refused request is an answer, not a crash. */
export type InboxRpcResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: InboxRpcFailure;
};
/** How many records one page holds. */
export declare const LIST_LIMIT = 50;
/**
 * How many records the panel asks for at a time.
 *
 * Twelve, not fifty: the list is made of cards now, and a page that has to be
 * scrolled twice before you see the pager is a page you cannot count.
 */
export declare const PAGE_SIZE = 12;
/**
 * The two list densities the panel offers.
 *
 * There used to be a third (`rows`, one wide card per line). It went when the
 * user pointed out that the type badge it led with repeated what the metadata
 * line already said, and that two densities cover both habits: `grid` for
 * pictures, `compact` for volume. A stored `rows` is no longer a value this
 * list accepts, so readers fall back to the default — which is `grid`.
 */
export declare const UI_LIST_MODES: readonly ["grid", "compact"];
export type UiListMode = (typeof UI_LIST_MODES)[number];
/** What the panel remembers about itself. */
export interface UiPrefs {
    /** How the record list is laid out. */
    listMode: UiListMode;
}
/** What the panel sends to `ui`: read the preferences, or change them. */
export interface UiRequest {
    action: 'read' | 'save';
    listMode?: UiListMode;
}
/** What the panel sends to `tags`. */
export interface TagRequest {
    action: 'remove';
    /** The exact tag to strip from every record that carries it. */
    tag: string;
}
/** How much stored text a list row shows before the panel truncates it. */
export declare const PREVIEW_CHARS = 140;
/** Most attachments one submission may carry; mirrors the composer's own ceiling. */
export declare const MAX_ATTACHMENTS_PER_SUBMISSION = 20;
/** Ceiling on the user's own note, so one edit cannot bloat the domain. */
export declare const MAX_NOTE_CHARS = 2000;
/** Tag limits: a filter list nobody can read is worse than no tags. */
export declare const MAX_TAGS = 20;
export declare const MAX_TAG_CHARS = 40;
/** Ceiling on one filter's free text. */
export declare const MAX_FILTER_CHARS = 200;
/**
 * Ceiling on the name a user gives a record.
 *
 * It is a heading, not a document: the ceiling is here so a runaway paste into
 * the name field cannot bloat the domain, and the card ellipsises long before
 * this number is ever reached.
 */
export declare const MAX_TITLE_CHARS = 300;
