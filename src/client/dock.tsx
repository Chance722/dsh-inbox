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
import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_LIST,
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
 * A caller that can reveal the tab, set once registration succeeds.
 *
 * It cannot be used from the inbox panel: the dock belongs to the *session*
 * surface, and showing the panel unmounts that surface — calling `openTab` from
 * there fails with `sidebarRight: no session surface is mounted` (measured).
 * Whoever opens it has to be standing in a conversation, which is why the tab
 * ships a guide entry instead of a button here.
 */
export let openVaultDock: (() => void) | undefined

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
      openVaultDock = () => {
        controller?.openTab?.(DOCK_KIND)
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
function InboxDock(): React.ReactElement {
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
              opacity: entry.status === 'read' ? 0.7 : 1,
            }}
          >
            <div style={{ overflowWrap: 'anywhere' }}>
              {entry.title ?? entry.url ?? entry.preview ?? '（无标题）'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              {KIND_LABELS[entry.kind]} · {CATEGORY_LABELS[entry.category]}
              {entry.status === 'read' ? '' : ' · 未读'}
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
