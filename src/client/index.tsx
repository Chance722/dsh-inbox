/**
 * The browser half: the sidebar entry, the capture box, and the recent list.
 *
 * Everything the vault knows lives on the host side; this half only renders and
 * submits through the Connection RPC channel declared in
 * `src/shared/capture.ts`.
 */

import type { Context } from '@deepseek-ai/cordis'
import React from 'react'

import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_CAPTURE,
  INBOX_ENDPOINT_RECENT,
  INBOX_IMAGE_TYPES,
  type CaptureResult,
  type InboxRpcResult,
  type RecentEntry,
  type RecentResult,
  type WireFile,
  type WireImage,
} from '../shared/capture.js'
import { MILESTONE, PANEL_ID, PACKAGE_NAME } from '../shared/constants.js'
import { CATEGORY_LABELS, KIND_LABELS, STATUS_LABELS } from '../shared/vocabulary.js'

/** Stable Cordis plugin name for the browser half. */
export const name = 'dsh-inbox-client'

/**
 * `slots` is a hard dependency: without it Cordis runs `apply` before the slot
 * registry exists and every registration is silently skipped (M0's trap).
 */
export const inject = ['slots']

/** Owner share the sidebar hands to a global panel icon (see ui-sidebar slots). */
interface PanelIconProps {
  size: number
  active: boolean
}

/**
 * Register the sidebar switch and the panel it selects.
 *
 * Both slots belong to other packages, so each registration waits for the
 * declaration through `slots.inject` instead of assuming an order.
 *
 * @param ctx - browser plugin context carrying the slot registry and the wire client.
 */
export function apply(ctx: Context): void {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  slots.inject('sidebar.panellist', () =>
    slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: 'Inbox' },
      InboxPanelIcon,
    ),
  )

  slots.inject('main', () =>
    slots.register({ name: 'main', key: PANEL_ID }, () => <InboxPanel ctx={ctx} />),
  )
}

/** Sidebar row icon: a box glyph sized to the shell's requested square. */
function InboxPanelIcon({ size, active }: PanelIconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h5l2 3h4l2-3h5" />
      <path d="M5 5h14l2 7v7H3v-7z" />
    </svg>
  )
}

/** One file the user pasted or dropped, held until they submit. */
interface Staged {
  id: string
  name: string
  /** `image` entries take the attachment store's image path; everything else is a file. */
  slot: 'image' | 'file'
  bytes: number
  file: File
  previewUrl?: string
}

const panelStyle: React.CSSProperties = {
  padding: '24px',
  font: '14px/1.6 system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  height: '100%',
  boxSizing: 'border-box',
  overflow: 'auto',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
  borderRadius: '10px',
  padding: '12px',
}

const buttonStyle: React.CSSProperties = {
  font: 'inherit',
  padding: '6px 14px',
  borderRadius: '8px',
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
}

