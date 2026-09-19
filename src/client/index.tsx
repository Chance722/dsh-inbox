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
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Film,
  IdCard,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link2,
  Music,
  Paperclip,
  RefreshCw,
  Rows3,
  Settings2,
  Tag,
  Trash2,
  X,
} from 'lucide-react'

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
  INBOX_ENDPOINT_UI,
  INBOX_ENDPOINT_WEBDAV,
  INBOX_IMAGE_TYPES,
  LIST_LIMIT,
  PAGE_SIZE,
  UI_LIST_MODES,
  type UiListMode,
  type UiPrefs,
  type UiRequest,
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
import { registerInboxDock } from './dock.js'
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
  registerInboxDock(ctx)
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
  const [listMode, setListMode] = React.useState<ListMode>('rows')
  const [page, setPage] = React.useState(0)
  /** The attachment being looked at full size, if any. */
  const [zoom, setZoom] = React.useState<{ src: string; label: string }>()

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
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
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
    [call, category, page, query, scope, selectedId, tag, unreadOnly],
  )

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  /** Any filter change sends you back to the first page. */
  React.useEffect(() => {
    setPage(0)
  }, [scope, unreadOnly, category, tag, query])

  /** Escape closes whatever is stacked on top of the panel. */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setZoom(undefined)
      setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * The layout the panel remembers for next time.
   *
   * Read once on mount and written on every change: this is a preference, not
   * state the host needs to be told about immediately, so a failed write only
   * means the choice does not survive a reload.
   */
  React.useEffect(() => {
    void (async () => {
      const answer = await call(INBOX_ENDPOINT_UI, { action: 'read' } satisfies UiRequest)
      if (!answer.ok) return
      const prefs = answer.value as UiPrefs
      if (UI_LIST_MODES.includes(prefs.listMode)) setListMode(prefs.listMode)
    })()
  }, [call])

  const chooseListMode = React.useCallback(
    (mode: ListMode): void => {
      setListMode(mode)
      void call(INBOX_ENDPOINT_UI, { action: 'save', listMode: mode } satisfies UiRequest)
    },
    [call],
  )

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
            <Settings2 size={14} /> 入库设置
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div
          role="dialog"
          aria-label="入库设置"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'color-mix(in srgb, #000 55%, transparent)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '6vh 16px',
            overflow: 'auto',
          }}
          onClick={(event) => {
            // The sheet itself stops the click; the wash behind it closes.
            if (event.target === event.currentTarget) setSettingsOpen(false)
          }}
        >
          <div style={{ ...cardStyle, width: 'min(560px, 100%)', background: 'Canvas' }}>
            <WebdavSettings call={call} onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}

      {zoom !== undefined && (
        <div
          role="dialog"
          aria-label="放大查看"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'color-mix(in srgb, #000 78%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 20,
          }}
          onClick={() => setZoom(undefined)}
        >
          <img
            src={zoom.src}
            alt={zoom.label}
            style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 8, background: '#000' }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, opacity: 0.85 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{zoom.label}</span>
            <button type="button" style={buttonStyle} onClick={() => setZoom(undefined)}>
              <X size={13} /> 关闭
            </button>
          </div>
        </div>
      )}

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
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜标题、正文、链接、备注…"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <span
          role="group"
          aria-label="列表模式"
          style={{
            display: 'inline-flex',
            border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {LIST_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              title={`列表模式：${mode.label}`}
              aria-pressed={listMode === mode.id}
              onClick={() => chooseListMode(mode.id)}
              style={{
                ...buttonStyle,
                border: 'none',
                borderRadius: 0,
                opacity: listMode === mode.id ? 1 : 0.5,
              }}
            >
              {mode.icon}
            </button>
          ))}
        </span>
        <button type="button" style={buttonStyle} onClick={() => void refresh()}>
          <RefreshCw size={13} /> 刷新
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          // The list is the working surface; the detail is a reader pane beside
          // it, so it gets a width rather than half the room.
          gridTemplateColumns: '176px minmax(320px, 1fr) minmax(250px, 300px)',
          gap: 14,
        }}
      >
        <nav
          aria-label="筛选"
          style={{
            ...cardStyle,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignSelf: 'start',
          }}
        >
          <RailRow
            active={scope === 'live' && !unreadOnly}
            icon={<Inbox size={15} />}
            label="全部"
            {...(list === undefined ? {} : { count: list.total })}
            onClick={() => {
              setScope('live')
              setUnreadOnly(false)
            }}
          />
          <RailRow
            active={scope === 'live' && unreadOnly}
            icon={<Circle size={15} />}
            label="未读"
            {...(list === undefined ? {} : { count: list.unread })}
            onClick={() => {
              setScope('live')
              setUnreadOnly(true)
            }}
          />
          <RailRow
            active={scope === 'bin'}
            icon={<Trash2 size={15} />}
            label="回收站"
            {...(list === undefined ? {} : { count: list.deleted })}
            onClick={() => setScope('bin')}
          />

          <div style={{ margin: '8px 0 4px', padding: '0 9px', fontSize: 11, opacity: 0.6 }}>
            类目
          </div>
          {/*
            Every category, always — the host only reports the ones with records
            in them, and a rail whose rows appear and disappear as things are
            filed is a rail you have to re-read every time.
          */}
          {CATEGORIES.map((value) => {
            const count = list?.categories.find((facet) => facet.value === value)?.count
            return (
              <RailRow
                key={value}
                active={category === value}
                icon={CATEGORY_ICONS[value]}
                label={CATEGORY_LABELS[value]}
                {...(list === undefined ? {} : { count: count ?? 0 })}
                onClick={() => setCategory(category === value ? undefined : value)}
              />
            )
          })}

          {list !== undefined && list.tags.length > 0 && (
            <>
              <div style={{ margin: '8px 0 4px', padding: '0 9px', fontSize: 11, opacity: 0.6 }}>
                标签
              </div>
              {list.tags.map((facet) => (
                <RailRow
                  key={facet.value}
                  active={tag === facet.value}
                  icon={<Tag size={14} />}
                  label={`#${facet.value}`}
                  count={facet.count}
                  onClick={() => setTag(tag === facet.value ? undefined : facet.value)}
                />
              ))}
            </>
          )}
        </nav>

        <section style={{ ...cardStyle, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <strong>{scope === 'bin' ? '回收站' : '存入的'}</strong>
            {/* The area's own action lives where the count used to sit. */}
            {scope === 'bin' && (list?.deleted ?? 0) > 0 && (
              <button
                type="button"
                style={buttonStyle}
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      '清空回收站会真的删掉这些记录，不能撤销。附件字节仍留在 dsh 的附件仓库里。继续？',
                    )
                  )
                    return
                  void mutate(INBOX_ENDPOINT_PURGE, {}, { dropSelection: true })
                }}
              >
                <Trash2 size={13} /> 清空回收站
              </button>
            )}
          </div>

          {/* …and the count moves to the top-right of the list itself. */}
          <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
            {list === undefined ? '读取中…' : `${String(list.matched)} 条匹配`}
          </div>


          {list?.entries.length === 0 && (
            <p style={{ margin: '8px 0 0', opacity: 0.7 }}>
              {scope === 'bin' ? '回收站是空的。' : '没有匹配的记录。'}
            </p>
          )}

          <div
            style={
              listMode === 'grid'
                ? {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 12,
                    alignContent: 'start',
                  }
                : listMode === 'compact'
                  ? { display: 'flex', flexDirection: 'column', gap: 0 }
                  : { display: 'flex', flexDirection: 'column', gap: 10 }
            }
          >
            {list?.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                mode={listMode}
                selected={entry.id === selectedId}
                onOpen={() => void openDetail(entry.id)}
              />
            ))}
          </div>

          {(list?.matched ?? 0) > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                opacity: 0.75,
                fontSize: 12,
              }}
            >
              <span>
                第 {String(page + 1)} / {String(Math.max(1, Math.ceil((list?.matched ?? 0) / PAGE_SIZE)))} 页
              </span>
              <span style={{ marginLeft: 'auto' }} />
              <button
                type="button"
                style={buttonStyle}
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft size={13} /> 上一页
              </button>
              <button
                type="button"
                style={buttonStyle}
                disabled={(page + 1) * PAGE_SIZE >= (list?.matched ?? 0)}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页 <ChevronRight size={13} />
              </button>
            </div>
          )}
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
              onZoom={(src, label) => setZoom({ src, label })}
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
  return `拉取完成：远端列出 ${String(result.listed)} 项，新入库 ${String(result.pulled)} 条，跳过 ${String(
    result.skipped,
  )} 条${result.failed > 0 ? `，失败 ${String(result.failed)} 条` : ''}`
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
  // One identity per protocol: the gate is bound to the credential, and each
  // protocol has its own, so switching doors must not carry the other's over.
  const [s3UserAgent, setS3UserAgent] = React.useState('')
  const [webdavUserAgent, setWebdavUserAgent] = React.useState('')
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
    setS3UserAgent(next.settings.userAgent)
    setWebdavUserAgent(next.settings.webdavUserAgent)
    setPassword('')
    setAccessKeySecret('')
  }, [call])

  React.useEffect(() => {
    void read()
  }, [read])

  /** The identity field always edits whichever protocol the form is showing. */
  const userAgent = protocol === 's3' ? s3UserAgent : webdavUserAgent
  const setUserAgent = (value: string): void => {
    if (protocol === 's3') setS3UserAgent(value)
    else setWebdavUserAgent(value)
  }

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
        userAgent,
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
                status.passwordSet ? 'WebDAV 密码已存' : '还没存 WebDAV 密码'
              } · ${status.secretSet ? 'S3 密钥已存' : '还没存 S3 密钥'}`}
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

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ opacity: 0.7, minWidth: 64 }}>客户端标识</span>
        <input
          value={userAgent}
          disabled={busy}
          onChange={(event) => setUserAgent(event.target.value)}
          placeholder={
            protocol === 's3'
              ? '留空即 dsh-inbox；有些网关按它认人，填成这个 AccessKey 绑定的应用名'
              : '留空即 dsh-inbox；有些网关按它认人，填成这个 WebDAV 账号绑定的应用名'
          }
          style={{ ...inputStyle, flex: 1 }}
        />
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

      {probe !== undefined && probe.length > 0 && probe.every((row) => row.status === 401) && (
        <p style={{ margin: 0, opacity: 0.7 }}>
          每一行都是 401，说明不是签名写法的问题：这个网关多半按客户端标识认人。把上面的「客户端标识」填成你的
          AccessKey 绑定的应用名（数据胶囊控制台里创建 key 时选的那个），再自检一次。
        </p>
      )}

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
/** How the list is laid out. Three densities, one switch — people differ. */
type ListMode = UiListMode

/** The three modes, in switch order, with their labels. */
const LIST_MODES: readonly { id: ListMode; label: string; icon: React.ReactElement }[] = [
  { id: 'rows', label: '单列', icon: <Rows3 size={14} /> },
  { id: 'grid', label: '网格', icon: <LayoutGrid size={14} /> },
  { id: 'compact', label: '紧凑', icon: <Layers size={14} /> },
]

/** The glyph a card leads with; the same frame, a different picture per kind. */
function kindGlyph(entry: EntrySummary): React.ReactElement {
  const size = 16
  if (entry.kind === 'image') return <ImageIcon size={size} />
  if (entry.kind === 'link') {
    const media = entry.platform === 'bilibili' || entry.platform === 'xiaoyuzhou'
    if (media) return entry.platform === 'xiaoyuzhou' ? <Music size={size} /> : <Film size={size} />
    return <Link2 size={size} />
  }
  if (entry.kind === 'file') return <Paperclip size={size} />
  return <FileText size={size} />
}

/**
 * What a card's tile is filled with.
 *
 * The panel has no theme tokens of its own (it is one component inside someone
 * else's app), so the fills are mixed from `currentColor` — which keeps them
 * legible in light and dark alike. Images get the diagonal hatch the prototype
 * used for "a picture lives here", media a soft gradient, everything else a
 * flat wash.
 *
 * @param entry - the record the tile belongs to.
 * @returns a CSS background value.
 */
function tileBackground(entry: EntrySummary): string {
  if (entry.kind === 'image') {
    return 'repeating-linear-gradient(135deg, color-mix(in srgb, currentColor 14%, transparent) 0 10px, color-mix(in srgb, currentColor 7%, transparent) 10px 20px)'
  }
  if (entry.platform === 'bilibili' || entry.platform === 'xiaoyuzhou') {
    return 'linear-gradient(135deg, color-mix(in srgb, currentColor 16%, transparent), color-mix(in srgb, currentColor 6%, transparent))'
  }
  return 'color-mix(in srgb, currentColor 8%, transparent)'
}

/** Each category gets a glyph of its own, so the rail reads at a glance. */
const CATEGORY_ICONS: Record<(typeof CATEGORIES)[number], React.ReactElement> = {
  idea: <Lightbulb size={15} />,
  article: <FileText size={15} />,
  media: <Film size={15} />,
  image: <ImageIcon size={15} />,
  document: <IdCard size={15} />,
  secret: <KeyRound size={15} />,
  other: <Layers size={15} />,
}

/**
 * One row of the filter rail: glyph, name, count.
 *
 * The rail is where filtering lives — the header keeps only what applies to the
 * whole panel (search, layout, settings, refresh).
 *
 * @param props - what the row stands for and whether it is the active filter.
 * @returns the row.
 */
function RailRow({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean
  icon: React.ReactElement
  label: string
  count?: number
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        background: active ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent',
        border: 'none',
        borderRadius: 8,
        padding: '6px 9px',
        cursor: 'pointer',
        opacity: active ? 1 : 0.72,
      }}
    >
      {icon}
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
      {count === undefined ? null : <span style={{ opacity: 0.6, fontSize: 12 }}>{count}</span>}
    </button>
  )
}

/**
 * One record as a card.
 *
 * The frame is identical for every kind on purpose: what changes inside is the
 * picture and the one line under the title. A row that reads `图片 · 图片 ·
 * 未读 · 1 个附件 · 规则判的` said the same thing three times.
 *
 * @param props - the summary, whether it is selected, and how to lay it out.
 * @returns the card.
 */
function EntryCard({
  entry,
  mode,
  selected,
  onOpen,
}: {
  entry: EntrySummary
  mode: ListMode
  selected: boolean
  onOpen: () => void
}): React.ReactElement {
  /**
   * A credential's text never reaches the list.
   *
   * The rule is older than this card (`AGENTS.md` 3: 账密类列表脱敏) and the old
   * list broke it — it printed the first line of the secret as the row title.
   * The list is the surface most likely to be on screen when someone walks by.
   */
  const secret = entry.category === 'secret'
  const heading = secret ? '密钥 / 账密' : (entry.title ?? entry.url ?? entry.preview ?? '（无标题）')
  const compact = mode === 'compact'
  const grid = mode === 'grid'
  /** Only things that have a picture get a poster; a text note gets a band. */
  const visual = entry.kind === 'image' || entry.platform === 'bilibili' || entry.platform === 'xiaoyuzhou'
  const hairline = 'color-mix(in srgb, currentColor 10%, transparent)'
  const accent = 'color-mix(in srgb, currentColor 45%, transparent)'

  const tile = (
    <span
      aria-hidden
      style={{
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: tileBackground(entry),
        width: grid ? '100%' : compact ? 30 : 104,
        height: grid ? (visual ? 132 : 64) : compact ? 30 : 78,
        borderRadius: grid ? 0 : compact ? 6 : 8,
        ...(grid
          ? { borderBottom: `1px solid ${hairline}` }
          : { borderRight: `1px solid ${hairline}` }),
        ...(compact ? { margin: '6px 0 6px 10px' } : {}),
      }}
    >
      {kindGlyph(entry)}
    </span>
  )

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: grid ? 'column' : 'row',
        alignItems: compact ? 'center' : grid ? 'stretch' : 'stretch',
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        background: selected
          ? 'color-mix(in srgb, currentColor 12%, transparent)'
          : compact
            ? 'transparent'
            : 'color-mix(in srgb, currentColor 4%, transparent)',
        ...(compact
          ? { border: 'none', borderBottom: `1px solid ${hairline}`, borderRadius: 0 }
          : {
              border: `1px solid ${selected ? accent : hairline}`,
              borderRadius: 12,
              overflow: 'hidden',
            }),
        padding: 0,
        cursor: 'pointer',
        opacity: entry.status === 'read' ? 0.72 : 1,
      }}
    >
      {selected && !compact && (
        <span
          aria-hidden
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }}
        />
      )}
      {tile}
      <span
        style={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'stretch',
          gap: compact ? 8 : 5,
          padding: compact ? '6px 12px 6px 8px' : '9px 12px',
        }}
      >
        {/*
          One line each, ellipsised. A card whose height depends on how long its
          URL is turns the list into a ragged column you cannot scan — and in a
          three-column panel there is never room for the wrapping to look
          deliberate.
        */}
        <span
          title={heading}
          style={{
            display: 'block',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {heading}
        </span>
        {!compact && !secret && entry.preview !== undefined && entry.preview !== heading && (
          <span
            title={entry.preview}
            style={{
              display: 'block',
              minWidth: 0,
              opacity: 0.65,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.preview.slice(0, 90)}
          </span>
        )}
        <span
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            minWidth: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            ...(compact ? { marginLeft: 'auto' } : { marginTop: 4 }),
            fontSize: 12,
            opacity: 0.6,
          }}
        >
          <span>{CATEGORY_LABELS[entry.category]}</span>
          {entry.platform !== undefined && <span>· {entry.platform}</span>}
          {entry.attachmentCount > 0 && <span>· {entry.attachmentCount} 附件</span>}
          {entry.deletedAt !== undefined && <span style={{ color: 'salmon' }}>· 已删</span>}
          <span style={{ flex: 'none' }}>· {new Date(entry.createdAt).toLocaleDateString()}</span>
          {entry.tags.map((tag) => (
            <span key={tag} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              #{tag}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', flex: 'none' }}>
            {entry.status === 'read' ? <Check size={13} /> : '未读'}
          </span>
        </span>
      </span>
    </button>
  )
}

/** The detail pane: the record in full, plus every action M3 offers. */
function EntryPane({
  detail,
  busy,
  onUpdate,
  onDelete,
  onRestore,
  onZoom,
}: {
  detail: EntryDetail
  busy: boolean
  onUpdate: (patch: Record<string, unknown>) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onRestore: () => Promise<boolean>
  /** Open one attachment full size, out of the panel's own layout. */
  onZoom: (src: string, label: string) => void
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
            : ` · ${CATEGORY_SOURCE_LABELS[detail.categorySource]}`}
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
                <button
                  type="button"
                  title="放大查看"
                  onClick={() =>
                    onZoom(
                      `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(attachment.id)}`,
                      `${attachment.filename ?? attachment.mime}${
                        attachment.width === undefined || attachment.height === undefined
                          ? ''
                          : ` · ${String(attachment.width)}×${String(attachment.height)}`
                      }`,
                    )
                  }
                  style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}
                >
                  <img
                    src={`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(attachment.id)}`}
                    alt={attachment.filename ?? ''}
                    style={{ maxWidth: 220, maxHeight: 220, borderRadius: 6, display: 'block' }}
                  />
                </button>
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
        <span style={{ opacity: 0.7 }} title="你写的永远优先于模型的判断">
          描述
        </span>
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
