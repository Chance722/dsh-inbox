/**
 * The panel's wire: the browser half submits pasted content, pages the vault,
 * edits and deletes records, and streams attachment bytes back.
 *
 * Transport: exact Fetch routes on the shared `/api` channel. Connection
 * applies its Host/Origin trust fence **and** the signed browser cookie before
 * dispatching anything under `/api`, so the vault is exactly as reachable as
 * the rest of the GUI and no further. A bare `webServer` route would instead
 * answer any process on the machine and any page that can issue a simple
 * cross-origin POST — not somewhere to put a vault.
 *
 * Attachment bytes never enter the vault domain. They go through dsh's own
 * attachment store (content-addressed, normalized, never auto-deleted), and the
 * domain keeps the reference plus the metadata we can show without reading
 * bytes back.
 */

import { open, readFile } from 'node:fs/promises'

import type { Context } from '@deepseek-ai/cordis'
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import {
  admitEncodedFile,
  admitEncodedImages,
  isAttachmentError,
  type AttachmentStore,
} from '@deepseek-ai/dsh-attachment'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import { z } from 'zod'

import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_ATTACHMENT,
  INBOX_ENDPOINT_CAPTURE,
  INBOX_ENDPOINT_DELETE,
  INBOX_ENDPOINT_DETAIL,
  INBOX_ENDPOINT_LIST,
  INBOX_ENDPOINT_PURGE,
  INBOX_ENDPOINT_RESTORE,
  INBOX_ENDPOINT_UPDATE,
  INBOX_ENDPOINT_WEBDAV,
  INBOX_ENDPOINT_PULL,
  INBOX_ENDPOINT_PROBE,
  INBOX_ENDPOINT_UI,
  INBOX_ENDPOINT_TAGS,
  INBOX_IMAGE_TYPES,
  LIST_LIMIT,
  MAX_ATTACHMENTS_PER_SUBMISSION,
  MAX_FILTER_CHARS,
  MAX_NOTE_CHARS,
  MAX_TAGS,
  MAX_TAG_CHARS,
  MAX_TITLE_CHARS,
  PREVIEW_CHARS,
  type AttachmentSummary,
  type CaptureResult,
  type DetailResult,
  type EntryDetail,
  type EntrySummary,
  type FacetCount,
  type IdResult,
  type InboxRpcFailure,
  type InboxRpcResult,
  type ListResult,
  type PurgeResult,
  type UpdateResult,
} from '../shared/panel-wire.js'
import { CATEGORIES, KINDS, type Category } from '../shared/vocabulary.js'
import { capture, type CapturedAttachment } from './capture.js'
import {
  activeUserAgent,
  describeWebdav,
  readSettings,
  saveWebdav,
  type WebdavPatch,
  type WebdavStatus,
} from './webdav/config.js'
import { runPull, s3Fetch } from './webdav/run.js'
import { probeS3 } from './s3/probe.js'
import { readS3Secret } from './webdav/config.js'
import { readUiPrefs, saveUiPrefs } from './ui/config.js'
import type { PullResult } from '../shared/panel-wire.js'
import type { Attachment, Item } from './vault/spec.js'
import type { Vault } from './vault/vault.js'

/** Ceiling on one pasted string, so a runaway paste cannot bloat the domain. */
export const MAX_TEXT_CHARS = 200_000

const imageSchema = z.object({
  mediaType: z.enum(INBOX_IMAGE_TYPES),
  data: z.string().min(1),
  name: z.string().optional(),
})

const fileSchema = z.object({
  data: z.string(),
  name: z.string().optional(),
  // The browser's declaration, kept only for playable media (see
  // `fileAttachment`); a schema that promised more would be a promise the host
  // does not keep.
  mediaType: z.string().optional(),
})

const captureRequestSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS).optional(),
  images: z.array(imageSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional(),
  files: z.array(fileSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional(),
})

const tagSchema = z.string().min(1).max(MAX_TAG_CHARS)

