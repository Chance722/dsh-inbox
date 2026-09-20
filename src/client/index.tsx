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
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  Film,
  IdCard,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Layers,
  LayoutGrid,
  Lightbulb,
  Play,
  RefreshCw,
  RotateCcw,
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
  INBOX_ENDPOINT_SECRET,
  INBOX_ENDPOINT_UPDATE,
  INBOX_ENDPOINT_PULL,
  INBOX_ENDPOINT_PUSH,
  INBOX_ENDPOINT_PROBE,
  INBOX_ENDPOINT_UI,
  INBOX_ENDPOINT_TAGS,
  INBOX_ENDPOINT_WEBDAV,
  INBOX_IMAGE_TYPES,
  LIST_LIMIT,
  MAX_TITLE_CHARS,
  PAGE_SIZE,
  UI_LIST_MODES,
  type UiListMode,
  type UiPrefs,
  type UiRequest,
  type TagRequest,
  type AttachmentSummary,
  type CaptureResult,
  type DetailResult,
  type EntryDetail,
  type EntrySummary,
  type InboxRpcResult,
  type ListResult,
  type PullResult,
  type PushResult,
  type ProbeRow,
  type SecretStatus,
  probeVerdict,
  type PurgeResult,
  type WebdavRequest,
  type WebdavStatus,
  type WireFile,
  type WireImage,
} from '../shared/panel-wire.js'
import { MILESTONE, PANEL_ID, PACKAGE_NAME } from '../shared/constants.js'
import { registerToolCards } from './card.js'
import { registerInboxDock } from './dock.js'
import { headingOf, headingTooltipOf, isSecret } from './heading.js'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SOURCE_HINTS,
  CATEGORY_SOURCE_LABELS,
  KIND_LABELS,
  type Category,
  type CategorySource,
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

/**
 * What the lightbox is showing.
 *
 * Either bytes the panel can render itself — a picture it draws, a video or a
 * sound it plays — or a page it must not embed (a video on someone else's site)
 * and therefore hands to the browser.
 */
interface Lightbox {
  label: string
  /** The attachment's bytes, through the panel's own route. */
  src?: string
  /** `src`'s media type: `image/*`, `video/*` or `audio/*`. */
  mime?: string
  /** A page to open when there are no bytes to show. */
  href?: string
}

const panelStyle: React.CSSProperties = {
  padding: '16px 20px',
  font: '14px/1.6 system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
  // No page scroll: the list is the only thing that scrolls, so it gets the
  // whole screen minus the chrome above it and the pager can sit at its foot.
  overflow: 'hidden',
  // Native controls (the select's popup, scrollbars) follow this. Without it
  // the popup is drawn light while our text is light, which is why the options
  // were invisible until hovered.
  colorScheme: 'dark',
}

/**
 * A button that looks like one.
 *
 * The panel used one faint outline for everything, so "保存描述与标签" and
 * "删除" read as chips rather than actions. Filled + bordered + roomy, with
 * `currentColor` as the fill so it inverts correctly in either theme.
 */
const actionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
  background: 'color-mix(in srgb, currentColor 9%, transparent)',
  color: 'inherit',
  cursor: 'pointer',
  fontWeight: 500,
}

/** The one thing a pane most wants you to do. */
const primaryStyle: React.CSSProperties = {
  ...actionStyle,
  // Deliberately *not* an inverted fill. `background: currentColor; color:
  // Canvas` looked right until it rendered white-on-white: `Canvas` is the
  // canvas colour, which is white in a document that never declared a dark
  // scheme. Text stays the inherited colour, on a fill strong enough to read as
  // the primary action.
  background: 'color-mix(in srgb, currentColor 20%, transparent)',
  borderColor: 'color-mix(in srgb, currentColor 55%, transparent)',
  fontWeight: 600,
}

/** Destructive actions say so. */
const dangerStyle: React.CSSProperties = {
  ...actionStyle,
  borderColor: 'color-mix(in srgb, salmon 60%, transparent)',
  background: 'color-mix(in srgb, salmon 18%, transparent)',
  color: 'salmon',
  fontWeight: 600,
}

/**
 * The accent the one tinted thing on a card uses.
 *
 * A `currentColor` mix cannot say "this one is flagged" — every mix of grey is
 * grey. The prototype's own accent (`--accent: #6e9ef7`, see
 * `docs/prototype/2026-09-19-inbox-ui-v2.prototype.html`) is the design source,
 * so the 待看 capsule borrows it the way 删除 borrows `salmon`.
 */
const WATCH_COLOR = '#6e9ef7'

/**
 * The colour of a 「模型判定」 badge.
 *
 * A `currentColor` mix cannot say "a machine guessed this": every mix of grey is
 * grey. Violet separates it from the user's own choice (`WATCH_COLOR`) without
 * competing with the alarm colours.
 */
const MODEL_COLOR = '#a78bfa'

/**
 * The height every control in a toolbar row ships at.
 *
 * The panel declares `14px/1.6 system-ui` for itself, so one line box is 22.4px;
 * add the 5px padding above and below plus the 1px border and every control
 * lands on 34.4px. Written as a formula rather than as `34.4` so it keeps
 * tracking the font if that ever moves — the point is that the search box, the
 * list-mode group and the refresh button share one edge, which is what the eye
 * reads as "aligned".
 */
const CONTROL_HEIGHT = 'calc(1.6em + 12px)'

/**
 * One line explaining why a link never got a headline.
 *
 * The codes are written by `src/host/link-title.ts`; an unrecognised one still
 * says something honest, because "原因不明" beats the silence that made the user
 * think the feature was broken.
 *
 * @param code - the short code stored on the record.
 * @returns a sentence to show under the name field.
 */
function titleFailureText(code: string): string {
  if (code === 'no-title') {
    return '那个页面里没有标题（有些站点对非浏览器的请求只回空壳页，比如微信）'
  }
  if (code.startsWith('http:')) return `对方返回 HTTP ${code.slice('http:'.length)}`
  if (code.startsWith('not-html:')) return '那个地址不是网页'
  if (code.startsWith('network:')) return '请求没成功（网络不通或对方拒绝）'
  return '原因不明'
}

/**
 * One row of the detail pane.
 *
 * `flex: none` on every row, and it is not decoration: the pane is a scrolling
 * flex column, and a flex item whose overflow is not `visible` — the record's
 * text box is one — has an automatic minimum size of zero, so it collapses to
 * nothing instead of pushing the column into a scrollbar. Measured: the whole
 * 24-line text box shrank away before this, and the pane reported
 * `scrollHeight === clientHeight`.
 */
const paneRowStyle: React.CSSProperties = { flex: 'none' }

/** A `<select>` that matches the buttons, popup included. */
const selectStyle: React.CSSProperties = {
  ...actionStyle,
  // Opaque on purpose: a translucent background is why the popup's options
  // stayed white-on-white. `appearance: none` lets us draw the caret instead of
  // letting the browser park it against the border.
  appearance: 'none',
  paddingRight: 26,
  background: 'Canvas',
  color: 'CanvasText',
  colorScheme: 'dark',
}

/**
 * A labelled `<select>` with our own caret, so it looks like the buttons and
 * the popup is legible in a dark app.
 *
 * @param props - the current value, the options, and what to do on change.
 * @returns the control.
 */
