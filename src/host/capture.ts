/**
 * Capture rules: what a pasted thing is, how to spot a repeat, and how to file
 * it. Everything here is deterministic; classification proper (which category a
 * link or an image belongs to) is M5's job.
 */

import type { Source } from '../shared/vocabulary.js'
import type { Attachment, Item } from './vault/spec.js'
import type { NewItem, Vault } from './vault/vault.js'

/** Hostname suffix → platform tag. Small on purpose; extend as real links appear. */
const PLATFORMS: readonly (readonly [string, string])[] = [
  ['bilibili.com', 'bilibili'],
  ['b23.tv', 'bilibili'],
  ['mp.weixin.qq.com', 'wechat'],
  ['weixin.qq.com', 'wechat'],
  ['zhihu.com', 'zhihu'],
  ['xiaohongshu.com', 'xiaohongshu'],
  ['xhslink.com', 'xiaohongshu'],
  ['maimai.cn', 'maimai'],
  ['github.com', 'github'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['x.com', 'twitter'],
  ['twitter.com', 'twitter'],
]

/** Query parameters that only describe how the link travelled, never what it is. */
const TRACKING_PARAMS = [
  'spm_id_from',
  'vd_source',
  'share_source',
  'share_medium',
  'from',
  'from_source',
  'share_token',
]

function parse(raw: string): URL | undefined {
  try {
    return new URL(raw)
  } catch {
    return undefined
  }
}

/** The platform a URL belongs to, or undefined when it is just "somewhere". */
export function platformOf(raw: string): string | undefined {
  const url = parse(raw)
  if (url === undefined) return undefined
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  for (const [suffix, platform] of PLATFORMS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return platform
  }
  return undefined
}

/**
 * Decide what a pasted string is.
 *
 * A single bare `http(s)` URL is a link; anything else is text. A sentence that
 * merely contains a URL stays text: the vault must not reinterpret prose.
 *
 * @param raw - exactly what was pasted.
 * @returns the kind, plus url and (when recognised) platform for links.
 */
export function sniff(raw: string): { kind: 'link' | 'text'; url?: string; platform?: string } {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || /\s/.test(trimmed) || !/^https?:\/\//i.test(trimmed)) {
    return { kind: 'text' }
  }
  if (parse(trimmed) === undefined) return { kind: 'text' }
  const platform = platformOf(trimmed)
  return { kind: 'link', url: trimmed, ...(platform === undefined ? {} : { platform }) }
}

/**
 * Normalise a link for repeat detection: drop the fragment and the parameters
 * that only record where a share came from, and unify the host case.
 *
 * Deliberately conservative — real identity lives in paths (`/s/<id>`,
 * `/video/BV…`) and in the parameters we keep.
 */
export function normalizeLink(raw: string): string {
  const url = parse(raw)
  if (url === undefined) return raw.trim()
  url.hash = ''
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  for (const param of [...url.searchParams.keys()]) {
    if (param.startsWith('utm_') || TRACKING_PARAMS.includes(param)) url.searchParams.delete(param)
  }
  const search = url.searchParams.toString()
  const path = url.pathname.replace(/\/$/, '')
  return `${url.protocol}//${url.host}${path}${search.length === 0 ? '' : `?${search}`}`
}

/** The outcome of a capture: what was stored, and whether it merged. */
export interface CaptureOutcome {
  item: Item
  /** True when an existing record absorbed this capture. */
  merged: boolean
}

/** Keep a note the user already wrote; accept the incoming one only if empty. */
function mergedNote(current: Item, incoming?: string): string | undefined {
  if (incoming === undefined || incoming.length === 0) return current.note
  return current.note ?? incoming
}

async function absorb(
  vault: Vault,
  existing: Item,
  incoming: { note?: string; title?: string },
): Promise<CaptureOutcome> {
  const next = await vault.patch(existing.id, {
    note: mergedNote(existing, incoming.note),
    ...(existing.title === undefined && incoming.title !== undefined
      ? { title: incoming.title }
      : {}),
  })
  return { item: next, merged: true }
}

