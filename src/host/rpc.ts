/**
 * The panel's wire: the browser half submits pasted content, the host half
 * files it and answers with the newest records.
 *
 * Transport: one exact Fetch route per operation on the shared `/api` channel.
 * Connection applies its Host/Origin trust fence **and** the browser cookie
 * before dispatching anything under `/api`, so the vault is exactly as
 * reachable as the rest of the GUI and no further. A bare `webServer` route
 * would instead answer any process on the machine and any page that can issue a
 * simple cross-origin POST — not somewhere to put a vault.
 *
 * Attachment bytes never enter the vault domain. They go through dsh's own
 * attachment store (`ctx.attachments`, content-addressed under
 * `<DSH_HOME>/attachments/v1`, normalized, never auto-deleted), and the domain
 * keeps the reference plus the metadata we can show without reading bytes back.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import {
  admitEncodedFile,
  admitEncodedImages,
  isAttachmentError,
  type AttachmentStore,
  type FileAttachmentRef,
  type ImageAttachmentRef,
} from '@deepseek-ai/dsh-attachment'
import { z } from 'zod'

import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_CAPTURE,
  INBOX_ENDPOINT_RECENT,
  INBOX_IMAGE_TYPES,
  MAX_ATTACHMENTS_PER_SUBMISSION,
  PREVIEW_CHARS,
  RECENT_LIMIT,
  type CaptureResult,
  type InboxRpcResult,
  type RecentEntry,
  type RecentResult,
} from '../shared/capture.js'
import { capture, type CapturedAttachment } from './capture.js'
import type { Item } from './vault/spec.js'
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
})

const captureRequestSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS).optional(),
  images: z.array(imageSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional(),
  files: z.array(fileSchema).max(MAX_ATTACHMENTS_PER_SUBMISSION).optional(),
})

function failure(code: string, message: string, details: Record<string, unknown> = {}): InboxRpcResult<never> {
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
function fileAttachment(ref: FileAttachmentRef): CapturedAttachment {
  const sha256 = digestOf(ref.attachmentId)
  return {
    id: ref.attachmentId,
    mime: 'application/octet-stream',
    bytes: ref.bytes,
    filename: ref.name,
    ...(sha256 === undefined ? {} : { sha256 }),
  }
}

/** One stored record, trimmed to what a list row shows. */
function toEntry(item: Item): RecentEntry {
  const preview = item.text === undefined ? undefined : collapse(item.text).slice(0, PREVIEW_CHARS)
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    status: item.status,
    createdAt: item.createdAt,
    attachments: item.attachmentIds.length,
    ...(item.title === undefined ? {} : { title: item.title }),
    ...(preview === undefined || preview.length === 0 ? {} : { preview }),
    ...(item.url === undefined ? {} : { url: item.url }),
    ...(item.platform === undefined ? {} : { platform: item.platform }),
  }
}

/** Newlines and runs of spaces inside a row would break the list's rhythm. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

async function handleCapture(
  vault: Vault | undefined,
  attachments: AttachmentStore,
  payload: unknown,
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
    for (const file of files) stored.push(fileAttachment(await admitEncodedFile(attachments, file)))
  } catch (error) {
    if (isAttachmentError(error)) {
      return failure('inbox/attachment-refused', error.message, { code: error.code })
    }
    return failure('inbox/attachment-failed', reasonOf(error))
  }

  try {
    const summary: CaptureResult = await capture(vault, { text, attachments: stored }, 'panel')
    return { ok: true, value: summary }
  } catch (error) {
    return failure('inbox/capture-failed', reasonOf(error))
  }
}

function handleRecent(vault: Vault | undefined): InboxRpcResult<unknown> {
  if (vault === undefined) {
    return failure('inbox/vault-closed', 'inbox 仓库还没打开（或打开失败），稍后再试')
  }
  const live = vault.list()
  const value: RecentResult = {
    entries: live.slice(0, RECENT_LIMIT).map(toEntry),
    total: live.length,
    unread: live.filter((item) => item.status === 'unread').length,
  }
  return { ok: true, value }
}

/**
 * One JSON POST endpoint. Business failures answer 200 with `ok: false` so the
 * panel can print the reason; only a malformed request body and a transport
 * problem are HTTP-level errors.
 *
 * @param path - absolute path on the shared `/api` channel.
 * @param run - the operation, given the decoded payload.
 */
function endpoint(path: string, run: (payload: unknown) => Promise<InboxRpcResult<unknown>>): ConnectionFetchRoute {
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
      return Response.json(await run(payload))
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

    /** Run one capture at a time; the chain must survive a rejected task. */
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
        serialise(() => handleCapture(vault(), attachments, payload)),
      ),
      endpoint(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_RECENT}`, () => Promise.resolve(handleRecent(vault()))),
    ]

    for (const route of routes) {
      scoped.effect(
        () => scoped.connection.fetch.register(route),
        `dsh-inbox: ${route.path}`,
      )
    }
  })
}
