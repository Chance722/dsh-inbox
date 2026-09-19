import type { Context } from '@deepseek-ai/cordis'
import React from 'react'

import { MILESTONE, PANEL_ID, PACKAGE_NAME } from '../shared/constants.js'

/** Stable Cordis plugin name for the browser half. */
export const name = 'dsh-inbox-client'

/**
 * Hard dependency on the slot registry: without it Cordis runs `apply` before
 * `slots` exists and every registration is silently skipped.
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

  slots.inject('main', () =>
    slots.register({ name: 'main', key: PANEL_ID }, InboxPanel),
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

/** The panel body for M0: prove the `main` key renders, nothing more. */
function InboxPanel(): React.ReactElement {
  return (
    <div style={{ padding: '24px', font: '14px/1.6 system-ui, sans-serif' }}>
      <h2 style={{ margin: '0 0 8px' }}>dsh-inbox</h2>
      <p style={{ margin: '0 0 4px', opacity: 0.7 }}>
        {PACKAGE_NAME} · {MILESTONE}
      </p>
      <p style={{ margin: 0, opacity: 0.7 }}>
        Storage and query are in place. Capture, the vault list and classification arrive with M2–M5.
      </p>
    </div>
  )
}
