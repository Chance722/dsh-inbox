/**
 * The vault's second home: a tab in the right dock, next to the conversation.
 *
 * A tab type is registered in two stages — the type itself into
 * `ctx.sidebarRightTabs`, its body into the keyed `sidebar.right.pane.tab` seat
 * under the same `id` — and opened by kind through `ctx.sidebarRight.openTab`.
 * That is the documented third-party path (`ui-sidebar-documentpreview` is the
 * shipped proof), not a private door.
 *
 * The dock is a *convenience*, not a source of truth: it fetches the newest
 * records itself and shows them; every action still lives in the panel. It also
 * has to survive compositions with no right dock at all (a headless profile has
 * no browser), so `registerInboxDock` does nothing when the services are absent.
 */

import type { Context } from '@deepseek-ai/cordis'
import React from 'react'

import { PACKAGE_NAME } from '../shared/constants.js'
import {
  CATEGORY_LABELS,
  KIND_LABELS,
} from '../shared/vocabulary.js'
import { headingOf } from './heading.js'
import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_ATTACHMENT,
  INBOX_ENDPOINT_DETAIL,
  INBOX_ENDPOINT_LIST,
  type DetailResult,
  type EntryDetail,
  type EntrySummary,
  type InboxRpcResult,
  type ListResult,
} from '../shared/panel-wire.js'

/** Type discriminator: what `openTab` names. */
export const DOCK_KIND = 'inbox-vault'

/** Also the tab-type id and the key its body registers under. */
export const DOCK_TAB_ID = PACKAGE_NAME

/** How many records the dock bothers to list. */
const DOCK_LIMIT = 12

/**
 * A caller that can reveal the tab — optionally focused on one record.
 *
 * It cannot be used from the inbox panel: the dock belongs to the *session*
 * surface, and showing the panel unmounts that surface — calling `openTab` from
 * there fails with `sidebarRight: no session surface is mounted` (measured).
 * Whoever opens it has to be standing in a conversation — which is exactly where
 * a conversation card is, so `card.tsx` is the caller that matters: click a
 * record the assistant mentioned and the dock opens on it.
 *
 * @param id - the record to focus; omitted opens the tab on its usual list.
 */
export let openVaultDock: ((id?: string) => void) | undefined

interface SlotsLike {
  inject(name: string, register: () => unknown): void
  register(slot: Record<string, unknown>, component: unknown): unknown
}

interface TabsLike {
  register(definition: {
    id: string
    kind: string
    title: (address: string) => string
    // Copy is thunked and re-read on every use (so a language change needs no
    // re-registration) — passing plain strings crashes the guide page with
    // `entry.description is not a function`, measured.
    guide?: readonly { order: number; title: () => string; description: () => string }[]
  }): unknown
}

interface ControllerLike {
  openTab?(kind: string, options?: Record<string, unknown>): void
}

/** What a tab body may find in its navigation params; see the official contract. */
interface TabInfoLike {
  tab?: {
    navigation?: {
      params?: { id?: unknown } | undefined
      revision?: number
    }
  }
}

/** Props the slot framework injects into this tab's body. */
interface DockProps {
  hooks?: {
    tabInfo?: () => TabInfoLike
  }
}

/**
 * Register the tab type and its body.
 *
 * @param ctx - the browser plugin context.
 */
export function registerInboxDock(ctx: Context): void {
  // `ctx.get` at apply time answers undefined for a service that has not arrived
  // yet — M0's trap, which cost us a silent no-op once already. Waiting on the
  // declaration (rather than adding it to the plugin's own `inject`, which would
  // hold the whole client half back on a composition without a right dock) is
  // what `ctx.inject` is for.
  ctx.inject(['sidebarRightTabs'], (scoped) => {
    const slots = scoped.get('slots') as SlotsLike | undefined
    const tabs = scoped.get('sidebarRightTabs') as TabsLike | undefined
    if (slots === undefined || tabs === undefined) return

    try {
      tabs.register({
        id: DOCK_TAB_ID,
        kind: DOCK_KIND,
        title: () => '仓库',
        guide: [
          { order: 20, title: () => '仓库', description: () => '把 inbox 放在对话旁边，随手看' },
        ],
      })
      slots.inject('sidebar.right.pane.tab', () =>
        slots.register({ name: 'sidebar.right.pane.tab', key: DOCK_TAB_ID }, InboxDock),
      )
      const controller = scoped.get('sidebarRight') as ControllerLike | undefined
      openVaultDock = (id?: string) => {
        // `params` is the documented way to hand a tab a navigation argument
        // (the type is declared through a module augmentation we deliberately do
        // not import — the client half may not depend on dsh packages, so the
        // shape is written out here instead).
        controller?.openTab?.(
          DOCK_KIND,
          id === undefined ? undefined : { params: { id }, revealIfOpened: true },
        )
      }
    } catch {
      // A composition that already owns this kind keeps it; the panel still works.
    }
  })
}

/**
 * The dock body: the newest records, newest first.
 *
 * @returns the pane.
 */
function InboxDock(props?: DockProps): React.ReactElement {
  /*
    The tab's own address, read through the hook the slot framework injects.

    `?? {}` keeps the component working when a composition mounts the body
    without the hook (a test, or a future seat with a different share): the dock
    then simply behaves as it always did, a list of the newest records.
  */
  const info = props?.hooks?.tabInfo?.()
  const wanted = info?.tab?.navigation?.params?.id
  const focused = typeof wanted === 'string' && wanted.length > 0 ? wanted : undefined
  const revision = info?.tab?.navigation?.revision ?? 0

  return focused === undefined ? <DockList /> : <DockRecord id={focused} revision={revision} />
}

