/**
 * The browser half: the sidebar entry, the capture box, the filter bar, the
 * list, and the detail pane.
 *
 * Everything the vault knows lives on the host side; this half only renders and
 * calls the Fetch routes declared in `src/shared/panel-wire.ts`.
 */

import type { Context } from '@deepseek-ai/cordis'
import React from 'react'

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
  INBOX_ENDPOINT_PULL,
  INBOX_ENDPOINT_PROBE,
  INBOX_ENDPOINT_WEBDAV,
  INBOX_IMAGE_TYPES,
  LIST_LIMIT,
  type CaptureResult,
  type DetailResult,
  type EntryDetail,
  type EntrySummary,
  type InboxRpcResult,
  type ListResult,
  type PullResult,
  type ProbeRow,
  type PurgeResult,
  type WebdavRequest,
  type WebdavStatus,
  type WireFile,
  type WireImage,
} from '../shared/panel-wire.js'
import { MILESTONE, PANEL_ID, PACKAGE_NAME } from '../shared/constants.js'
import { registerToolCards } from './card.js'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SOURCE_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type Category,
} from '../shared/vocabulary.js'

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
 * @param ctx - browser plugin context carrying the slot registry.
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

  slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID }, InboxPanel))

  registerToolCards(slots)
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

/** One file the user pasted, dropped or picked, held until they submit. */
interface Staged {
  id: string
  name: string
  /** `image` entries take the attachment store's image path; everything else is a file. */
  slot: 'image' | 'file'
  bytes: number
  file: File
  previewUrl?: string
}

/** Which shelf the list is showing. */
type Scope = 'live' | 'bin'

const panelStyle: React.CSSProperties = {
  padding: '20px 24px',
  font: '14px/1.6 system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  height: '100%',
  boxSizing: 'border-box',
  overflow: 'auto',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
  borderRadius: 10,
  padding: 12,
}

const buttonStyle: React.CSSProperties = {
  font: 'inherit',
  padding: '5px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  ...buttonStyle,
  padding: '2px 10px',
  borderRadius: 999,
  opacity: active ? 1 : 0.7,
  fontWeight: active ? 600 : 400,
  borderColor: active ? 'currentColor' : 'color-mix(in srgb, currentColor 20%, transparent)',
})

const inputStyle: React.CSSProperties = {
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
  borderRadius: 8,
  padding: '5px 8px',
}

