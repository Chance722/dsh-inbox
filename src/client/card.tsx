/**
 * The conversation cards for `inbox_search` and `inbox_get`.
 *
 * Cards are derived from the raw tool-call block (the model-facing result), not
 * from any host-side presentation intent — so what the reader sees is exactly
 * what the model saw, with two local touches: URLs become links, and
 * `[attachment:<id>]` markers become thumbnails fetched from the panel's own
 * attachment route. The second one is deliberate: the picture is rendered here,
 * on this machine, and never became part of the conversation.
 */

import React from 'react'

import { INBOX_API_PREFIX, INBOX_ENDPOINT_ATTACHMENT, type InboxRpcResult } from '../shared/panel-wire.js'
import { openVaultDock } from './dock.js'

/** `[attachment:<uuid>]`, the marker `src/host/tools.ts` emits. */
const MARKER = /\[attachment:([A-Za-z0-9_-]+)\]/g

const URL_PATTERN = /(https?:\/\/[^\s<>()]+)/g

/**
 * `id: <uuid>` — how the tool results name a record.
 *
 * Exported because it is the whole of the "click a record and go look at it"
 * feature on this side: the button is only as reliable as finding the id in the
 * text the model was shown.
 */
export const RECORD_ID = /id: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g

/** Every record id in one tool result, in the order they appear. */
export function recordIdsIn(text: string): string[] {
  RECORD_ID.lastIndex = 0
  return [...text.matchAll(RECORD_ID)].map((match) => match[1] ?? '')
}

/** The slice of the tool-call block a card needs. */
interface CardBlock {
  text?: unknown
  content?: unknown
  isError?: unknown
}

/** Owner props this card uses; the rest of the share is not needed here. */
export interface ToolCardProps {
  toolName: string
  block: CardBlock
}

/** Pull the result text out of whatever shape the settled block carries. */
function resultText(block: CardBlock): string | undefined {
  if (typeof block.text === 'string' && block.text.length > 0) return block.text
  if (!Array.isArray(block.content)) return undefined
  const parts: string[] = []
  for (const part of block.content) {
    if (typeof part !== 'object' || part === null) continue
    const candidate = part as { type?: unknown; text?: unknown }
    if (candidate.type === 'text' && typeof candidate.text === 'string') parts.push(candidate.text)
  }
  return parts.length === 0 ? undefined : parts.join('\n')
}

/**
 * One result line's trailing id, as something to click.
 *
 * Opening the record in the right dock is the whole point: the conversation
 * shows what the model said, and the dock is where the same record can actually
 * be looked at — its text, its link, its picture.
 */
function RecordLink({ id }: { id: string }): React.ReactElement | null {
  // The dock can only be opened from a session surface, which is exactly where a
  // card lives; when nothing registered one, there is nothing to offer.
  if (openVaultDock === undefined) return null
  return (
    <button
      type="button"
      title="在右侧「仓库」里打开这条"
      onClick={() => openVaultDock?.(id)}
      style={{
        font: 'inherit',
        marginLeft: 6,
        padding: '0 8px',
        borderRadius: 999,
        border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
        background: 'color-mix(in srgb, currentColor 8%, transparent)',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      打开 ↗
    </button>
  )
}

/** Turn bare URLs into anchors; everything else stays text. */
function withLinks(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  /*
    Two patterns, one pass each: the link first (it is the noisy one), then the
    record id — a line like `存入：… · id: 5b1f…` gets both a clickable address
    and a way into the vault. Splitting on ids after links means the id text is
    already plain, so no nesting rules to think about.
  */
  for (const chunk of splitOnRecordIds(text, keyPrefix)) {
    if (typeof chunk !== 'string') {
      nodes.push(chunk)
      continue
    }
    URL_PATTERN.lastIndex = 0
    last = 0
    while ((match = URL_PATTERN.exec(chunk)) !== null) {
      if (match.index > last) nodes.push(chunk.slice(last, match.index))
      const url = match[0]
      nodes.push(
        <a key={`${keyPrefix}-${String(match.index)}`} href={url} target="_blank" rel="noreferrer">
          {url}
        </a>,
      )
      last = match.index + url.length
    }
    if (last < chunk.length) nodes.push(chunk.slice(last))
  }
  return nodes
}

/** Text and record buttons, in the order they appear. */
function splitOnRecordIds(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  RECORD_ID.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = RECORD_ID.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const id = match[1]
    parts.push(
      <span key={`${keyPrefix}-r${String(match.index)}`} style={{ opacity: 0.55, fontSize: 12 }}>
        id: {id}
      </span>,
      <RecordLink key={`${keyPrefix}-open${String(match.index)}`} id={id ?? ''} />,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** One thumbnail, loaded from the panel's own attachment route. */
function Thumbnail({ id }: { id: string }): React.ReactElement {
  return (
    <img
      src={`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(id)}`}
      alt=""
      style={{
        maxWidth: 220,
        maxHeight: 220,
        borderRadius: 6,
        display: 'block',
        margin: '6px 0',
      }}
    />
  )
}

/** Split the result text into prose and attachment thumbnails. */
function render(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MARKER.lastIndex = 0
  while ((match = MARKER.exec(text)) !== null) {
    const before = text.slice(last, match.index)
    if (before.length > 0) nodes.push(...withLinks(before, `t${String(last)}`))
    const id = match[1]
    if (id !== undefined) nodes.push(<Thumbnail key={`a-${id}`} id={id} />)
    last = match.index + match[0].length
  }
  const tail = text.slice(last)
  if (tail.length > 0) nodes.push(...withLinks(tail, `t${String(last)}`))
  return nodes
}

/**
 * The card both tools share: a titled, monospace-ish rendering of the result
 * with links and thumbnails.
 *
 * @param props - the tool call identity and its settled block.
 * @returns the card element.
 */
export function InboxToolCard({ toolName, block }: ToolCardProps): React.ReactElement {
  const text = resultText(block)
  const isError = block.isError === true

  return (
    <div
      style={{
        border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
        borderRadius: 10,
        padding: '10px 12px',
        font: '13px/1.6 system-ui, sans-serif',
        overflowWrap: 'anywhere',
      }}
    >
      <div style={{ opacity: 0.65, marginBottom: 6 }}>
        {toolName === 'inbox_search' ? '🗂 dsh-inbox · 搜索仓库' : '🗂 dsh-inbox · 打开记录'}
        {isError ? ' · 出错' : ''}
      </div>
      {text === undefined ? (
        <div style={{ opacity: 0.6 }}>（这条调用还没有结果）</div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>{render(text)}</div>
      )}
    </div>
  )
}

/** Register both cards on the keyed tool view slot. */
export function registerToolCards(
  slots: { inject: (name: string, run: () => unknown) => unknown; register: (options: { name: string; key: string }, component: unknown) => unknown },
): void {
  for (const key of ['inbox_search', 'inbox_get']) {
    slots.inject('tool.call.toolview', () =>
      slots.register({ name: 'tool.call.toolview', key }, InboxToolCard),
    )
  }
}

/** The panel answers with this envelope; kept here for the shared shape. */
export type PanelAnswer = InboxRpcResult<unknown>