const listRequestSchema = z.object({
  scope: z.enum(['live', 'bin']).optional(),
  categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length).optional(),
  watchLater: z.boolean().optional(),
  kinds: z.array(z.enum(KINDS)).max(KINDS.length).optional(),
  tags: z.array(tagSchema).max(MAX_TAGS).optional(),
  text: z.string().max(MAX_FILTER_CHARS).optional(),
  limit: z.number().int().positive().max(LIST_LIMIT).optional(),
  offset: z.number().int().nonnegative().optional(),
})

const idRequestSchema = z.object({ id: z.string().min(1) })

const updateRequestSchema = idRequestSchema.extend({
  category: z.enum(CATEGORIES).optional(),
  watchLater: z.boolean().optional(),
  note: z.string().max(MAX_NOTE_CHARS).optional(),
  title: z.string().max(MAX_TITLE_CHARS).optional(),
  tags: z.array(tagSchema).max(MAX_TAGS).optional(),
})

function failure(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): InboxRpcResult<never> {
  return { ok: false, error: { code, message, details } }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `sha256:<hex>` → `<hex>`; the digest of what the store actually published. */
function digestOf(attachmentId: string): string | undefined {
  const match = /^sha256:([a-f0-9]{64})$/.exec(attachmentId)
  return match?.[1]
}

/**
 * Project one stored image reference onto what the vault records.
 *
 * `sha256` is the digest of the *normalized* object the store published, not of
 * the bytes the browser sent — normalisation re-encodes. It is informational;
 * repeat detection keys on the attachment id.
 */
function imageAttachment(ref: ImageAttachmentRef): CapturedAttachment {
  const sha256 = digestOf(ref.attachmentId)
  return {
    id: ref.attachmentId,
    mime: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...(sha256 === undefined ? {} : { sha256 }),
    ...(ref.name === undefined ? {} : { filename: ref.name }),
  }
}

/** Generic files are stored byte-for-byte, so the id already is their digest. */
function fileAttachment(ref: FileAttachmentRef, declared?: string): CapturedAttachment {
  const sha256 = digestOf(ref.attachmentId)
  // The browser's own guess, kept only when it names a media type the panel can
  // play: everything else stays `application/octet-stream`, because the route
  // serves the stored type back and a scriptable one would be an injection.
  const playable =
    declared !== undefined && (declared.startsWith('video/') || declared.startsWith('audio/'))
  return {
    id: ref.attachmentId,
    mime: playable ? declared : 'application/octet-stream',
    bytes: ref.bytes,
    filename: ref.name,
    ...(sha256 === undefined ? {} : { sha256 }),
  }
}

/** Newlines and runs of spaces inside a row would break the list's rhythm. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The one rule for "the panel can render this": exactly what the attachment
 * route is willing to serve.
 *
 * Pictures ride the image lane (which validates and normalises), and only the
 * types the panel ships support for — a record whose media type came in as
 * `image/svg+xml` from a remote must not be offered as a card's picture, because
 * the route will refuse to serve it and the card would show a broken image.
 * Video and sound ride the verbatim file lane.
 *
 * @param mime - an attachment's media type.
 * @returns true when both the summary and the route accept it.
 */
function renderableMime(mime: string): boolean {
  return (
    (INBOX_IMAGE_TYPES as readonly string[]).includes(mime) ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/')
  )
}

/** One stored record, trimmed to what a list row shows. */
function toSummary(
  item: Item,
  attachmentOf?: (id: string) => Attachment | undefined,
): EntrySummary {
  const preview = item.text === undefined ? undefined : collapse(item.text).slice(0, PREVIEW_CHARS)
  // The card can only show something if we tell it which attachment to ask for,
  // and what that attachment is.
  const previewRecord = item.attachmentIds
    .map((id) => attachmentOf?.(id))
    .find((record) => record !== undefined && renderableMime(record.mime))
  /*
    What a nameless record can be called: the file it arrived as.

    The picture's own attachment is preferred, so the name and the thumbnail on
    the card are about the same file; otherwise the first attachment that has a
    name wins. Without this an uploaded photo had nothing but 「（无标题）」 —
    the name was stored all along, in the attachment row, and never used.
  */
  const namedRecord =
    previewRecord?.filename === undefined
      ? item.attachmentIds
          .map((id) => attachmentOf?.(id))
          .find((record) => record !== undefined && record.filename !== undefined)
      : previewRecord
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    ...(item.categorySource === undefined ? {} : { categorySource: item.categorySource }),
    watchLater: item.watchLater === true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: [...item.tags],
    attachmentCount: item.attachmentIds.length,
    ...(previewRecord === undefined
      ? {}
      : { previewId: previewRecord.id, previewMime: previewRecord.mime }),
    ...(namedRecord?.filename === undefined ? {} : { attachmentName: namedRecord.filename }),
    ...(item.title === undefined ? {} : { title: item.title }),
    ...(item.linkTitle === undefined ? {} : { linkTitle: item.linkTitle }),
    ...(item.linkTitleError === undefined ? {} : { linkTitleError: item.linkTitleError }),
    ...(preview === undefined || preview.length === 0 ? {} : { preview }),
    ...(item.url === undefined ? {} : { url: item.url }),
    ...(item.platform === undefined ? {} : { platform: item.platform }),
    ...(item.note === undefined ? {} : { note: item.note }),
    ...(item.deletedAt === undefined ? {} : { deletedAt: item.deletedAt }),
  }
}

