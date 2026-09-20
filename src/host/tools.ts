/**
 * The model-facing tools: what the vault looks like from inside a conversation.
 *
 * Two rules shape every string these tools return.
 *
 * 1. **Credentials never leave the vault.** A record classified as `secret`
 *    answers with a refusal, not with its text — the model must not be able to
 *    read one out by asking, and the session log must not collect it.
 * 2. **Attachment bytes never cross the conversation.** A tool result is model
 *    visible and persisted, so an image is described by a marker the panel and
 *    the tool card resolve locally; the picture itself is never part of the
 *    result. That keeps a pasted ID document out of the cloud even when the
 *    model is the one that fetched the record.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

import {
  MAX_FILTER_CHARS,
  PREVIEW_CHARS,
  type AttachmentSummary,
  type EntrySummary,
} from '../shared/panel-wire.js'
import {
  CATEGORY_LABELS,
  KIND_LABELS,
  type Category,
  type Kind,
} from '../shared/vocabulary.js'
import type { Attachment, Item } from './vault/spec.js'
import type { Vault } from './vault/vault.js'

/** How many records one search answers with before saying "there are more". */
export const SEARCH_PAGE = 10

/** How much of a stored text the model reads; the rest stays in the vault. */
export const TEXT_BUDGET = 1_000

/** Marker the tool card turns into a thumbnail; the bytes stay off the wire. */
export function attachmentMarker(attachmentId: string): string {
  return `[attachment:${attachmentId}]`
}

function when(item: Item): string {
  return new Date(item.createdAt).toLocaleString()
}

function labelOf(item: Item): string {
  return `[${KIND_LABELS[item.kind]} · ${CATEGORY_LABELS[item.category]}${
    item.platform === undefined ? '' : ` · ${item.platform}`
  }]`
}

/**
 * One line a reader can scan; the title is whatever the record actually has.
 *
 * A credential record never falls back to its own text — the headline is as
 * model-visible as the body, so a `secret` record would leak through its title
 * even when the body is refused.
 */