/** The list: what the dock shows when nobody asked for a particular record. */
function DockList(): React.ReactElement {
  const [entries, setEntries] = React.useState<EntrySummary[]>()
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let live = true
    void (async () => {
      try {
        const response = await fetch(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_LIST}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: DOCK_LIMIT }),
        })
        const answer = (await response.json()) as InboxRpcResult<ListResult>
        if (!live) return
        if (answer.ok) setEntries(answer.value.entries)
        else setFailed(true)
      } catch {
        if (live) setFailed(true)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  return (
    <div style={{ padding: '10px 12px', fontSize: 13 }}>
      <div style={{ opacity: 0.6, marginBottom: 8 }}>
        {entries === undefined ? '读取中…' : `最近 ${String(entries.length)} 条`}
      </div>
      {failed && <p style={{ opacity: 0.7 }}>读不到仓库，去左侧「Inbox」面板看看。</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries?.map((entry) => (
          <li
            key={entry.id}
            style={{
              border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
              borderRadius: 8,
              padding: '6px 8px',
              opacity: 1,
            }}
          >
            <div style={{ overflowWrap: 'anywhere' }}>
              {/*
                The same heading the panel's cards use — and the same red line:
                this used to fall through to `entry.preview`, which is the first
                line of a credential's text when the record is one.
              */}
              {headingOf(entry)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              {KIND_LABELS[entry.kind]} · {CATEGORY_LABELS[entry.category]}
              {entry.watchLater ? ' · 待看' : ''}
            </div>
          </li>
        ))}
      </ul>
      <p style={{ opacity: 0.6, marginTop: 10 }}>
        这里是随手看。改类目、删记录、入库设置在左侧「Inbox」面板里。
      </p>
    </div>
  )
}

/**
 * One record, opened from a conversation card.
 *
 * The point of the whole feature: the assistant mentioned a record, and this is
 * where you actually look at it — its text, its link, and the picture that never
 * entered the conversation.
 *
 * @param props - which record, and a revision that re-reads on every re-open.
 * @returns the pane.
 */
function DockRecord({ id, revision }: { id: string; revision: number }): React.ReactElement {
  const [entry, setEntry] = React.useState<EntryDetail>()
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let live = true
    setEntry(undefined)
    setFailed(false)
    void (async () => {
      try {
        const response = await fetch(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_DETAIL}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        const answer = (await response.json()) as InboxRpcResult<DetailResult>
        if (!live) return
        if (answer.ok) setEntry(answer.value.entry)
        else setFailed(true)
      } catch {
        if (live) setFailed(true)
      }
    })()
    return () => {
      live = false
    }
    // `revision` in the list re-reads when the same record is clicked again —
    // the user may have changed it in the panel meanwhile.
  }, [id, revision])

  const clause: React.CSSProperties = { margin: '6px 0 0', overflowWrap: 'anywhere' }

  return (
    <div style={{ padding: '10px 12px', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>仓库</strong>
        <button
          type="button"
          onClick={() => openVaultDock?.()}
          title="回到最近记录"
          style={{
            marginLeft: 'auto',
            font: 'inherit',
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, currentColor 25%, transparent)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          返回最近
        </button>
      </div>

      {failed && <p style={{ opacity: 0.7 }}>读不到这条记录，它可能已经被删掉了。</p>}
      {entry === undefined && !failed && <p style={{ opacity: 0.6 }}>读取中…</p>}

      {entry !== undefined && (
        <div>
          <div style={{ overflowWrap: 'anywhere', fontWeight: 500 }}>{headingOf(entry)}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            {KIND_LABELS[entry.kind]} · {CATEGORY_LABELS[entry.category]}
            {entry.watchLater ? ' · 待看' : ''}
            {` · ${new Date(entry.createdAt).toLocaleString()}`}
          </div>

          {entry.note !== undefined && entry.note.length > 0 && (
            <p style={clause}>备注：{entry.note}</p>
          )}

          {entry.url !== undefined && (
            <p style={clause}>
              <a href={entry.url} target="_blank" rel="noreferrer">
                {entry.url}
              </a>
            </p>
          )}

          {/*
            The picture, drawn here: this is the record's bytes coming back from
            the panel's own route on this machine, which is why the conversation
            could stay text-only and still end with you looking at the image.
          */}
          {entry.attachments.map((attachment) => (
            <div key={attachment.id} style={{ marginTop: 8 }}>
              {attachment.image ? (
                <img
                  src={`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}?id=${encodeURIComponent(attachment.id)}`}
                  alt={attachment.filename ?? ''}
                  style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }}
                />
              ) : (
                <div style={{ opacity: 0.7 }}>
                  📄 {attachment.filename ?? attachment.mime}
                  {` · ${String(Math.round(attachment.bytes / 1024))} KB`}
                </div>
              )}
            </div>
          ))}

          {entry.text !== undefined && entry.text.length > 0 && (
            <pre
              style={{
                margin: '10px 0 0',
                padding: 8,
                maxHeight: 260,
                overflow: 'auto',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.text}
            </pre>
          )}

          <p style={{ opacity: 0.6, marginTop: 10 }}>
            改类目、改备注、删除都在左侧「Inbox」面板里。
          </p>
        </div>
      )}
    </div>
  )
}