function toAttachmentSummary(record: Attachment): AttachmentSummary {
  return {
    id: record.id,
    mime: record.mime,
    bytes: record.bytes,
    image: record.mime.startsWith('image/'),
    ...(record.filename === undefined ? {} : { filename: record.filename }),
    ...(record.width === undefined ? {} : { width: record.width }),
    ...(record.height === undefined ? {} : { height: record.height }),
  }
}

/** The full record: the row plus its text and attachment metadata. */
function toDetail(vault: Vault, item: Item): EntryDetail {
  const attachments: AttachmentSummary[] = []
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId)
    if (record !== undefined) attachments.push(toAttachmentSummary(record))
  }
  return {
    ...toSummary(item, (id) => vault.getAttachment(id)),
    ...(item.text === undefined ? {} : { text: item.text }),
    attachments,
  }
}

function byCountThenName<T extends string>(left: FacetCount<T>, right: FacetCount<T>): number {
  if (left.count !== right.count) return right.count - left.count
  return left.value.localeCompare(right.value)
}

/** Facet counts over the live records, so the filter bar reflects reality. */
function facetsOf(live: readonly Item[]): {
  categories: FacetCount<Category>[]
  tags: FacetCount<string>[]
} {
  const categories = new Map<Category, number>()
  const tags = new Map<string, number>()
  for (const item of live) {
    categories.set(item.category, (categories.get(item.category) ?? 0) + 1)
    for (const tag of item.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
  return {
    categories: [...categories]
      .map(([value, count]) => ({ value, count }))
      .sort(byCountThenName),
    tags: [...tags].map(([value, count]) => ({ value, count })).sort(byCountThenName),
  }
}

async function handleCapture(
  vault: Vault | undefined,
  attachments: AttachmentStore,
  payload: unknown,
  ctx: Context,
): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }

  const parsed = captureRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return failure('inbox/bad-request', '提交的内容不符合预期形状', {
      issues: parsed.error.issues.map((issue) => issue.message),
    })
  }

  const { text, images = [], files = [] } = parsed.data

  let stored: CapturedAttachment[]
  try {
    stored = (await admitEncodedImages(attachments, images)).map(imageAttachment)
    for (const file of files) {
      stored.push(fileAttachment(await admitEncodedFile(attachments, file), file.mediaType))
    }
  } catch (error) {
    if (isAttachmentError(error)) {
      return failure('inbox/attachment-refused', error.message, { code: error.code })
    }
    return failure('inbox/attachment-failed', reasonOf(error))
  }

  try {
    const summary: CaptureResult = await capture(vault, { text, attachments: stored }, 'panel', {
      ctx,
    })
    return { ok: true, value: summary }
  } catch (error) {
    return failure('inbox/capture-failed', reasonOf(error))
  }
}