/** The panel body: capture, then filter, list and detail. */
function InboxPanel(): React.ReactElement {
  const [text, setText] = React.useState('')
  const [staged, setStaged] = React.useState<Staged[]>([])
  const [notice, setNotice] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const picker = React.useRef<HTMLInputElement>(null)

  const [scope, setScope] = React.useState<Scope>('live')
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [category, setCategory] = React.useState<Category>()
  const [tag, setTag] = React.useState<string>()
  const [search, setSearch] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [list, setList] = React.useState<ListResult>()
  const [selectedId, setSelectedId] = React.useState<string>()
  const [detail, setDetail] = React.useState<EntryDetail>()
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  /** One POST to the vault channel; see the transport note in panel-wire.ts. */
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

  const refresh = React.useCallback(
    async (keepSelection = true): Promise<void> => {
      const result = await call(INBOX_ENDPOINT_LIST, {
        scope,
        ...(unreadOnly ? { statuses: ['unread'] } : {}),
        ...(category === undefined ? {} : { categories: [category] }),
        ...(tag === undefined ? {} : { tags: [tag] }),
        ...(query.trim().length === 0 ? {} : { text: query.trim() }),
        limit: LIST_LIMIT,
      })
      if (!result.ok) {
        setNotice(`读取列表失败：${result.error.message}`)
        return
      }
      const next = result.value as ListResult
      setList(next)
      if (!keepSelection || !next.entries.some((entry) => entry.id === selectedId)) {
        setSelectedId(undefined)
        setDetail(undefined)
      }
    },
    [call, category, query, scope, selectedId, tag, unreadOnly],
  )

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  /** Debounce the search box so typing does not spam the host. */
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const openDetail = React.useCallback(
    async (id: string): Promise<void> => {
      setSelectedId(id)
      const result = await call(INBOX_ENDPOINT_DETAIL, { id })
      if (!result.ok) {
        setNotice(`读取详情失败：${result.error.message}`)
        setDetail(undefined)
        return
      }
      setDetail((result.value as DetailResult).entry)
    },
    [call],
  )

  /** Run one mutation, then re-read both the detail and the list. */
  const mutate = React.useCallback(
    async (
      endpoint: string,
      payload: unknown,
      { dropSelection = false }: { dropSelection?: boolean } = {},
    ): Promise<boolean> => {
      setBusy(true)
      try {
        const result = await call(endpoint, payload)
        if (!result.ok) {
          setNotice(`${result.error.message}`)
          return false
        }
        setNotice(undefined)
        if (dropSelection) {
          setSelectedId(undefined)
          setDetail(undefined)
        } else if (selectedId !== undefined && !dropSelection) {
          await openDetail(selectedId)
        }
        await refresh()
        return true
      } finally {
        setBusy(false)
      }
    },
    [call, openDetail, refresh, selectedId],
  )

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
      await refresh(false)
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>dsh-inbox</h2>
            <p style={{ margin: 0, opacity: 0.7 }}>
              {PACKAGE_NAME} · {MILESTONE}
              {list === undefined
                ? ''
                : ` · 共 ${String(list.total)} 条 · 未读 ${String(list.unread)} 条 · 回收站 ${String(list.deleted)} 条`}
            </p>
          </div>
          <button
            type="button"
            style={{ ...buttonStyle, marginLeft: 'auto' }}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            ⚙ 入库设置
          </button>
        </div>
      </header>

      {settingsOpen && <WebdavSettings call={call} onClose={() => setSettingsOpen(false)} />}

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
          rows={3}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
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
            {busy ? '处理中…' : '存入仓库'}
          </button>
          {notice !== undefined && <span style={{ opacity: 0.8 }}>{notice}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={chipStyle(scope === 'live' && !unreadOnly)}
          onClick={() => {
            setScope('live')
            setUnreadOnly(false)
          }}
        >
          全部 {list === undefined ? '' : list.total}
        </button>
        <button
          type="button"
          style={chipStyle(scope === 'live' && unreadOnly)}
          onClick={() => {
            setScope('live')
            setUnreadOnly(true)
          }}
        >
          未读 {list === undefined ? '' : list.unread}
        </button>
        <button
          type="button"
          style={chipStyle(scope === 'bin')}
          onClick={() => setScope('bin')}
        >
          回收站 {list === undefined ? '' : list.deleted}
        </button>

        <span style={{ width: 1, height: 18, background: 'currentColor', opacity: 0.2 }} />

        {list?.categories.map((facet) => (
          <button
            key={facet.value}
            type="button"
            style={chipStyle(category === facet.value)}
            onClick={() => setCategory(category === facet.value ? undefined : facet.value)}
          >
            {CATEGORY_LABELS[facet.value]} {facet.count}
          </button>
        ))}

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜标题、正文、链接、备注…"
          style={{ ...inputStyle, marginLeft: 'auto', minWidth: 180 }}
        />
        <button type="button" style={buttonStyle} onClick={() => void refresh()}>
          刷新
        </button>
      </div>

      {list !== undefined && list.tags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ opacity: 0.6 }}>标签</span>
          {list.tags.map((facet) => (
            <button
              key={facet.value}
              type="button"
              style={chipStyle(tag === facet.value)}
              onClick={() => setTag(tag === facet.value ? undefined : facet.value)}
            >
              #{facet.value} {facet.count}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 1.4fr', gap: 14 }}>
        <section style={{ ...cardStyle, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>{scope === 'bin' ? '回收站' : '存入的'}</strong>
            <span style={{ opacity: 0.6 }}>
              {list === undefined ? '读取中…' : `${String(list.matched)} 条匹配`}
            </span>
          </div>

          {scope === 'bin' && (list?.deleted ?? 0) > 0 && (
            <button
              type="button"
              style={{ ...buttonStyle, marginBottom: 8 }}
              disabled={busy}
              onClick={() => {
                if (!window.confirm('清空回收站会真的删掉这些记录，不能撤销。附件字节仍留在 dsh 的附件仓库里。继续？')) return
                void mutate(INBOX_ENDPOINT_PURGE, {}, { dropSelection: true })
              }}
            >
              清空回收站
            </button>
          )}

          {list?.entries.length === 0 && (
            <p style={{ margin: '8px 0 0', opacity: 0.7 }}>
              {scope === 'bin' ? '回收站是空的。' : '没有匹配的记录。'}
            </p>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list?.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                selected={entry.id === selectedId}
                onOpen={() => void openDetail(entry.id)}
              />
            ))}
          </ul>
        </section>

        <section style={{ ...cardStyle, minWidth: 0 }}>
          {detail === undefined ? (
            <p style={{ margin: 0, opacity: 0.7 }}>选左边一条看看详情。</p>
          ) : (
            <EntryPane
              detail={detail}
              busy={busy}
              onUpdate={(patch) => mutate(INBOX_ENDPOINT_UPDATE, { id: detail.id, ...patch })}
              onDelete={() => mutate(INBOX_ENDPOINT_DELETE, { id: detail.id }, { dropSelection: true })}
              onRestore={() => mutate(INBOX_ENDPOINT_RESTORE, { id: detail.id }, { dropSelection: true })}
            />
          )}
        </section>
      </div>
    </div>
  )
}

/** How the panel talks to the host; shared by the panel and the settings form. */
type CallHost = (endpoint: string, payload: unknown) => Promise<InboxRpcResult<unknown>>

/** One line describing what a pull did. */
function describePull(result: PullResult): string {
  if (result.status === 'unconfigured') return result.reason ?? '还没配置地址'
  if (result.status === 'failed') return `拉取失败：${result.reason ?? '未知原因'}`
  return `拉取完成：新入库 ${String(result.pulled)} 条，跳过 ${String(result.skipped)} 条${
    result.failed > 0 ? `，失败 ${String(result.failed)} 条` : ''
  }`
}

/**
 * The WebDAV form: where other devices drop things, and what the last pull did.
 *
 * The password field starts empty on purpose — the host only ever reports
 * whether one is stored, never the value, so this form cannot show it back.
 */
function WebdavSettings({
  call,
  onClose,
}: {
  call: CallHost
  onClose: () => void
}): React.ReactElement {
  const [status, setStatus] = React.useState<WebdavStatus>()
  const [baseUrl, setBaseUrl] = React.useState('')
  const [directory, setDirectory] = React.useState('/inbox')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [protocol, setProtocol] = React.useState<'webdav' | 's3'>('webdav')
  const [endpoint, setEndpoint] = React.useState('')
  const [bucket, setBucket] = React.useState('')
  const [region, setRegion] = React.useState('us-east-1')
  const [signatureVersion, setSignatureVersion] = React.useState('v4')
  const [accessKeyId, setAccessKeyId] = React.useState('')
  const [accessKeySecret, setAccessKeySecret] = React.useState('')
  const [probe, setProbe] = React.useState<ProbeRow[]>()
  const [notice, setNotice] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)

  const read = React.useCallback(async (): Promise<void> => {
    const result = await call(INBOX_ENDPOINT_WEBDAV, { action: 'read' })
    if (!result.ok) {
      setNotice(`读不到设置：${result.error.message}`)
      return
    }
    const next = result.value as WebdavStatus
    setStatus(next)
    setBaseUrl(next.settings.baseUrl)
    setDirectory(next.settings.directory)
    setUsername(next.settings.username)
    setProtocol(next.settings.protocol)
    setEndpoint(next.settings.endpoint)
    setBucket(next.settings.bucket)
    setRegion(next.settings.region)
    setSignatureVersion(next.settings.signatureVersion)
    setAccessKeyId(next.settings.accessKeyId)
    setPassword('')
    setAccessKeySecret('')
  }, [call])

  React.useEffect(() => {
    void read()
  }, [read])

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const request: WebdavRequest = {
        action: 'save',
        protocol,
        baseUrl,
        directory,
        username,
        // Sending nothing leaves the stored password alone; sending "" clears it.
        ...(password.length === 0 ? {} : { password }),
        endpoint,
        bucket,
        region,
        signatureVersion,
        accessKeyId,
        ...(accessKeySecret.length === 0 ? {} : { accessKeySecret }),
      }
      const result = await call(INBOX_ENDPOINT_WEBDAV, request)
      if (!result.ok) {
        setNotice(`没存上：${result.error.message}`)
        return
      }
      setStatus(result.value as WebdavStatus)
      setPassword('')
      setAccessKeySecret('')
      setNotice('设置已保存')
    } finally {
      setBusy(false)
    }
  }

  const pull = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await call(INBOX_ENDPOINT_PULL, {})
      setNotice(result.ok ? describePull(result.value as PullResult) : `拉取失败：${result.error.message}`)
    } finally {
      setBusy(false)
    }
  }

  /** Ask the remote every shape of question at once. */
  const selfTest = async (): Promise<void> => {
    setBusy(true)
    setProbe(undefined)
    try {
      const result = await call(INBOX_ENDPOINT_PROBE, {})
      if (!result.ok) {
        setNotice(`自检失败：${result.error.message}`)
        return
      }
      setProbe(result.value as ProbeRow[])
      setNotice('自检结果见下方')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong>远端入库</strong>
        <span style={{ opacity: 0.65 }}>
          {status === undefined
            ? '读取中…'
            : `${status.settingsAvailable ? '设置服务在' : '没有设置服务'} · ${
                status.passwordSet ? '密码已存' : '还没存密码'
              }`}
        </span>
        <button type="button" style={{ ...buttonStyle, marginLeft: 'auto' }} onClick={onClose}>
          关闭
        </button>
      </div>

      {status !== undefined && !status.settingsAvailable && (
        <p style={{ margin: 0, opacity: 0.75 }}>
          这个组合里没有设置服务，地址改不了——你多半在用 headless 形态开发。
        </p>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>协议</span>
        <select
          value={protocol}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value === 's3' ? 's3' : 'webdav'
            setProtocol(next)
            // Leaving the field is not the same as saving it; save applies it.
          }}
          style={{ ...inputStyle, padding: '4px 6px' }}
        >
          <option value="webdav">WebDAV</option>
          <option value="s3">S3</option>
        </select>
        <span style={{ opacity: 0.6 }}>换协议后记得点保存</span>
      </label>

      {protocol === 'webdav' ? (
        <>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>地址</span>
        <input
          value={baseUrl}
          disabled={busy}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://data.cstcloud.cn/dav"
          style={{ ...inputStyle, flex: 1 }}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>目录</span>
        <input
          value={directory}
          disabled={busy}
          onChange={(event) => setDirectory(event.target.value)}
          placeholder="/inbox"
          style={{ ...inputStyle, flex: 1 }}
        />
        <span style={{ opacity: 0.6 }}>别的设备往这里扔东西</span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>用户名</span>
        <input
          value={username}
          disabled={busy}
          onChange={(event) => setUsername(event.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>密码</span>
        <input
          type="password"
          value={password}
          disabled={busy || status?.credentialsAvailable === false}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={status?.passwordSet === true ? '已存（留空则不改）' : '存在 dsh 的凭证库里'}
          style={{ ...inputStyle, flex: 1 }}
        />
      </label>
        </>
      ) : (
        <>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.7, minWidth: 64 }}>接入点</span>
            <input
              value={endpoint}
              disabled={busy}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="s3.cstcloud.cn（不写协议默认 https）"
              style={{ ...inputStyle, flex: 1 }}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.7, minWidth: 64 }}>Bucket</span>
            <input
              value={bucket}
              disabled={busy}
              onChange={(event) => setBucket(event.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.7, minWidth: 64 }}>签名</span>
            <select
              value={signatureVersion}
              disabled={busy}
              onChange={(event) => setSignatureVersion(event.target.value)}
              style={{ ...inputStyle, padding: '4px 6px' }}
            >
              <option value="v4">v4</option>
              <option value="v2">v2（老网关多半要这个）</option>
            </select>
            <span style={{ opacity: 0.7, minWidth: 40 }}>区域</span>
            <input
              value={region}
              disabled={busy}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="us-east-1"
              style={{ ...inputStyle, width: 140 }}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.7, minWidth: 64 }}>AccessKey ID</span>
            <input
              value={accessKeyId}
              disabled={busy}
              onChange={(event) => setAccessKeyId(event.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ opacity: 0.7, minWidth: 64 }}>Secret</span>
            <input
              type="password"
              value={accessKeySecret}
              disabled={busy || status?.credentialsAvailable === false}
              onChange={(event) => setAccessKeySecret(event.target.value)}
              placeholder={status?.secretSet === true ? '已存（留空则不改）' : '存在 dsh 的凭证库里'}
              style={{ ...inputStyle, flex: 1 }}
            />
          </label>

          <p style={{ margin: 0, opacity: 0.6 }}>
            目录那一栏同时是 S3 的 key 前缀（默认 <code>/inbox</code>，会转成 <code>inbox/</code>）。
          </p>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void save()}>
          保存
        </button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void pull()}>
          {busy ? '处理中…' : '立即拉取'}
        </button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void selfTest()}>
          自检
        </button>
        {detailNotice(notice)}
      </div>

      {probe !== undefined && (
        <pre
          style={{
            ...inputStyle,
            margin: 0,
            maxHeight: 220,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: 12,
          }}
        >
          {probe
            .map(
              (row) =>
                `${row.status === 0 ? 'ERR' : String(row.status)}  ${row.label}\n     ${row.url}\n     ${row.detail}`,
            )
            .join('\n')}
        </pre>
      )}

      <p style={{ margin: 0, opacity: 0.6 }}>
        只做单向：远端往里扔，本机拉下来入库。密码走 dsh 的凭证库，不写进配置。
      </p>
    </section>
  )
}

