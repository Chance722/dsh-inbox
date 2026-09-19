/**
 * The wire contract between the inbox panel (browser half) and the vault (host
 * half).
 *
 * Types and constants only: the browser bundle must not pull a schema library
 * or a host package (AGENTS.md constraint 11), so the runtime validation lives
 * in `src/host/rpc.ts` and the shapes here stay structural.
 *
 * The transport is one authenticated JSON endpoint per operation, registered on
 * the shared `/api` channel through `ctx.connection.fetch.register` — the route
 * table that sits behind Connection's Host/Origin trust fence and the browser
 * cookie, unlike a bare `webServer` route. The browser half posts to
 * `<prefix>/<endpoint>` with plain `fetch`; the body is the payload itself and
 * the answer is an `InboxRpcResult`.
 *
 * Why not `ctx.connection.rpc.handle`: it resolves its HTTP route through the
 * Connection *service's* own context, which declares only `credentials`, so it
 * throws `cannot get property "webServer" without inject` as shipped in
 * 0.1.5-rc.2. Why not `rpc.intercept('/api', …)`: that channel already has one
 * interceptor (the Typert gateway) and only one is allowed.
 */

import type { Category, Kind, Status } from './vocabulary.js'

/** Authenticated path prefix every inbox endpoint lives under. */
export const INBOX_API_PREFIX = '/api/inbox'

/** File one submission (text, image bytes, generic file bytes). */
export const INBOX_ENDPOINT_CAPTURE = 'capture'

/** Read the newest records, for the panel's list. */
export const INBOX_ENDPOINT_RECENT = 'recent'

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

/** One row of the panel's recent list. */
export interface RecentEntry {
  id: string
  kind: Kind
  category: Category
  status: Status
  title?: string
  /** A short excerpt of the stored text, already trimmed by the host. */
  preview?: string
  url?: string
  platform?: string
  createdAt: string
  attachments: number
}

/** The panel list: the newest page plus the counters the header shows. */
export interface RecentResult {
  entries: RecentEntry[]
  /** Live records, soft-deleted ones excluded. */
  total: number
  unread: number
}

/** Carrier-neutral failure, mirroring Connection's `ConnectionRpcFailure`. */
export interface InboxRpcFailure {
  code: string
  message: string
  details: Record<string, unknown>
}

/** Business outcome of one call: a refused request is an answer, not a crash. */
export type InboxRpcResult<T> = { ok: true; value: T } | { ok: false; error: InboxRpcFailure }

/** How many records the panel asks for. */
export const RECENT_LIMIT = 20

/** How much stored text a list row shows before the panel truncates it. */
export const PREVIEW_CHARS = 140

/** Most attachments one submission may carry; mirrors the composer's own ceiling. */
export const MAX_ATTACHMENTS_PER_SUBMISSION = 20