function headline(item: Item): string {
  if (item.title !== undefined) return item.title
  // The headline the page itself carries beats the URL it arrived as, and it
  // costs the model nothing to read it: the fetch happened at capture time.
  if (item.linkTitle !== undefined) return item.linkTitle
  if (item.url !== undefined) return item.url
  if (item.note !== undefined && item.note.length > 0) return item.note
  if (item.category !== 'secret' && item.text !== undefined) {
    const flat = item.text.replace(/\s+/g, ' ').trim()
    return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS)}…` : flat
  }
  if (item.category === 'secret') return '（密钥类记录，明文不外传）'
  return item.attachmentIds.length > 0 ? `（${String(item.attachmentIds.length)} 个附件）` : '（无标题）'
}

/**
 * Render a search answer.
 *
 * @param entries - the page of matches, newest first.
 * @param matched - how many records matched in total.
 * @returns the model-facing text.
 */
export function formatSearch(entries: readonly Item[], matched: number): string {
  if (matched === 0) {
    return '仓库里没有匹配的记录。可以换个说法，或者让用户在 dsh-inbox 面板里翻一翻。'
  }

  const lines = entries.map((item, index) => {
    const parts = [`${String(index + 1)}. ${labelOf(item)} ${headline(item)}`]
    // The URL and the note are "the rest of it": worth a line once the headline
    // has already said what this is, noise while it *is* the headline.
    const named = item.title ?? item.linkTitle
    if (item.note !== undefined && item.note.length > 0 && named !== undefined) {
      parts.push(`   备注：${item.note}`)
    }
    if (item.url !== undefined && named !== undefined) parts.push(`   ${item.url}`)
    if (item.tags.length > 0) parts.push(`   标签：${item.tags.map((tag) => `#${tag}`).join(' ')}`)
    parts.push(`   存入：${when(item)} · id: ${item.id}`)
    return parts.join('\n')
  })

  const header =
    matched > entries.length
      ? `匹配 ${String(matched)} 条，先看最近 ${String(entries.length)} 条：`
      : `匹配 ${String(matched)} 条：`
  const tail =
    matched > entries.length
      ? `\n还有 ${String(matched - entries.length)} 条没列出来——需要的话再缩小条件，或者让用户到面板里看全部。`
      : ''

  return `${header}\n\n${lines.join('\n\n')}${tail}`
}

/** Attachment facts, minus anything that would leak the bytes. */
function describeAttachment(attachment: Attachment): string {
  const size =
    attachment.bytes < 1024
      ? `${String(attachment.bytes)} B`
      : `${(attachment.bytes / 1024).toFixed(1)} KB`
  const dimensions =
    attachment.width === undefined || attachment.height === undefined
      ? ''
      : ` · ${String(attachment.width)}×${String(attachment.height)}`
  return `${attachment.filename ?? attachment.mime} · ${attachment.mime}${dimensions} · ${size}`
}

/**
 * Render one record in full, under the two rules above.
 *
 * @param vault - the open vault, for attachment metadata.
 * @param item - the record to describe.
 * @returns the model-facing text.
 */
export function formatDetail(vault: Vault, item: Item): string {
  const header = `【${labelOf(item).slice(1, -1)}】${headline(item)}\n存入：${when(item)} · id: ${item.id}`

  if (item.category === 'secret') {
    return `${header}\n\n这条记录被归类为密钥/账密：**明文不会通过对话输出**。请让用户到 dsh-inbox 面板里查看与复制——这也是这条记录能被安全检索的原因。`
  }

  const blocks: string[] = [header]
  if (item.url !== undefined) blocks.push(item.url)
  if (item.note !== undefined && item.note.length > 0) blocks.push(`备注（用户写的）：${item.note}`)
  if (item.tags.length > 0) blocks.push(`标签：${item.tags.map((tag) => `#${tag}`).join(' ')}`)

  if (item.text !== undefined && item.text.length > 0) {
    if (item.text.length <= TEXT_BUDGET) {
      blocks.push(item.text)
    } else {
      blocks.push(
        `${item.text.slice(0, TEXT_BUDGET)}\n\n（共 ${String(item.text.length)} 字，这里是前 ${String(TEXT_BUDGET)} 字；剩余部分在面板里看）`,
      )
    }
  }

  const attachments: Attachment[] = []
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId)
    if (record !== undefined) attachments.push(record)
  }
  if (attachments.length > 0) {
    const lines = attachments.map((attachment) => `- ${describeAttachment(attachment)}`)
    if (item.category === 'document') {
      lines.push(
        '（证件类：图片的字节不会进入对话，也不会发给模型；卡片里的缩略图是在本机渲染的。）',
      )
    }
    for (const attachment of attachments) lines.push(attachmentMarker(attachment.id))
    blocks.push(`附件：\n${lines.join('\n')}`)
  }

  return blocks.join('\n\n')
}

/** Project one record down to what a card needs (kept for the card contract). */
export function summaryOf(item: Item): EntrySummary {
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    watchLater: item.watchLater === true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: [...item.tags],
    attachmentCount: item.attachmentIds.length,
    ...(item.title === undefined ? {} : { title: item.title }),
    ...(item.linkTitle === undefined ? {} : { linkTitle: item.linkTitle }),
    ...(item.url === undefined ? {} : { url: item.url }),
    ...(item.platform === undefined ? {} : { platform: item.platform }),
    ...(item.note === undefined ? {} : { note: item.note }),
  }
}

/** Attachment summary projection, shared with the panel wire. */
export function attachmentsOf(vault: Vault, item: Item): AttachmentSummary[] {
  const out: AttachmentSummary[] = []
  for (const attachmentId of item.attachmentIds) {
    const record = vault.getAttachment(attachmentId)
    if (record === undefined) continue
    out.push({
      id: record.id,
      mime: record.mime,
      bytes: record.bytes,
      image: record.mime.startsWith('image/'),
      ...(record.filename === undefined ? {} : { filename: record.filename }),
      ...(record.width === undefined ? {} : { width: record.width }),
      ...(record.height === undefined ? {} : { height: record.height }),
    })
  }
  return out
}

const CATEGORY_VALUES = ['idea', 'article', 'media', 'image', 'document', 'secret', 'other'] as const
const KIND_VALUES = ['text', 'link', 'image', 'file'] as const

/** Best-effort narrowing of a model-supplied string to one of our vocabularies. */
function narrow<T extends string>(values: readonly T[], raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined
  const match = values.find((value) => value === raw.trim().toLowerCase())
  return match
}

/**
 * Register the vault's model-facing tools.
 *
 * @param ctx - host context carrying the tool registry.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export function registerInboxTools(ctx: Context, vault: () => Vault | undefined): void {
  ctx.tools.register(
    defineTool({
      name: 'inbox_search',
      description:
        "Search the user's local dsh-inbox vault — the personal store where they paste links, text, images and credentials. " +
        'Use it whenever they ask what they saved, want a link they stored earlier, or want the ones they flagged 待看. ' +
        'Returns at most ten matches with their ids, newest first; records classified as secrets are listed but their text is never returned.',
      parameters: {
        text: { type: 'string', description: 'Words to look for in title, text, url, note or tags.' },
        category: {
          type: 'string',
          description: `One of: ${CATEGORY_VALUES.join(', ')}.`,
        },
        watchLater: { type: 'boolean', description: 'true for only the records the user flagged 待看.' },
        kind: { type: 'string', description: 'text, link, image or file.' },
        tag: { type: 'string', description: 'Only records carrying this exact tag.' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const open = vault()
        if (open === undefined) return '仓库没有打开（或打开失败），暂时查不了。'

        const category = narrow(CATEGORY_VALUES, args.category) as Category | undefined
        const kind = narrow(KIND_VALUES, args.kind) as Kind | undefined

        const matched = open.list({
          ...(args.text === undefined ? {} : { text: args.text.slice(0, MAX_FILTER_CHARS) }),
          ...(category === undefined ? {} : { categories: [category] }),
          ...(args.watchLater === undefined ? {} : { watchLater: args.watchLater }),
          ...(kind === undefined ? {} : { kinds: [kind] }),
          ...(args.tag === undefined ? {} : { tags: [args.tag] }),
        })

        return formatSearch(matched.slice(0, SEARCH_PAGE), matched.length)
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'inbox_get',
      description:
        'Open one record from the dsh-inbox vault by the id a search returned: its text (truncated to 1000 characters), ' +
        'link, note, tags and attachment facts. Credentials are never returned in clear text, and image bytes are never put ' +
        'into the conversation — images come back as attachment markers the UI renders locally.',
      parameters: {
        id: { type: 'string', required: true, description: 'The record id from inbox_search.' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const open = vault()
        if (open === undefined) return '仓库没有打开（或打开失败），暂时查不了。'

        const item = open.get(args.id.trim())
        if (item === undefined) return `没找到 id 为 ${args.id} 的记录；它可能已经被删掉了。`

        return formatDetail(open, item)
      },
    }),
  )
}