/**
 * File a pasted string.
 *
 * Repeats merge into the existing record: the vault answers "what have I
 * stored", not "how many times did I paste".
 *
 * @param vault - the open vault.
 * @param raw - the pasted string.
 * @param source - which entry point produced it.
 * @param note - optional description the user supplied.
 * @returns the stored (or merged) record, and whether it merged.
 */
export async function captureText(
  vault: Vault,
  raw: string,
  source: Source,
  note?: string,
): Promise<CaptureOutcome> {
  const sniffed = sniff(raw)
  const candidate: NewItem = {
    kind: sniffed.kind,
    category: 'other',
    source,
    ...(note === undefined || note.length === 0 ? {} : { note }),
    ...(sniffed.kind === 'link'
      ? {
          url: sniffed.url,
          ...(sniffed.platform === undefined ? {} : { platform: sniffed.platform }),
        }
      : { text: raw }),
  }

  const existing = vault
    .list({ includeDeleted: true, kinds: [sniffed.kind] })
    .find((item) =>
      sniffed.kind === 'link'
        ? item.url !== undefined && normalizeLink(item.url) === normalizeLink(raw)
        : item.text === raw,
    )

  if (existing !== undefined) return absorb(vault, existing, { note })
  return { item: await vault.create(candidate), merged: false }
}

/** Attachment reference as it arrives from the composer's durable blocks. */
export type CapturedAttachment = Pick<Attachment, 'id' | 'mime' | 'bytes'> &
  Partial<Pick<Attachment, 'filename' | 'width' | 'height' | 'sha256'>>

/**
 * File one durable attachment the composer handed over.
 *
 * The bytes stay in dsh's own attachment store (content-addressed, never
 * auto-deleted); the vault keeps the reference plus what we can show without
 * reading the bytes back.
 *
 * @param vault - the open vault.
 * @param attachment - the block's attachment reference.
 * @param source - which entry point produced it.
 * @param note - optional description the user supplied.
 * @returns the stored (or merged) record, and whether it merged.
 */
export async function captureImage(
  vault: Vault,
  attachment: CapturedAttachment,
  source: Source,
  note?: string,
): Promise<CaptureOutcome> {
  const existing = vault
    .list({ includeDeleted: true, kinds: ['image', 'file'] })
    .find((item) => item.attachmentIds.includes(attachment.id))

  if (existing !== undefined) return absorb(vault, existing, { note })

  await vault.addAttachment({ ...attachment, createdAt: new Date().toISOString() })
  const item = await vault.create({
    kind: attachment.mime.startsWith('image/') ? 'image' : 'file',
    category: 'other',
    source,
    ...(note === undefined || note.length === 0 ? {} : { note }),
    attachmentIds: [attachment.id],
  })
  return { item, merged: false }
}

/** What one capture submission carried: free text and/or durable attachments. */
export interface CapturePayload {
  text?: string
  attachments?: readonly CapturedAttachment[]
}

/** Roll-up of one capture submission. */
export interface CaptureSummary {
  stored: number
  merged: number
}

/**
 * File one submission from any entry point.
 *
 * Order is attachments first, then text, so a note that arrived with the
 * submission can still be attached to the item it belongs to.
 *
 * @param vault - the open vault.
 * @param payload - the submitted text and attachments.
 * @param source - which entry point produced them.
 * @returns how many records were stored and how many merged.
 */
export async function capture(
  vault: Vault,
  payload: CapturePayload,
  source: Source,
): Promise<CaptureSummary> {
  let stored = 0
  let merged = 0
  const tally = (outcome: CaptureOutcome): void => {
    if (outcome.merged) merged += 1
    else stored += 1
  }

  for (const attachment of payload.attachments ?? []) {
    tally(await captureImage(vault, attachment, source))
  }

  const text = payload.text?.trim() ?? ''
  if (text.length > 0) tally(await captureText(vault, text, source))

  return { stored, merged }
}