function handleList(vault: Vault | undefined, payload: unknown): InboxRpcResult<unknown> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }

  const parsed = listRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return failure('inbox/bad-request', '筛选条件不符合预期形状', {
      issues: parsed.error.issues.map((issue) => issue.message),
    })
  }

  const { scope = 'live', limit = LIST_LIMIT, offset = 0, ...filters } = parsed.data
  const all = vault.list({ includeDeleted: true })
  const live = all.filter((item) => item.deletedAt === undefined)
  const bin = all.filter((item) => item.deletedAt !== undefined)

  // Selection and ordering come from the pure query layer; paging happens here
  // because `matched` has to describe the whole filter, not the page.
  const matched = vault.list({
    includeDeleted: true,
    ...filters,
  }).filter((item) => (scope === 'bin' ? item.deletedAt !== undefined : item.deletedAt === undefined))

  const value: ListResult = {
    entries: matched
      .slice(offset, offset + limit)
      .map((item) => toSummary(item, (id) => vault.getAttachment(id))),
    matched: matched.length,
    total: live.length,
    watchLater: live.filter((item) => item.watchLater === true).length,
    deleted: bin.length,
    ...facetsOf(live),
  }
  return { ok: true, value }
}

function handleDetail(vault: Vault | undefined, payload: unknown): InboxRpcResult<unknown> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const parsed = idRequestSchema.safeParse(payload)
  if (!parsed.success) return failure('inbox/bad-request', '缺少记录 id')

  const item = vault.get(parsed.data.id)
  if (item === undefined) return failure('inbox/not-found', '这条记录不在了')

  const value: DetailResult = { entry: toDetail(vault, item) }
  return { ok: true, value }
}

async function handleUpdate(vault: Vault | undefined, payload: unknown): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const parsed = updateRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return failure('inbox/bad-request', '要改的内容不符合预期形状', {
      issues: parsed.error.issues.map((issue) => issue.message),
    })
  }
  const { id, ...patch } = parsed.data
  const item = vault.get(id)
  if (item === undefined) return failure('inbox/not-found', '这条记录不在了')

  try {
    // Choosing a category here means the *user* chose it, which outranks both
    // rules and any model pass — the product rule that a person's word wins.
    const updated = await vault.patch(id, {
      ...patch,
      ...(patch.category === undefined ? {} : { categorySource: 'user' as const }),
    })
    const value: UpdateResult = { entry: toSummary(updated) }
    return { ok: true, value }
  } catch (error) {
    return failure('inbox/update-failed', reasonOf(error))
  }
}

async function handleDelete(vault: Vault | undefined, payload: unknown): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const parsed = idRequestSchema.safeParse(payload)
  if (!parsed.success) return failure('inbox/bad-request', '缺少记录 id')
  if (vault.get(parsed.data.id) === undefined) {
    return failure('inbox/not-found', '这条记录不在了')
  }

  try {
    const value: IdResult = { entry: toSummary(await vault.softDelete(parsed.data.id)) }
    return { ok: true, value }
  } catch (error) {
    return failure('inbox/delete-failed', reasonOf(error))
  }
}

async function handleRestore(vault: Vault | undefined, payload: unknown): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const parsed = idRequestSchema.safeParse(payload)
  if (!parsed.success) return failure('inbox/bad-request', '缺少记录 id')
  if (vault.get(parsed.data.id) === undefined) {
    return failure('inbox/not-found', '这条记录不在了')
  }

  try {
    const value: IdResult = { entry: toSummary(await vault.restore(parsed.data.id)) }
    return { ok: true, value }
  } catch (error) {
    return failure('inbox/restore-failed', reasonOf(error))
  }
}