/** The settings form's own notice line, or nothing. */
function detailNotice(notice: string | undefined): React.ReactNode {
  return notice === undefined ? null : <span style={{ opacity: 0.8 }}>{notice}</span>
}

/** One stored record as a list row. */
function EntryRow({
  entry,
  selected,
  onOpen,
}: {
  entry: EntrySummary
  selected: boolean
  onOpen: () => void
}): React.ReactElement {
  const heading = entry.title ?? entry.url ?? entry.preview ?? '（无标题）'
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          background: selected ? 'color-mix(in srgb, currentColor 10%, transparent)' : 'transparent',
          border: 'none',
          borderTop: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
          padding: '8px 6px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ opacity: 0.6 }}>{KIND_LABELS[entry.kind]}</span>
          <span style={{ opacity: 0.6 }}>· {CATEGORY_LABELS[entry.category]}</span>
          <span style={{ opacity: entry.status === 'unread' ? 1 : 0.6 }}>
            · {STATUS_LABELS[entry.status]}
          </span>
          {entry.platform !== undefined && <span style={{ opacity: 0.6 }}>· {entry.platform}</span>}
          {entry.attachmentCount > 0 && (
            <span style={{ opacity: 0.6 }}>· {entry.attachmentCount} 个附件</span>
          )}
          {entry.deletedAt !== undefined && <span style={{ color: 'salmon' }}>· 已删</span>}
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
            {new Date(entry.createdAt).toLocaleString()}
          </span>
        </div>
        <div style={{ marginTop: 2, overflowWrap: 'anywhere' }}>{heading}</div>
        {entry.tags.length > 0 && (
          <div style={{ marginTop: 2, opacity: 0.6 }}>{entry.tags.map((t) => `#${t}`).join(' ')}</div>
        )}
      </button>
    </li>
  )
}