/** The panel body: capture on top, what is already stored underneath. */
function InboxPanel({ ctx }: { ctx: Context }): React.ReactElement {
  const [text, setText] = React.useState('')
  const [staged, setStaged] = React.useState<Staged[]>([])
  const [notice, setNotice] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [recent, setRecent] = React.useState<RecentResult>()
  const picker = React.useRef<HTMLInputElement>(null)

  /**
   * One POST to the vault channel.
   *
   * Plain `fetch` is enough: the panel runs on the authenticated page, and
   * Connection's fence reads the signed cookie the launch URL minted. No client
   * service is involved, so the browser half needs no host-facing import.
   */
  const call = React.useCallback(
    async (endpoint: string, payload: unknown): Promise<InboxRpcResult<unknown>> => {
      try {
        const response = await fetch(`${INBOX_API_PREFIX}/${endpoint}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const answer: unknown = await response.json()
        if (!isRpcResult(answer)) {
          return {
            ok: false,
            error: {
              code: 'inbox/malformed-answer',
              message: `宿主返回了看不懂的响应（HTTP ${String(response.status)}）`,
              details: {},
            },
          }
        }
        return answer
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'inbox/transport',
            message: error instanceof Error ? error.message : String(error),
            details: {},
          },
        }
      }
    },
    [],
  )

  const refresh = React.useCallback(async (): Promise<void> => {
    const result = await call(INBOX_ENDPOINT_RECENT, {})
    if (result.ok) setRecent(result.value as RecentResult)
    else setNotice(`读取列表失败：${result.error.message}`)
  }, [call])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  /** Stage files; a text part that arrived with them rides along into the box. */
  const stage = (files: FileList | File[], extraText?: string): void => {
    const next: Staged[] = []
    for (const file of Array.from(files)) {
      const isImage = (INBOX_IMAGE_TYPES as readonly string[]).includes(file.type)
      next.push({
        id: `${file.name}:${file.size}:${file.lastModified}:${next.length}`,
        name: file.name.length === 0 ? '（未命名）' : file.name,
        slot: isImage ? 'image' : 'file',
        bytes: file.size,
        file,
        ...(isImage ? { previewUrl: URL.createObjectURL(file) } : {}),
      })
    }
    if (next.length > 0) setStaged((current) => [...current, ...next])
    if (extraText !== undefined && extraText.length > 0) {
      setText((current) => (current.length === 0 ? extraText : `${current}\n${extraText}`))
    }
  }

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = event.clipboardData.files
    if (files.length === 0) return
    // The image never arrives as text, so take over the event and keep the text
    // part ourselves: letting the browser paste it would drop the files.
    event.preventDefault()
    stage(files, event.clipboardData.getData('text/plain'))
  }

  const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) stage(event.dataTransfer.files)
  }

  const submit = async (): Promise<void> => {
    if (busy) return
    const trimmed = text.trim()
    if (trimmed.length === 0 && staged.length === 0) {
      setNotice('还没东西可存：粘一段文字、一个链接，或者把图片拖进来')
      return
    }

    setBusy(true)
    setNotice(undefined)
    try {
      const images: WireImage[] = []
      const files: WireFile[] = []
      for (const entry of staged) {
        const data = await toBase64(entry.file)
        if (entry.slot === 'image') {
          images.push({ mediaType: entry.file.type as WireImage['mediaType'], data, name: entry.name })
        } else {
          files.push({ data, name: entry.name })
        }
      }

      const result = await call(INBOX_ENDPOINT_CAPTURE, { text: trimmed, images, files })
      if (!result.ok) {
        setNotice(`没存进去：${result.error.message}`)
        return
      }

      setNotice(describe(result.value as CaptureResult))
      setText('')
      for (const entry of staged) {
        if (entry.previewUrl !== undefined) URL.revokeObjectURL(entry.previewUrl)
      }
      setStaged([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div style={panelStyle}>
      <header>
        <h2 style={{ margin: '0 0 4px' }}>dsh-inbox</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          {PACKAGE_NAME} · {MILESTONE} · 先存下来，分类和整理随后到
        </p>
      </header>

      <div
        style={{
          ...cardStyle,
          borderStyle: dragging ? 'dashed' : 'solid',
          borderColor: dragging ? 'currentColor' : cardStyle.borderColor,
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          placeholder="粘贴文字、链接，或把图片/文件拖到这里（Ctrl+Enter 存入）"
          rows={5}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            font: 'inherit',
            color: 'inherit',
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
        />

        {staged.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: '8px 0 0',
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {staged.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                }}
              >
                {entry.previewUrl !== undefined && (
                  <img
                    src={entry.previewUrl}
                    alt=""
                    style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <span style={{ opacity: 0.85 }}>
                  {entry.slot === 'image' ? '🖼' : '📄'} {entry.name} · {formatBytes(entry.bytes)}
                </span>
                <button
                  type="button"
                  aria-label={`移除 ${entry.name}`}
                  onClick={() =>
                    setStaged((current) => current.filter((item) => item.id !== entry.id))
                  }
                  style={{ ...buttonStyle, padding: '0 6px', border: 'none', opacity: 0.6 }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <input
            ref={picker}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => {
              if (event.target.files !== null) stage(event.target.files)
              // Let the same file be picked again after a removal.
              event.target.value = ''
            }}
          />
          <button
            type="button"
            style={buttonStyle}
            disabled={busy}
            onClick={() => picker.current?.click()}
          >
            选择文件…
          </button>
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => void submit()}>
            {busy ? '存入中…' : '存入仓库'}
          </button>
          {notice !== undefined && <span style={{ opacity: 0.8 }}>{notice}</span>}
        </div>
      </div>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <strong>最近存入</strong>
          <span style={{ opacity: 0.7 }}>
            {recent === undefined ? '读取中…' : `共 ${recent.total} 条 · 未读 ${recent.unread} 条`}
            <button
              type="button"
              style={{ ...buttonStyle, marginLeft: 10, padding: '2px 8px' }}
              onClick={() => void refresh()}
            >
              刷新
            </button>
          </span>
        </div>

        {recent !== undefined && recent.entries.length === 0 && (
          <p style={{ margin: '10px 0 0', opacity: 0.7 }}>仓库还是空的。</p>
        )}

        <ul
          style={{
            listStyle: 'none',
            margin: '10px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {recent?.entries.map((entry) => (
            <RecentRow key={entry.id} entry={entry} />
          ))}
        </ul>

        <p style={{ margin: '12px 0 0', opacity: 0.6 }}>
          这一版只做入库与查看；筛选、详情、改类目、回收站跟着 M3 到。
        </p>
      </section>
    </div>
  )
}

/** One stored record as a list row. */
function RecentRow({ entry }: { entry: RecentEntry }): React.ReactElement {
  const heading = entry.title ?? entry.url ?? entry.preview ?? '（无标题）'
  return (
    <li
      style={{
        borderTop: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
        paddingTop: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ opacity: 0.6 }}>{KIND_LABELS[entry.kind]}</span>
        <span style={{ opacity: 0.6 }}>· {CATEGORY_LABELS[entry.category]}</span>
        <span style={{ opacity: 0.6 }}>· {STATUS_LABELS[entry.status]}</span>
        {entry.platform !== undefined && <span style={{ opacity: 0.6 }}>· {entry.platform}</span>}
        {entry.attachments > 0 && <span style={{ opacity: 0.6 }}>· {entry.attachments} 个附件</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
          {new Date(entry.createdAt).toLocaleString()}
        </span>
      </div>
      <div style={{ marginTop: 2, overflowWrap: 'anywhere' }}>
        {entry.url === undefined ? (
          heading
        ) : (
          <a href={entry.url} target="_blank" rel="noreferrer">
            {heading}
          </a>
        )}
      </div>
    </li>
  )
}

/** What the user reads after a successful submission. */
function describe(summary: CaptureResult): string {
  const parts: string[] = []
  if (summary.stored > 0) parts.push(`已存入 ${summary.stored} 条`)
  if (summary.merged > 0) parts.push(`合并 ${summary.merged} 条重复项`)
  return parts.join('，')
}

/** Distinguish a vault answer from whatever else an HTTP layer might return. */
function isRpcResult(value: unknown): value is InboxRpcResult<unknown> {
  return typeof value === 'object' && value !== null && 'ok' in value
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Base64 without blowing the argument limit: `String.fromCharCode(...bytes)` on
 * a multi-megabyte image throws, so convert in fixed-size chunks.
 */
async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}