async function handlePurge(vault: Vault | undefined): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const bin = vault.getBin()
  let removed = 0
  for (const item of bin) {
    if (await vault.remove(item.id)) removed += 1
  }
  const value: PurgeResult = { removed }
  return { ok: true, value }
}

/** Read or change the WebDAV configuration. */
async function handleWebdav(
  ctx: Context,
  vault: Vault | undefined,
  payload: unknown,
): Promise<InboxRpcResult<unknown>> {
  const request = (payload ?? {}) as {
    action?: unknown
    protocol?: unknown
    baseUrl?: unknown
    directory?: unknown
    username?: unknown
    password?: unknown
    endpoint?: unknown
    bucket?: unknown
    region?: unknown
    signatureVersion?: unknown
    accessKeyId?: unknown
    accessKeySecret?: unknown
    userAgent?: unknown
  }
  const action = request.action === 'save' ? 'save' : 'read'

  if (action === 'save') {
    const patch: WebdavPatch = {}
    if (typeof request.protocol === 'string') patch.protocol = request.protocol
    if (typeof request.baseUrl === 'string') patch.baseUrl = request.baseUrl
    if (typeof request.directory === 'string') patch.directory = request.directory
    if (typeof request.username === 'string') patch.username = request.username
    if (typeof request.password === 'string') patch.password = request.password
    if (typeof request.endpoint === 'string') patch.endpoint = request.endpoint
    if (typeof request.bucket === 'string') patch.bucket = request.bucket
    if (typeof request.region === 'string') patch.region = request.region
    if (typeof request.signatureVersion === 'string') {
      patch.signatureVersion = request.signatureVersion
    }
    if (typeof request.accessKeyId === 'string') patch.accessKeyId = request.accessKeyId
    if (typeof request.accessKeySecret === 'string') {
      patch.accessKeySecret = request.accessKeySecret
    }
    if (typeof request.userAgent === 'string') patch.userAgent = request.userAgent
    const saved = await saveWebdav(ctx, vault, readSettings(ctx), patch)
    if (!saved.ok) return failure('inbox/webdav-unsaved', saved.reason ?? '存不进去')
  }

  const status: WebdavStatus = await describeWebdav(ctx)
  return { ok: true, value: status }
}

/** Run one pull now, for the panel's button. */
async function handlePull(
  ctx: Context,
  vault: Vault | undefined,
  attachments: AttachmentStore,
): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const settings = readSettings(ctx)
  const result: PullResult = await runPull(ctx, vault, attachments)
  return { ok: true, value: result }
}