/** The detail pane: the record in full, plus every action M3 offers. */
function EntryPane({
  detail,
  busy,
  onUpdate,
  onDelete,
  onRestore,
}: {
  detail: EntryDetail
  busy: boolean
  onUpdate: (patch: Record<string, unknown>) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onRestore: () => Promise<boolean>
}): React.ReactElement {
  const [note, setNote] = React.useState(detail.note ?? '')
  const [tags, setTags] = React.useState(detail.tags.join(', '))

  React.useEffect(() => {
    setNote(detail.note ?? '')
    setTags(detail.tags.join(', '))
  }, [detail])

  const inBin = detail.deletedAt !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{KIND_LABELS[detail.kind]}</strong>
        <span style={{ opacity: 0.6 }}>
          {CATEGORY_LABELS[detail.category]}
          {detail.categorySource === undefined
            ? ''
            : `（${CATEGORY_SOURCE_LABELS[detail.categorySource]}判的）`}
        </span>
        {detail.platform !== undefined && <span style={{ opacity: 0.6 }}>· {detail.platform}</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
          存入 {new Date(detail.createdAt).toLocaleString()}
          {detail.updatedAt === detail.createdAt
            ? ''
            : ` · 更新 ${new Date(detail.updatedAt).toLocaleTimeString()}`}
        </span>
      </div>

      {detail.url !== undefined && (
        <a href={detail.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>
          {detail.url}
        </a>
      )}

      {detail.text !== undefined && (
        <pre
          style={{
            ...cardStyle,
            margin: 0,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
            maxHeight: 260,
            overflow: 'auto',
          }}
        >
          {detail.text}
        </pre>
      )}

      {detail.attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {detail.attachments.map((attachment) => (
            <figure
              key={attachment.id}
              style={{ ...cardStyle, margin: 0, padding: 8, textAlign: 'center' }}
            >
              {attachment.image ? (
                <img
                  src={`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(attachment.id)}`}
                  alt={attachment.filename ?? ''}
                  style={{ maxWidth: 220, maxHeight: 220, borderRadius: 6, display: 'block' }}
                />
              ) : (
                <div style={{ opacity: 0.7 }}>📄</div>
              )}
              <figcaption style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
                {attachment.filename ?? attachment.mime}
                {attachment.width === undefined || attachment.height === undefined
                  ? ''
                  : ` · ${String(attachment.width)}×${String(attachment.height)}`}
                {` · ${formatBytes(attachment.bytes)}`}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 44 }}>类目</span>
        <select
          value={detail.category}
          disabled={busy}
          onChange={(event) => void onUpdate({ category: event.target.value })}
          style={{ ...inputStyle, padding: '4px 6px' }}
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ opacity: 0.7 }}>描述（你写的永远优先于模型的判断）</span>
        <textarea
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="比如：身份证照 / 待看视频 / 这个 api key 是测试环境的"
          style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 44 }}>标签</span>
        <input
          value={tags}
          disabled={busy}
          onChange={(event) => setTags(event.target.value)}
          placeholder="逗号分隔，比如：前端, 待看"
          style={{ ...inputStyle, flex: 1 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={busy}
          onClick={() =>
            void onUpdate({
              note,
              tags: tags
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
            })
          }
        >
          保存描述与标签
        </button>
        <button
          type="button"
          style={buttonStyle}
          disabled={busy || inBin}
          onClick={() => void onUpdate({ status: detail.status === 'read' ? 'unread' : 'read' })}
        >
          {detail.status === 'read' ? '标为未读' : '标为已读'}
        </button>
        {inBin ? (
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => void onRestore()}>
            恢复
          </button>
        ) : (
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => void onDelete()}>
            删除
          </button>
        )}
      </div>
    </div>
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