function SelectBox({
  value,
  options,
  disabled,
  block,
  label,
  onChange,
}: {
  value: string
  options: readonly (readonly [string, string])[]
  disabled?: boolean
  /** Stretch to the container's width; the detail pane has no room for labels. */
  block?: boolean
  /** Accessible name, for the places where the visible label is gone. */
  label?: string
  onChange: (next: string) => void
}): React.ReactElement {
  return (
    <span
      style={{
        position: 'relative',
        display: block === true ? 'flex' : 'inline-flex',
        alignItems: 'center',
        // A control in a scrolling column keeps its own height (see
        // `paneRowStyle`); without this the popup's box squeezes to nothing.
        flex: 'none',
        ...(block === true ? { width: '100%' } : {}),
      }}
    >
      <select
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...selectStyle, ...(block === true ? { flex: 1, minWidth: 0 } : {}) }}
      >
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        style={{ position: 'absolute', right: 9, pointerEvents: 'none', opacity: 0.7 }}
      />
    </span>
  )
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
  /*
    A flex row rather than an inline box.

    Every one of these buttons is either a bare glyph or a glyph next to a word,
    and an inline SVG lands on the text baseline: the icon reads as sitting low
    in its own frame. It is the same defect the pager and the list-mode buttons
    were fixed for one at a time (M7.12 / M7.13); the difference here is that it
    is fixed once, for all of them.
  */
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

/**
 * A pager button: the arrow and its word on one centered line.
 *
 * Back when `buttonStyle` was still an inline box the icon sat on the text's own
 * baseline and "‹ 上一页" read as crooked; this was the first button fixed for
 * it. `buttonStyle` is a centred flex row for every button now, so all that is
 * left here is `whiteSpace`, which the pager still needs.
 */
const pagerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  whiteSpace: 'nowrap',
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
  const [watchOnly, setWatchOnly] = React.useState(false)
  const [category, setCategory] = React.useState<Category>()
  const [tag, setTag] = React.useState<string>()
  const [search, setSearch] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [list, setList] = React.useState<ListResult>()
  const [selectedId, setSelectedId] = React.useState<string>()
  const [detail, setDetail] = React.useState<EntryDetail>()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [listMode, setListMode] = React.useState<ListMode>('grid')
  const [page, setPage] = React.useState(0)
  /** The attachment being looked at full size, if any. */
  /** The open lightbox, if any — see `Lightbox`. */
  const [zoom, setZoom] = React.useState<Lightbox>()
  /**
   * How much room the panel actually got.
   *
   * Three columns need about 960px now: the rail is 176, the list will not go
   * below 320, and the detail column takes 320–380 — 380 being the width that
   * keeps its three action buttons on one line. Below that the detail becomes a
   * sheet over the list.
   */
  const [panelWidth, setPanelWidth] = React.useState(1200)
  const [railOpen, setRailOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const element = panelRef.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setPanelWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** Narrow means: no room for a detail column, so it becomes a sheet. */
  const narrow = panelWidth < 960
  const hairline = 'color-mix(in srgb, currentColor 12%, transparent)'

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
        ...(watchOnly ? { watchLater: true } : {}),
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
      // A wrong-shaped answer must not reach the render: `entries` is read with
      // `.map`, and one undefined there takes the whole panel down to a blank
      // screen (the old list is a much better outcome than no list).
      if (!Array.isArray(next.entries)) {
        setNotice('读取列表失败：宿主返回的内容看不懂')
        return
      }
      setList(next)
      if (!keepSelection || !next.entries.some((entry) => entry.id === selectedId)) {
        setSelectedId(undefined)
        setDetail(undefined)
      }
    },
    [call, category, page, query, scope, selectedId, tag, watchOnly],
  )

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep that ref pointing at the current one; the effect above runs on the same
  // render, so this is always up to date by the time a timer fires.
  React.useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  /** Any filter change sends you back to the first page. */
  React.useEffect(() => {
    setPage(0)
  }, [scope, watchOnly, category, tag, query])

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

  /** A toast is a moment, not a state: it leaves on its own. */
  React.useEffect(() => {
    if (notice === undefined || notice.length === 0) return
    const timer = window.setTimeout(() => setNotice(undefined), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  /**
   * Always the *latest* `refresh`.
   *
   * The delayed re-read below is scheduled now and runs 2.5s later, by which
   * time the panel may be looking at a different shelf — and a stale closure
   * would quietly re-read the old one and overwrite the list with it. That is
   * exactly how a list goes blank after a capture made from the recycle bin.
   */
  const refreshRef = React.useRef<() => Promise<void>>(async () => {})

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

  /**
   * Refresh: re-read the list, and pull the remote first when one is configured.
   *
   * A refresh that only re-reads the local list is indistinguishable from
   * nothing happening, and the interesting number is usually "did the phone's
   * stuff arrive" — so it pulls, then re-reads, then says what changed.
   */
  const refreshAll = React.useCallback(async (): Promise<void> => {
    setBusy(true)
    setNotice('刷新中…')
    try {
      const pulled = await call(INBOX_ENDPOINT_PULL, {})
      let suffix = ''
      if (pulled.ok) {
        const result = pulled.value as PullResult
        if (result.status === 'ok') {
          suffix =
            result.pulled > 0
              ? ` · 远端新入库 ${String(result.pulled)} 条`
              : result.listed > 0
                ? ' · 远端没有新内容'
                : ' · 远端是空的'
        } else if (result.status === 'unconfigured') {
          suffix = ' · 未配置远端'
        } else {
          suffix = ` · 远端失败：${result.reason ?? '未知原因'}`
        }
      }
      await refresh()
      const total = list?.matched
      setNotice(`已刷新${total === undefined ? '' : `（${String(total)} 条）`}${suffix}`)
    } finally {
      setBusy(false)
    }
  }, [call, list?.matched, refresh])

  /** Drop one tag from every record that carries it, after saying how many. */
  const removeTagEverywhere = React.useCallback(
    async (name: string, count: number): Promise<void> => {
      if (
        !window.confirm(`把标签「${name}」从 ${String(count)} 条记录上移除？记录本身不会被删除。`)
      )
        return
      setBusy(true)
      try {
        const result = await call(INBOX_ENDPOINT_TAGS, {
          action: 'remove',
          tag: name,
        } satisfies TagRequest)
        if (!result.ok) {
          setNotice(`删标签失败：${result.error.message}`)
          return
        }
        setTag(undefined)
        await refresh(false)
        setNotice(`标签「${name}」已移除`)
      } finally {
        setBusy(false)
      }
    },
    [call, refresh],
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
          // The browser's own guess rides along; the host keeps it only for
          // media it can play (see `WireFile.mediaType`).
          files.push({
            data,
            name: entry.name,
            ...(entry.file.type.length === 0 ? {} : { mediaType: entry.file.type }),
          })
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
      /*
        Leaving the recycle bin is part of "I just filed something".

        The bin is a shelf you are done with, and a capture always lands live:
        pasting while standing in the bin refreshed the *bin* — which the user
        had just emptied — so the panel looked like it had swallowed the paste
        (the toast said 「已存入 1 条」 while the list said the bin was empty).
        Stepping back to 全部 also puts the new record where the eye expects it.
      */
      const wasInBin = scope === 'bin'
      if (wasInBin) {
        setScope('live')
        setWatchOnly(false)
      } else {
        await refresh(false)
      }
      /*
        Two things arrive *after* the paste is stored, by design: the category
        the model decided, and the headline fetched from the link's page. Both
        are fire-and-forget on the host, so one delayed re-read is what makes
        them visible without the user hunting for the 刷新 button. It goes
        through the ref, so it re-reads whatever shelf the panel is on *then*.
      */
      window.setTimeout(() => void refreshRef.current(), 2500)
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

  /** How many pages the current filter has, for the pager's own rules. */
  const pageCount = Math.max(1, Math.ceil((list?.matched ?? 0) / PAGE_SIZE))

  /**
   * What the list is showing, in the filter's own words.
   *
   * The heading used to be the constant 「存入的」, which describes the panel
   * rather than the list: it stayed 「存入的」 while you were looking at a single
   * category, and it said nothing about which one. Naming the current filter
   * costs one line and answers the question the heading is there to answer.
   * The words are the rail's own labels, so the two surfaces cannot drift.
   */
  const listTitle = (() => {
    const parts: string[] = []
    // Category and 待看 reset when you step into the bin, but a tag does not —
    // so 回收站 can still be narrowing, and the heading says so.
    if (scope === 'bin') parts.push('回收站')
    else {
      if (category !== undefined) parts.push(CATEGORY_LABELS[category])
      if (watchOnly) parts.push('待看')
    }
    if (tag !== undefined) parts.push(`#${tag}`)
    return parts.length === 0 ? '全部' : parts.join(' · ')
  })()

  /** Which face the lightbox shows; a hand-off (no bytes) falls through to image. */
  const zoomKind =
    zoom?.mime?.startsWith('video/') === true
      ? 'video'
      : zoom?.mime?.startsWith('audio/') === true
        ? 'audio'
        : 'image'

  /**
   * The card's preview slot opens the lightbox the detail pane already uses.
   *
   * A record with bytes hands over its attachment and that attachment's media
   * type; a media link has no bytes at all, so the lightbox gets the page to open
   * instead.
   */
  const openEntryPreview = React.useCallback((entry: EntrySummary): void => {
    if (entry.previewId !== undefined) {
      setZoom({
        src: attachmentUrl(entry.previewId),
        ...(entry.previewMime === undefined ? {} : { mime: entry.previewMime }),
        label: headingOf(entry),
      })
      return
    }
    if (entry.url !== undefined) setZoom({ href: entry.url, label: headingOf(entry) })
  }, [])

  return (
    <div ref={panelRef} style={panelStyle}>
      <header>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>dsh-inbox</h2>
            <p style={{ margin: 0, opacity: 0.7 }}>
              {PACKAGE_NAME} · {MILESTONE}
              {list === undefined
                ? ''
                : ` · 共 ${String(list.total)} 条 · 待看 ${String(list.watchLater)} 条 · 回收站 ${String(list.deleted)} 条`}
            </p>
          </div>
          <button
            type="button"
            style={{ ...buttonStyle, marginLeft: 'auto' }}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings2 size={14} /> 设置
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div
          role="dialog"
          aria-label="设置"
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
            <EncryptionSettings call={call} />
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
          {/*
            Three shapes, one overlay: a picture, something that plays, or a page
            we cannot embed. `<video>`/`<audio>` swallow their own clicks (their
            controls are the point); anywhere else closes, which is why the wash
            itself is the close target.
          */}
          {zoom.src !== undefined && zoomKind === 'video' && (
            <video
              src={zoom.src}
              controls
              autoPlay
              playsInline
              onClick={(event) => event.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 8, background: '#000' }}
            />
          )}
          {zoom.src !== undefined && zoomKind === 'audio' && (
            <audio
              src={zoom.src}
              controls
              autoPlay
              onClick={(event) => event.stopPropagation()}
              style={{ width: 'min(560px, 92vw)' }}
            />
          )}
          {zoom.src !== undefined && zoomKind === 'image' && (
            <img
              src={zoom.src}
              alt={zoom.label}
              style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 8, background: '#000' }}
            />
          )}
          {zoom.src === undefined && (
            /*
              A video on someone else's site. Embedding their player would mean a
              remote frame inside the panel and their own terms; handing the page
              to the browser is the honest version, and it is also the big screen.
            */
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                ...cardStyle,
                maxWidth: 'min(560px, 92vw)',
                background: 'Canvas',
                color: 'CanvasText',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <strong>这条是外站的内容</strong>
              <span style={{ opacity: 0.75 }}>
                面板不内嵌别人的播放器，所以在浏览器里打开——那里才是大屏。
              </span>
              {zoom.href !== undefined && (
                <a
                  href={zoom.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...primaryStyle, textDecoration: 'none' }}
                >
                  <ExternalLink size={14} /> 在浏览器里播放
                </a>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, opacity: 0.85 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{zoom.label}</span>
            {zoom.src !== undefined && (
              <a
                href={zoom.src}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ExternalLink size={13} /> 在浏览器打开
              </a>
            )}
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
        </div>
      </div>

      {/*
        Notices are toasts now: the old inline line sat next to 存入仓库, where a
        refresh result ("已刷新（13 条） · 远端没有新内容") had no business being.
      */}
      {notice !== undefined && notice.length > 0 && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            // Dead centre, not near the foot of the window: at `bottom: 28` the
            // toast sat in the corner you are least likely to be looking at,
            // and on a tall window it was a long way from the thing it was
            // reporting on.
            transform: 'translate(-50%, -50%)',
            zIndex: 60,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
            background: 'Canvas',
            color: 'CanvasText',
            boxShadow: '0 10px 30px #0006',
            fontSize: 13,
            maxWidth: '80vw',
            // It reports; it does not invite a click. Centred over the list it
            // would otherwise swallow the first click of whatever is under it.
            pointerEvents: 'none',
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {narrow && (
          <button
            type="button"
            style={{
              ...buttonStyle,
              height: CONTROL_HEIGHT,
              boxSizing: 'border-box',
              ...(railOpen ? { borderColor: 'currentColor' } : {}),
            }}
            aria-expanded={railOpen}
            onClick={() => setRailOpen((open) => !open)}
          >
            <Layers size={13} /> 筛选
          </button>
        )}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜标题、正文、链接、备注…"
          style={{
            ...inputStyle,
            flex: 1,
            minWidth: 180,
            // The same edge as the two buttons beside it: an input sized by its
            // own line box happened to land within half a pixel, which is the
            // kind of "almost" that still reads as crooked.
            height: CONTROL_HEIGHT,
            boxSizing: 'border-box',
          }}
        />
        <span
          role="group"
          aria-label="列表模式"
          style={{
            display: 'inline-flex',
            border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
            borderRadius: 8,
            overflow: 'hidden',
            height: CONTROL_HEIGHT,
            boxSizing: 'border-box',
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
                // The frame itself: no padding of its own (the group's height
                // decides it), a fixed 38px width, and `height: 100%` of the
                // group's inner box. With the glyph centred by `buttonStyle` the
                // icon lands on the row's centre line — measured offset 0.
                flex: 'none',
                width: 38,
                height: '100%',
                padding: 0,
                boxSizing: 'border-box',
                border: 'none',
                borderRadius: 0,
                opacity: listMode === mode.id ? 1 : 0.5,
              }}
            >
              {mode.icon}
            </button>
          ))}
        </span>
        <button
          type="button"
          style={{ ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy}
          onClick={() => void refreshAll()}
        >
          <RefreshCw size={13} /> {busy ? '刷新中…' : '刷新'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          // The list is the working surface; the detail is a reader pane beside
          // it, so it gets a width rather than half the room. 320–380 rather
          // than 250–300 because the detail's own action row ("保存描述与标签"
          // next to "标为待看" next to "删除") is only one line at that width —
          // and below 960px the whole thing collapses to one column.
          gridTemplateColumns: narrow
            ? 'minmax(0, 1fr)'
            : '176px minmax(320px, 1fr) minmax(320px, 380px)',
          gap: 14,
          // Fill what the chrome above left, so the list can scroll inside it.
          flex: 1,
          minHeight: 0,
        }}
      >
        {(!narrow || railOpen) && (
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
            active={scope === 'live' && !watchOnly && category === undefined}
            icon={<Inbox size={15} />}
            label="全部"
            {...(list === undefined ? {} : { count: list.total })}
            onClick={() => {
              setScope('live')
              setWatchOnly(false)
              setCategory(undefined)
            }}
          />
          <RailRow
            active={scope === 'live' && watchOnly}
            icon={<Circle size={15} />}
            label="待看"
            {...(list === undefined ? {} : { count: list.watchLater })}
            onClick={() => {
              setScope('live')
              setWatchOnly(true)
              setCategory(undefined)
            }}
          />
          <RailRow
            active={scope === 'bin'}
            icon={<Trash2 size={15} />}
            label="回收站"
            {...(list === undefined ? {} : { count: list.deleted })}
            onClick={() => {
              setScope('bin')
              setWatchOnly(false)
              setCategory(undefined)
            }}
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
                icon={categoryGlyph(value, 15)}
                label={CATEGORY_LABELS[value]}
                {...(list === undefined ? {} : { count: count ?? 0 })}
                onClick={() => {
                  // Picking a category means "show me this category" — it is not
                  // a filter *inside* the recycle bin, so the scope resets too.
                  setCategory(category === value ? undefined : value)
                  setScope('live')
                  setWatchOnly(false)
                }}
              />
            )
          })}

          {list !== undefined && list.tags.length > 0 && (
            <>
              <div style={{ margin: '8px 0 4px', padding: '0 9px', fontSize: 11, opacity: 0.6 }}>
                标签
              </div>
              {list.tags.map((facet) => (
                <div key={facet.value} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <RailRow
                    active={tag === facet.value}
                    icon={<Tag size={14} />}
                    label={`#${facet.value}`}
                    count={facet.count}
                    onClick={() => setTag(tag === facet.value ? undefined : facet.value)}
                  />
                  <button
                    type="button"
                    title={`把标签「${facet.value}」从所有记录上移除（记录本身不删）`}
                    onClick={() => void removeTagEverywhere(facet.value, facet.count)}
                    style={{ ...buttonStyle, border: 'none', padding: '4px 5px', opacity: 0.6 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </>
          )}
        </nav>
        )}

        <section
          style={{
            ...cardStyle,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <strong>{listTitle}</strong>
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

          {/* …and the count moves to the top-right of the list itself. A zero
              count says nothing worth a line. */}
          {(list === undefined || list.matched > 0) && (
            <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
              {list === undefined ? '读取中…' : `${String(list.matched)} 条匹配`}
            </div>
          )}


          {list?.entries.length === 0 && (
            <p style={{ margin: '8px 0 0', opacity: 0.7 }}>
              {scope === 'bin' ? '回收站是空的。' : '没有匹配的记录。'}
            </p>
          )}

          <div
            style={
              listMode === 'compact'
                ? {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }
                : {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 12,
                    alignContent: 'start',
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }
            }
          >
            {list?.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                mode={listMode}
                selected={entry.id === selectedId}
                onOpen={() => void openDetail(entry.id)}
                onPreview={() => openEntryPreview(entry)}
              />
            ))}
          </div>

          {/* One page needs no pager, and each end hides the button that would
              only ever be disabled. */}
          {(list?.matched ?? 0) > 0 && pageCount > 1 && (
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
                第 {String(page + 1)} / {String(pageCount)} 页
              </span>
              <span style={{ marginLeft: 'auto' }} />
              {page > 0 && (
                <button
                  type="button"
                  style={pagerButtonStyle}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft size={13} /> 上一页
                </button>
              )}
              {page + 1 < pageCount && (
                <button
                  type="button"
                  style={pagerButtonStyle}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页 <ChevronRight size={13} />
                </button>
              )}
            </div>
          )}
        </section>

        {/*
          Three columns need room. Below that the detail stops being a column
          and becomes a sheet over the list — the alternative was three columns
          squeezed into a phone-width panel, which is what the screenshot of a
          narrow window showed.
        */}
        {narrow ? (
          detail !== undefined && (
            <div
              role="dialog"
              aria-label="记录详情"
              style={{
                position: 'fixed',
                left: 12,
                right: 12,
                top: '5vh',
                bottom: '5vh',
                zIndex: 45,
                // The same shape as the wide column: a bounded box, a scrolling
                // content column inside it, and a pinned stamp — so the sheet
                // scrolls the record rather than the whole overlay.
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                background: 'Canvas',
                border: `1px solid ${hairline}`,
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 18px 40px #0007',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setSelectedId(undefined)
                    setDetail(undefined)
                  }}
                >
                  <X size={13} /> 关闭
                </button>
              </div>
              <EntryPane
                detail={detail}
                busy={busy}
                onUpdate={(patch) => mutate(INBOX_ENDPOINT_UPDATE, { id: detail.id, ...patch })}
                onDelete={() =>
                  mutate(INBOX_ENDPOINT_DELETE, { id: detail.id }, { dropSelection: true })
                }
                onRestore={() =>
                  mutate(INBOX_ENDPOINT_RESTORE, { id: detail.id }, { dropSelection: true })
                }
                onZoom={setZoom}
              />
            </div>
          )
        ) : (
          /*
            Two things are load-bearing here. `position: relative` anchors the
            pane's own timestamps, which are absolutely positioned against this
            card so they stay inside the frame 16px above its bottom edge. The
            flex column gives the pane a bounded height to scroll inside: a long
            record (a 3k-character text, a stack of photos) used to grow the card
            past the panel, taking the actions and the stamps out of reach.
          */
          <section
            style={{
              ...cardStyle,
              minWidth: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {detail === undefined ? (
              <p style={{ margin: 0, opacity: 0.7 }}>选左边一条看看详情。</p>
            ) : (
              <EntryPane
                detail={detail}
                busy={busy}
                onUpdate={(patch) => mutate(INBOX_ENDPOINT_UPDATE, { id: detail.id, ...patch })}
                onDelete={() =>
                  mutate(INBOX_ENDPOINT_DELETE, { id: detail.id }, { dropSelection: true })
                }
                onRestore={() =>
                  mutate(INBOX_ENDPOINT_RESTORE, { id: detail.id }, { dropSelection: true })
                }
                onZoom={setZoom}
              />
            )}
          </section>
        )}
      </div>
    </div>
  )
}

/** How the panel talks to the host; shared by the panel and the settings form. */
type CallHost = (endpoint: string, payload: unknown) => Promise<InboxRpcResult<unknown>>

/** One line describing what a push did. */
function describePush(result: PushResult): string {
  if (result.status === 'unconfigured') return `推送：${result.reason ?? '还没配置远端'}`
  if (result.status === 'failed') return `推送失败：${result.reason ?? '未知原因'}`
  const head =
    result.pushed === 0 && result.attachments === 0
      ? `推送：没有新内容（${String(result.skipped)} 条已是最新）`
      : `推送：${String(result.pushed)} 条记录 / ${String(result.attachments)} 个附件`
  // `partial` always carries the reason it is only partial.
  return result.status === 'partial' ? `${head} · 部分失败：${result.reason ?? ''}` : head
}

/** One line describing what a pull did. */
function describePull(result: PullResult): string {
  if (result.status === 'unconfigured') return result.reason ?? '还没配置地址'
  if (result.status === 'failed') return `拉取失败：${result.reason ?? '未知原因'}`
  // Two halves, one line each: the drop folder's files, and the merge's records.
  const merged = result.merged ?? 0
  const attachments = result.attachments ?? 0
  const syncPart =
    merged === 0 && attachments === 0
      ? '云端的记录没有新的'
      : `从云端合并 ${String(merged)} 条${attachments === 0 ? '' : ` / ${String(attachments)} 个附件`}`
  if (result.pulled === 0 && result.skipped === 0 && result.failed === 0) return syncPart
  return `拉取完成：远端列出 ${String(result.listed)} 项，新入库 ${String(result.pulled)} 条，跳过 ${String(
    result.skipped,
  )} 条 · ${syncPart}${result.failed > 0 ? ` · 失败 ${String(result.failed)} 条` : ''}`
}

/**
 * The master-password block: what state the vault's key is in, and the three
 * things a person can do about it.
 *
 * The copy says the awkward parts out loud, because they are the design: the
 * password is never stored, the key lives in memory, and a restart therefore
 * locks the vault again — so credentials are unreadable until someone unlocks,
 * and a forgotten password is a forgotten password (no reset, by construction).
 */
function EncryptionSettings({ call }: { call: CallHost }): React.ReactElement {
  const [status, setStatus] = React.useState<SecretStatus>()
  const [password, setPassword] = React.useState('')
  const [notice, setNotice] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)

  const send = React.useCallback(
    async (action: 'status' | 'set' | 'unlock' | 'lock'): Promise<void> => {
      setBusy(true)
      try {
        const result = await call(INBOX_ENDPOINT_SECRET, {
          action,
          ...(password.length === 0 ? {} : { password }),
        })
        if (!result.ok) {
          setNotice(result.error.message)
          return
        }
        const next = result.value as SecretStatus
        setStatus(next)
        setPassword('')
        setNotice(
          action === 'set'
            ? next.sealed === undefined || next.sealed === 0
              ? '主密码已设置，账密从此加密落盘'
              : `主密码已设置，另有 ${String(next.sealed)} 条旧记录已从明文改为密文`
            : action === 'unlock'
              ? '已解锁'
              : action === 'lock'
                ? '已锁定：账密正文不可读，直到再次解锁'
                : undefined,
        )
      } finally {
        setBusy(false)
      }
    },
    [call, password],
  )

  React.useEffect(() => {
    void send('status')
    // Once, on mount: the state belongs to the host, and re-asking on every
    // keystroke would be noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section style={{ ...cardStyle, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <strong>账密加密</strong>
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          {status === undefined
            ? '读取中…'
            : status.unlocked
              ? '已解锁'
              : status.configured
                ? '已锁定'
                : '还没设主密码'}
        </span>
      </div>
      <p style={{ margin: '0 0 8px', opacity: 0.7, fontSize: 12 }}>
        账密正文以密文写盘；主密码和密钥都不落盘，**重启后要重新解锁**。密码忘了就解不开，没有找回。
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="password"
          value={password}
          disabled={busy}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          aria-label="主密码"
          placeholder={status?.configured === true ? '输入主密码' : '设一个主密码'}
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <button
          type="button"
          style={{ ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy || password.length === 0}
          onClick={() => void send('set')}
        >
          设置 / 更换
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy || password.length === 0 || status?.configured !== true}
          onClick={() => void send('unlock')}
        >
          解锁
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy || status?.unlocked !== true}
          onClick={() => void send('lock')}
        >
          锁定
        </button>
      </div>
      {notice !== undefined && notice.length > 0 && (
        <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 12 }}>{notice}</p>
      )}
    </section>
  )
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
  /** The self-test's rows, summed up: the answer, before the evidence. */
  const verdict = probeVerdict(probe ?? [])
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

  /**
   * One button, both directions.
   *
   * Push first, then pull, in that order: this machine's newest edits are the
   * ones a conflict would lose, and a pull that overwrote them with an older
   * remote copy before they had been uploaded is exactly the mistake the
   * "newer wins" rule cannot undo.
   */
  const sync = async (): Promise<void> => {
    setBusy(true)
    try {
      const pushed = await call(INBOX_ENDPOINT_PUSH, {})
      const pushLine = pushed.ok ? describePush(pushed.value as PushResult) : `推送失败：${pushed.error.message}`
      const pulled = await call(INBOX_ENDPOINT_PULL, {})
      const pullLine = pulled.ok ? describePull(pulled.value as PullResult) : `拉取失败：${pulled.error.message}`
      setNotice(`${pushLine} · ${pullLine}`)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Send everything again, ignoring the cursor.
   *
   * The repair button. It exists because of one afternoon when every object in
   * the bucket turned out to be 0 bytes while the push reported success: after a
   * bug like that, "what is up there is wrong and I know it" needs an answer
   * that is not "delete your synced state by hand".
   */
  const resendAll = async (): Promise<void> => {
    setBusy(true)
    try {
      const pushed = await call(INBOX_ENDPOINT_PUSH, { all: true })
      setNotice(
        pushed.ok
          ? `全部重传：${describePush(pushed.value as PushResult)}`
          : `全部重传失败：${pushed.error.message}`,
      )
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
        <SelectBox
          value={protocol}
          options={[
            ['webdav', 'WebDAV'],
            ['s3', 'S3'],
          ]}
          disabled={busy}
          // Leaving the field is not the same as saving it; save applies it.
          onChange={(next) => setProtocol(next === 's3' ? 's3' : 'webdav')}
        />
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
            <SelectBox
              value={signatureVersion}
              options={[
                ['v4', 'v4'],
                ['v2', 'v2（老网关多半要这个）'],
              ]}
              disabled={busy}
              onChange={setSignatureVersion}
            />
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
        <button
          type="button"
          style={{ ...primaryStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy}
          onClick={() => void sync()}
        >
          {busy ? '处理中…' : '立即同步'}
        </button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void pull()}>
          {busy ? '处理中…' : '立即拉取'}
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
          disabled={busy}
          title="忽略「已推过」的记录，把全部内容重新上传一遍（远端内容不对时用）"
          onClick={() => void resendAll()}
        >
          全部重传
        </button>
        <button type="button" style={buttonStyle} disabled={busy} onClick={() => void selfTest()}>
          自检
        </button>
        {detailNotice(notice)}
      </div>

      {probe !== undefined && (
        <div style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/*
            One sentence first: "does this channel work" is the question the
            button was pressed to answer. The rows stay underneath, folded away,
            for the day the answer is no — telling a gateway's four same-looking
            refusals apart is exactly what they are for.
          */}
          <p
            style={{
              margin: 0,
              color: verdict.ok ? 'inherit' : 'salmon',
              fontWeight: 600,
            }}
          >
            {verdict.ok ? '✅ ' : '❌ '}
            {verdict.title}
          </p>
          {verdict.hint !== undefined && verdict.hint.length > 0 && (
            <p style={{ margin: 0, opacity: 0.7 }}>{verdict.hint}</p>
          )}
          {probe.length > 1 && (
            <details>
              <summary style={{ cursor: 'pointer', opacity: 0.7, fontSize: 12 }}>
                详情（{probe.length} 次请求）
              </summary>
              <pre
                style={{
                  ...inputStyle,
                  margin: '6px 0 0',
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
            </details>
          )}
        </div>
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

/** How the list is laid out. Two densities, one switch — people differ. */
type ListMode = UiListMode

/** The two modes, in switch order, with their labels. */
const LIST_MODES: readonly { id: ListMode; label: string; icon: React.ReactElement }[] = [
  { id: 'grid', label: '网格', icon: <LayoutGrid size={14} /> },
  { id: 'compact', label: '紧凑', icon: <Layers size={14} /> },
]

/**
 * The glyph for one category, at whatever size the caller needs.
 *
 * One function, two surfaces: the rail's rows and the card's glyph slot. They
 * used to disagree — the rail was per *category* (a key for 密钥/账密) while the
 * card was per *kind* (a text file for anything typed), so a pasted credential
 * showed a document glyph. The category is what the eye needs here: it is the
 * thing you scan for, and the kind is already visible in the record itself (a
 * link shows its URL, a picture its thumbnail).
 *
 * @param category - which bucket the record is filed in.
 * @param size - the glyph's edge in pixels.
 * @returns the icon element.
 */
function categoryGlyph(category: Category, size: number): React.ReactElement {
  switch (category) {
    case 'idea':
      return <Lightbulb size={size} />
    case 'article':
      return <FileText size={size} />
    case 'media':
      return <Film size={size} />
    case 'image':
      return <ImageIcon size={size} />
    case 'document':
      return <IdCard size={size} />
    case 'secret':
      return <KeyRound size={size} />
    case 'other':
      return <Layers size={size} />
  }
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

/**
 * Who put this record in its category, as a badge.
 *
 * It used to be a `· 规则` tail on the category itself: a bare noun after a dot,
 * which named the *thing* while leaving the *question* unspoken — hence 「云里雾
 * 里」. The wording now carries the verb (谁判的), the pill shape says this is a
 * property of this record rather than of the vault, and the colour says whose
 * judgement it was: grey for the default rule, violet for the model, and the
 * accent the user's own choice already wears on the 待看 capsule.
 *
 * Hovering explains the whole thing; a badge that needs a manual is a badge that
 * failed.
 *
 * @param props - which of the three answers this record carries.
 * @returns the badge.
 */
function SourceBadge({ source }: { source: CategorySource }): React.ReactElement {
  const tint = source === 'user' ? WATCH_COLOR : source === 'model' ? MODEL_COLOR : undefined
  return (
    <span
      title={CATEGORY_SOURCE_HINTS[source]}
      style={{
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...(tint === undefined
          ? {
              // The rule is the default, and the default is not news: it stays
              // grey so the two that mean "somebody made a judgement" stand out.
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              color: 'inherit',
              opacity: 0.7,
            }
          : {
              background: `color-mix(in srgb, ${tint} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tint} 55%, transparent)`,
              color: tint,
            }),
      }}
    >
      {CATEGORY_SOURCE_LABELS[source]}
    </span>
  )
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
 * glyph, the picture, and the words. Two layouts share it — `grid` spends two
 * columns and shows the thumbnail, `compact` is a thin row without one.
 *
 * @param props - the summary, whether it is selected, and how to lay it out.
 * @returns the card.
 */
function EntryCard({
  entry,
  mode,
  selected,
  onOpen,
  onPreview,
}: {
  entry: EntrySummary
  mode: ListMode
  selected: boolean
  onOpen: () => void
  /** Open the preview slot in the lightbox (a picture, or something that plays). */
  onPreview: () => void
}): React.ReactElement {
  /**
   * A credential's text never reaches the list.
   *
   * The rule is older than this card (`AGENTS.md` 3: 账密类列表脱敏) and the old
   * list broke it — it printed the first line of the secret as the row title.
   * The list is the surface most likely to be on screen when someone walks by.
   */
  const secret = isSecret(entry)
  /**
   * `headingOf` is the same function the dock uses: a credential is named by its
   * own label plus the user's description (`密钥 / 账密（公司邮箱）`), never by its
   * text. Hovering gives the whole description; the detail pane gives all of it.
   */
  const headingText = headingOf(entry)
  const headingTitle = headingTooltipOf(entry)
  const compact = mode === 'compact'
  const hairline = 'color-mix(in srgb, currentColor 10%, transparent)'
  const accent = 'color-mix(in srgb, currentColor 45%, transparent)'

  /**
   * The glyph keeps its own square slot, and shows the *category*.
   *
   * It answers a different question than the picture does — so a record with a
   * thumbnail shows both, side by side, instead of one replacing the other. One
   * size in both densities: the user asked twice for it to be larger, and 38 is
   * where it stopped reading as a smudge next to the title.
   */
  const glyph = (
    <span
      aria-hidden
      style={{
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        background: tileBackground(entry),
        width: 38,
        height: 38,
        borderRadius: 8,
        border: `1px solid ${hairline}`,
      }}
    >
      {categoryGlyph(entry.category, 22)}
    </span>
  )

  /**
   * The preview slot, on the right of the card, square and cropped — not a
   * full-width poster. A phone photo is portrait and a video still is
   * landscape, so a fixed band would either letterbox one or crop the other
   * into nonsense.
   *
   * It is a button of its own: clicking it opens the panel's lightbox — the same
   * one the detail pane's 「放大查看」 uses — and does *not* select the record,
   * which is what the rest of the card is for. A media link has no bytes to show,
   * so its tile is only an affordance and the lightbox hands the page over.
   */
  const previewMime = entry.previewMime ?? ''
  const previewKind = previewMime.startsWith('video/')
    ? 'video'
    : previewMime.startsWith('audio/')
      ? 'audio'
      : previewMime.startsWith('image/')
        ? 'image'
        : undefined
  const mediaLink =
    entry.kind === 'link' && (entry.platform === 'bilibili' || entry.platform === 'xiaoyuzhou')
  const preview =
    compact || (previewKind === undefined && !mediaLink) ? null : (
      <button
        type="button"
        title={previewKind === undefined ? '在浏览器里播放' : '在面板里放大'}
        onClick={(event) => {
          // The card opens the record; the picture must not.
          event.stopPropagation()
          onPreview()
        }}
        style={{
          flex: 'none',
          width: 64,
          height: 64,
          padding: 0,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          background: tileBackground(entry),
          border: `1px solid ${hairline}`,
          borderRadius: 8,
          color: 'inherit',
          cursor: previewKind === undefined ? 'pointer' : 'zoom-in',
        }}
      >
        {previewKind === 'image' && entry.previewId !== undefined ? (
          <img
            src={attachmentUrl(entry.previewId)}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        ) : (
          <Play size={26} />
        )}
      </button>
    )

  return (
    /*
      A div carrying a button's semantics rather than a `<button>`: the preview
      slot is a real button of its own, and interactive content may not nest.
     */
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        width: '100%',
        // A div is content-box by default, a `<button>` was not.
        boxSizing: 'border-box',
        // One height for every card in the grid, whether or not it has a preview
        // line to fill: the tallest natural card is the one with a picture
        // (three text lines beside a 64px thumbnail), while a record whose
        // heading doubles as its preview only fills two. 94 is what that tallest
        // card measures with the panel's own font — the panel sets 14px/1.6
        // system-ui rather than inheriting dsh's, so the number does not move.
        ...(compact ? {} : { minHeight: 94 }),
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
              borderRadius: 10,
            }),
        padding: compact ? '5px 10px' : '9px 10px',
        cursor: 'pointer',
        opacity: 1,
      }}
    >
      {glyph}
      <span
        style={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          // Grid stacks title / preview / metadata; compact puts the title and
          // the right-hand category-and-date on one line, all centred on the
          // same axis as the glyph.
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'stretch',
          gap: compact ? 8 : 3,
        }}
      >
        {/*
          No type badge above the title any more: it took a line of its own, and
          it said what the metadata line below already says (the category) —
          the glyph on the left names the kind as well. One line less per card
          is one more card on screen.
        */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            ...(compact ? { flex: 1 } : {}),
          }}
        >
          {/*
            One line each, ellipsised. A card whose height depends on how long
            its URL is turns the list into a ragged column you cannot scan — and
            in a three-column panel there is never room for the wrapping to look
            deliberate.
          */}
          <span
            title={headingTitle}
            style={{
              display: 'block',
              minWidth: 0,
              // Width has a ceiling and a tail: no heading may stretch the card
              // or push the metadata around, it ellipsises instead.
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {headingText}
          </span>
          {/*
            待看 sits next to the title, where the eye already is, and it is the
            one tinted thing on the card: the user put that flag there himself,
            and a grey chip among grey metadata reads as decoration.
          */}
          {entry.watchLater && (
            <span
              style={{
                flex: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '0 7px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: `color-mix(in srgb, ${WATCH_COLOR} 20%, transparent)`,
                border: `1px solid color-mix(in srgb, ${WATCH_COLOR} 55%, transparent)`,
                color: WATCH_COLOR,
              }}
            >
              <Bookmark size={11} /> 待看
            </span>
          )}
        </span>
        {!compact && !secret && entry.preview !== undefined && entry.preview !== headingText && (
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
            ...(compact ? {} : { marginTop: 4 }),
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
        </span>
      </span>
      {preview}
    </div>
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
  /** Open one attachment full size (or playing), out of the panel's own layout. */
  onZoom: (target: Lightbox) => void
}): React.ReactElement {
  const [note, setNote] = React.useState(detail.note ?? '')
  const [title, setTitle] = React.useState(detail.title ?? '')
  const [tags, setTags] = React.useState(detail.tags.join(', '))

  React.useEffect(() => {
    setNote(detail.note ?? '')
    setTitle(detail.title ?? '')
    setTags(detail.tags.join(', '))
  }, [detail])

  const inBin = detail.deletedAt !== undefined

  return (
    /*
      Two siblings rather than one column: the content scrolls inside the card
      (a long text, a stack of photos, and the form all have to stay reachable),
      while the timestamps hang off the *frame* — absolutely positioned against
      the card, 16px above its bottom edge, where neither the content's length
      nor its scrolling can move them. The content's `paddingBottom` keeps the
      last control clear of the band they occupy.
    */
    <>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          // The band the stamps sit in is reserved structurally rather than as
          // padding: a scroll container's padding-bottom is *inside* the scroll
          // area, so the last control would still slide under the stamps while
          // scrolling. A margin takes the room out of the scrollport instead.
          marginBottom: 40,
          // Reserve the scrollbar's lane whether or not this record needs one,
          // so the controls do not change width as you click from record to
          // record (354px wide when they fit, 339px once a scrollbar appears).
          scrollbarGutter: 'stable',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
      <div
        style={{
          ...paneRowStyle,
          display: 'flex',
          gap: 8,
          // Centre, not baseline: the source is a pill now, and a pill aligned
          // on the text baseline hangs off the bottom of the line.
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <strong>{KIND_LABELS[detail.kind]}</strong>
        <span style={{ opacity: 0.6 }}>{CATEGORY_LABELS[detail.category]}</span>
        {detail.categorySource !== undefined && <SourceBadge source={detail.categorySource} />}
        {detail.platform !== undefined && <span style={{ opacity: 0.6 }}>{detail.platform}</span>}
      </div>

      {detail.url !== undefined && (
        <a
          href={detail.url}
          target="_blank"
          rel="noreferrer"
          style={{ ...paneRowStyle, overflowWrap: 'anywhere' }}
        >
          {detail.url}
        </a>
      )}

      {detail.text !== undefined && (
        <pre
          style={{
            ...paneRowStyle,
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

      {/*
        A credential the host could not open: the body never left the disk, so
        this is what the pane has to say. Not an error — it is the state the
        encryption model puts you in after every restart, on purpose.
      */}
      {detail.text === undefined && detail.category === 'secret' && (
        <p style={{ ...paneRowStyle, margin: 0, opacity: 0.75 }}>
          这条账密的正文是密文，现在解不开。到「设置 → 账密加密」解锁（或先设一个主密码）就能看到。
        </p>
      )}

      {detail.attachments.length > 0 && (
        <div
          style={{
            ...paneRowStyle,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {detail.attachments.map((attachment) => {
            const src = attachmentUrl(attachment.id)
            const caption = attachmentCaption(attachment)
            const playable =
              attachment.mime.startsWith('video/') || attachment.mime.startsWith('audio/')
            /*
              A picture is not a document: no frame around it, and the picture
              and its caption both sit on the pane's centre line. A video or a
              sound gets the same slot with a play badge, and opens in the
              lightbox; a document keeps the framed box, because a bare 📄 glyph
              would float.
            */
            if (!attachment.image && !playable) {
              return (
                <figure
                  key={attachment.id}
                  style={{ ...cardStyle, margin: 0, padding: 8, textAlign: 'center' }}
                >
                  <div style={{ opacity: 0.7 }}>📄</div>
                  <figcaption style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
                    {caption}
                  </figcaption>
                </figure>
              )
            }
            return (
              <figure
                key={attachment.id}
                style={{
                  margin: 0,
                  maxWidth: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  title={playable ? '播放' : '放大查看'}
                  onClick={() => onZoom({ src, mime: attachment.mime, label: caption })}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: playable ? 'pointer' : 'zoom-in',
                  }}
                >
                  {playable ? (
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 160,
                        height: 90,
                        borderRadius: 6,
                        border: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                        background: tileBackground(detail),
                        color: 'inherit',
                      }}
                    >
                      <Play size={28} />
                    </span>
                  ) : (
                    <img
                      src={src}
                      alt={attachment.filename ?? ''}
                      style={{ maxWidth: 220, maxHeight: 220, borderRadius: 6, display: 'block' }}
                    />
                  )}
                </button>
                <figcaption
                  style={{
                    opacity: 0.7,
                    fontSize: 12,
                    textAlign: 'center',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {caption}
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}

      {/*
        No labels in the form: in a 380px column a 「名称 / 类目 / 备注 / 标签」 gutter
        stole a third of every field's width and repeated what the field already
        says. The placeholder carries the hint, and every control fills the pane.
      */}
      {/*
        The name comes first because it is what the list, the cards and the dock
        show — for a photo or a file it is the difference between 「身份证正面」 and
        「（无标题）」, or between two rows both called `IMG_1234.jpg`. Emptying it
        clears the name again and hands the heading back to the file name.
      */}
      <input
        value={title}
        disabled={busy}
        maxLength={MAX_TITLE_CHARS}
        onChange={(event) => setTitle(event.target.value)}
        aria-label="名称"
        title="列表、卡片和对话卡片显示这个名字；留空则用文件名或备注兜底"
        placeholder="名称，如：身份证正面（留空则用文件名兜底）"
        style={{ ...paneRowStyle, ...inputStyle, width: '100%', boxSizing: 'border-box' }}
      />

      {/*
        A link whose headline never arrived says so. Without this line the record
        just sits there looking unnamed, which reads as a broken feature rather
        than as "that site would not talk to us" — WeChat answers anonymous
        requests with an anti-bot page that has an empty <title>.
      */}
      {detail.title === undefined &&
        detail.linkTitle === undefined &&
        detail.linkTitleError !== undefined &&
        detail.kind === 'link' && (
          <p style={{ ...paneRowStyle, margin: 0, fontSize: 12, opacity: 0.6 }}>
            没抓到页面标题：{titleFailureText(detail.linkTitleError)}
            。可以自己起个名字。
          </p>
        )}

      <SelectBox
        block
        label="类目"
        value={detail.category}
        options={CATEGORIES.map((value) => [value, CATEGORY_LABELS[value]] as const)}
        disabled={busy}
        onChange={(next) => void onUpdate({ category: next })}
      />

      <textarea
        value={note}
        disabled={busy}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        aria-label="备注"
        title="你写的永远优先于模型的判断"
        placeholder="备注，如：身份证照 / 待看视频 / 这个 key 是测试环境的（没起名字时，它会顶上当列表里的名字）"
        style={{
          ...paneRowStyle,
          ...inputStyle,
          resize: 'vertical',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {/*
        Each chip can be dropped on its own — the fine-grained half of tag
        management; the rail's ✕ does the same word everywhere. The chips get a
        row of their own so the input below can run the pane's full width.
      */}
      {detail.tags.length > 0 && (
        <div
          style={{
            ...paneRowStyle,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {detail.tags.map((value) => (
            <span
              key={value}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                // Never let a flex row squeeze a chip to nothing: they collapsed
                // to zero width once, which is why nobody could see them.
                flex: 'none',
                background: 'color-mix(in srgb, currentColor 9%, transparent)',
                border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                borderRadius: 999,
                padding: '1px 4px 1px 8px',
                fontSize: 12,
              }}
            >
              #{value}
              <button
                type="button"
                title={`从这条记录上移除「${value}」`}
                style={{ ...actionStyle, padding: '2px 6px', gap: 2 }}
                onClick={() => void onUpdate({ tags: detail.tags.filter((tag) => tag !== value) })}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={tags}
        disabled={busy}
        onChange={(event) => setTags(event.target.value)}
        aria-label="标签"
        placeholder="输入标签，如：前端, 报销（逗号分隔）"
        style={{ ...paneRowStyle, ...inputStyle, width: '100%', boxSizing: 'border-box' }}
      />

      {/*
        Three actions, three equal thirds of the pane: no ragged tail of empty
        space, and one tap target per column of the form above. Labels stay on
        one line (a verb does not break into two), so the row never wraps.
      */}
      <div style={{ ...paneRowStyle, display: 'flex', gap: 6 }}>
        <button
          type="button"
          style={{ ...primaryStyle, flex: 1, justifyContent: 'center', whiteSpace: 'nowrap' }}
          disabled={busy}
          onClick={() =>
            void onUpdate({
              title: title.trim(),
              note,
              tags: tags
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
            })
          }
        >
          <Check size={14} />
          保存以上
        </button>
        <button
          type="button"
          style={{ ...actionStyle, flex: 1, justifyContent: 'center', whiteSpace: 'nowrap' }}
          disabled={busy || inBin}
          onClick={() => void onUpdate({ watchLater: detail.watchLater !== true })}
        >
          <Bookmark size={14} />
          {detail.watchLater === true ? '取消待看' : '标为待看'}
        </button>
        {inBin ? (
          <button
            type="button"
            style={{ ...actionStyle, flex: 1, justifyContent: 'center', whiteSpace: 'nowrap' }}
            disabled={busy}
            onClick={() => void onRestore()}
          >
            <RotateCcw size={14} /> 恢复
          </button>
        ) : (
          <button
            type="button"
            style={{ ...dangerStyle, flex: 1, justifyContent: 'center', whiteSpace: 'nowrap' }}
            disabled={busy}
            onClick={() => void onDelete()}
          >
            <Trash2 size={14} /> 删除
          </button>
        )}
      </div>
      </div>
      {/*
        The timestamps. Outside the scrolling column on purpose, so they stay
        put while a long record is read — the old place was the header row, where
        a long category wrapped them onto a line of their own.
      */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 16,
          fontSize: 12,
          opacity: 0.6,
          overflowWrap: 'anywhere',
        }}
      >
        存入 {new Date(detail.createdAt).toLocaleString()}
        {detail.updatedAt === detail.createdAt
          ? ''
          : ` · 更新 ${new Date(detail.updatedAt).toLocaleString()}`}
      </div>
    </>
  )
}

/** What the user reads after a successful submission. */
function describe(summary: CaptureResult): string {
  const parts: string[] = []
  if (summary.stored > 0) parts.push(`已存入 ${summary.stored} 条`)
  /*
    A record pulled back out of the recycle bin is not just "a repeat": it is the
    difference between "nothing happened" and "it is back in the list", and the
    user asked for exactly that. So it is counted and said separately, and the
    plain-repeat count leaves it out rather than reporting the same record twice.
  */
  const repeats = summary.merged - summary.restored
  if (repeats > 0) parts.push(`合并 ${repeats} 条重复项`)
  if (summary.restored > 0) parts.push(`从回收站取回 ${summary.restored} 条`)
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

/** `name · 1920×1080 · 2.3 MB` — the one line under an attachment. */
function attachmentCaption(attachment: AttachmentSummary): string {
  const pixels =
    attachment.width === undefined || attachment.height === undefined
      ? ''
      : ` · ${String(attachment.width)}×${String(attachment.height)}`
  return `${attachment.filename ?? attachment.mime}${pixels} · ${formatBytes(attachment.bytes)}`
}

/** The panel's own route for one attachment's bytes. */
function attachmentUrl(id: string): string {
  return `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(id)}`
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