/** Run the connection self-test for whichever protocol is configured. */
async function handleProbe(ctx: Context): Promise<InboxRpcResult<unknown>> {
  const settings = readSettings(ctx)
  if (settings.protocol !== 's3') {
    return failure('inbox/probe-webdav', '自检目前只对 S3 有用：WebDAV 的错误信息已经够直白了')
  }
  const secret = await readS3Secret(ctx)
  if (secret === undefined) return failure('inbox/no-secret', '还没存 AccessKey Secret')

  const rows = await probeS3(
    {
      endpoint: settings.endpoint,
      bucket: settings.bucket,
      region: settings.region,
      signatureVersion: settings.signatureVersion,
      userAgent: activeUserAgent(settings),
    },
    { fetch: s3Fetch, accessKeyId: settings.accessKeyId, accessKeySecret: secret },
    settings.directory.replace(/^\//, ''),
  )
  return { ok: true, value: rows }
}

/** Read or change the panel's own preferences (which list layout it remembers). */
async function handleTags(vault: Vault | undefined, payload: unknown): Promise<InboxRpcResult<unknown>> {
  if (vault === undefined) return failure('inbox/vault-closed', '仓库还没打开（或打开失败），稍后再试')
  const parsed = z
    .object({ action: z.enum(['remove']).default('remove'), tag: z.string().min(1).max(MAX_TAG_CHARS) })
    .safeParse(payload)
  if (!parsed.success) return failure('inbox/bad-tag-request', parsed.error.message)
  const removed = await vault.removeTag(parsed.data.tag)
  return { ok: true, value: { removed } }
}

async function handleUi(ctx: Context, payload: unknown): Promise<InboxRpcResult<unknown>> {
  const parsed = z
    .object({
      action: z.enum(['read', 'save']).default('read'),
      listMode: z.enum(['grid', 'compact']).optional(),
    })
    .safeParse(payload)
  if (!parsed.success) return failure('inbox/bad-ui-request', parsed.error.message)

  if (parsed.data.action === 'save' && parsed.data.listMode !== undefined) {
    const saved = saveUiPrefs(ctx, { listMode: parsed.data.listMode })
    if (!saved.ok) return failure('inbox/ui-unsaved', saved.reason ?? '存不进去')
  }
  return { ok: true, value: readUiPrefs(ctx) }
}

/** Rebuild the store's reference from the metadata we keep. */
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

/** The same, for a file stored byte-for-byte (video, audio, anything else). */
function fileRef(record: Attachment): FileAttachmentRef {
  return {
    attachmentId: record.storeId as FileAttachmentRef['attachmentId'],
    name: record.filename ?? 'file',
    bytes: record.bytes,
  }
}

/**
 * Read one byte range out of a file.
 *
 * `readFile` would be the easy way, and it is the wrong one here: a video is
 * routinely hundreds of megabytes, and a browser asks for it in pieces.
 *
 * @param path - the object's host path.
 * @param start - first byte to read (inclusive).
 * @param length - how many bytes to read.
 * @returns the slice.
 */
async function readSlice(path: string, start: number, length: number): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

/**
 * `bytes=start-end`, the only range syntax a media element sends.
 *
 * A header we cannot read as a range is answered with the whole file, which is
 * what the spec expects of a server that does not honour it.
 *
 * @param header - the request's `range` header, if it has one.
 * @param total - the object's size in bytes.
 * @returns the clamped range, or undefined to serve everything.
 */
function parseByteRange(header: string | null, total: number): { start: number; end: number } | undefined {
  const match = header === null ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null || total === 0) return undefined
  const rawStart = match[1] ?? ''
  const rawEnd = match[2] ?? ''
  if (rawStart === '' && rawEnd === '') return undefined
  // `bytes=-500` means "the last 500 bytes"; `bytes=100-` means "from 100 on".
  const start = rawStart === '' ? Math.max(0, total - Number(rawEnd)) : Number(rawStart)
  const end = rawStart === '' || rawEnd === '' ? total - 1 : Math.min(Number(rawEnd), total - 1)
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= total) {
    return undefined
  }
  return { start, end }
}

async function handleAttachment(
  vault: Vault | undefined,
  attachments: AttachmentStore,
  request: Request,
): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const record = vault?.getAttachment(id)
  if (record === undefined) {
    return Response.json(failure('inbox/attachment-missing', '附件不存在'), { status: 404 })
  }
  // An allowlist, not "anything that is not a file": this route is served from
  // the panel's own origin, and a stored `image/svg+xml` (which a remote can
  // hand us, and which the file path stores verbatim) would run script there.
  if (!renderableMime(record.mime)) {
    return Response.json(
      failure('inbox/attachment-not-renderable', '只有图片、视频和音频能在面板里预览'),
      { status: 415 },
    )
  }

  const image = (INBOX_IMAGE_TYPES as readonly string[]).includes(record.mime)
  const path = image
    ? attachments.imageHostPath(imageRef(record))
    : attachments.fileHostPath(fileRef(record))
  if (path === undefined) {
    return Response.json(
      failure('inbox/attachment-remote', '这个附件不在本机，面板没法直接读它'),
      { status: 404 },
    )
  }

  try {
    const headers = {
      'content-type': record.mime,
      'cache-control': 'private, max-age=86400',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
    }
    const range = parseByteRange(request.headers.get('range'), record.bytes)
    if (range === undefined) {
      return new Response(await readFile(path), { headers })
    }
    const length = range.end - range.start + 1
    // `new Uint8Array(...)` rather than the buffer itself: `BodyInit` is typed
    // against `ArrayBuffer`-backed views, and a `Buffer` is not one.
    return new Response(new Uint8Array(await readSlice(path, range.start, length)), {
      status: 206,
      headers: {
        ...headers,
        'content-length': String(length),
        'content-range': `bytes ${String(range.start)}-${String(range.end)}/${String(record.bytes)}`,
      },
    })
  } catch (error) {
    return Response.json(failure('inbox/attachment-unreadable', reasonOf(error)), { status: 500 })
  }
}

/**
 * One JSON POST endpoint. Business failures answer 200 with `ok: false` so the
 * panel can print the reason; only a malformed request body and a transport
 * problem are HTTP-level errors.
 *
 * @param path - absolute path on the shared `/api` channel.
 * @param run - the operation, given the decoded payload.
 */
function endpoint(
  path: string,
  run: (payload: unknown) => Promise<InboxRpcResult<unknown>>,
): ConnectionFetchRoute {
  return {
    path,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request: Request): Promise<Response> {
      let payload: unknown
      try {
        payload = await request.json()
      } catch {
        return Response.json(failure('inbox/bad-json', '请求体不是 JSON'), { status: 400 })
      }
      try {
        return Response.json(await run(payload))
      } catch (error) {
        // A thrown handler used to leave the caller with an empty body, and the
        // panel could only report "Unexpected end of JSON input". Always answer
        // with the reason instead.
        return Response.json(failure('inbox/handler-threw', reasonOf(error)))
      }
    },
  }
}

/**
 * Register the panel's endpoints.
 *
 * Both services are optional on purpose: a profile without `connection` (the
 * headless development profiles) still loads this plugin, it just has no panel
 * and therefore no endpoints to serve.
 *
 * Captures are serialised through one promise chain. Repeat detection is a
 * read-then-write pass over the domain, and the domain only serialises each
 * individual write — two overlapping submissions of the same link would
 * otherwise both miss the existing record and store it twice.
 *
 * @param ctx - host context; `apply` does not have to await anything.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export function registerInboxRpc(ctx: Context, vault: () => Vault | undefined): void {
  ctx.inject(['connection', 'attachments'], (scoped) => {
    const attachments = scoped.attachments
    let queue: Promise<unknown> = Promise.resolve()

    /** Run one mutation at a time; the chain must survive a rejected task. */
    const serialise = <T>(task: () => Promise<T>): Promise<T> => {
      const next = queue.then(task, task)
      queue = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    }

    const routes: readonly ConnectionFetchRoute[] = [
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_CAPTURE}`, (payload) =>
        serialise(() => handleCapture(vault(), attachments, payload, scoped)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_LIST}`, (payload) =>
        Promise.resolve(handleList(vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DETAIL}`, (payload) =>
        Promise.resolve(handleDetail(vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_UPDATE}`, (payload) =>
        serialise(() => handleUpdate(vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DELETE}`, (payload) =>
        serialise(() => handleDelete(vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_RESTORE}`, (payload) =>
        serialise(() => handleRestore(vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PURGE}`, () =>
        serialise(() => handlePurge(vault())),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_WEBDAV}`, (payload) =>
        serialise(() => handleWebdav(scoped, vault(), payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PULL}`, () =>
        serialise(() => handlePull(scoped, vault(), attachments)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_PROBE}`, () =>
        Promise.resolve(handleProbe(scoped)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_UI}`, (payload) =>
        serialise(() => handleUi(scoped, payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_TAGS}`, (payload) =>
        serialise(() => handleTags(vault(), payload)),
      ),
      {
        path: `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request: Request) => handleAttachment(vault(), attachments, request),
      },
    ]

    for (const route of routes) {
      scoped.effect(
        () => scoped.connection.fetch.register(route),
        `dsh-inbox: ${route.path}`,
      )
    }
  })
}
