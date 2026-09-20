/**
 * Reading a tab's navigation params.
 *
 * This is the whole difference between 「打开 ↗」 working and quietly doing
 * nothing: the id the card passes lives in the tab record, under a shape the
 * platform owns. The first version read it from `hooks.tabInfo`, which a pane
 * body never receives (measured 2026-09-20 — the real share carries
 * `useTabInfo`), so every press fell back to the dock's list.
 */

import { describe, expect, it } from 'vitest'

import { dockFocusOf } from '../src/client/dock.js'

/** The shape the running app answered, trimmed to what matters here. */
const info = (params: unknown, revision: unknown) => ({
  tab: { navigation: { address: 'sidebar://inbox-vault', params, revision } },
})

describe('dockFocusOf', () => {
  it('finds the record the opener named', () => {
    expect(dockFocusOf(info({ id: 'c54af2bd-721a-4eaa-909b-5b40450c2156' }, 1))).toEqual({
      id: 'c54af2bd-721a-4eaa-909b-5b40450c2156',
      revision: 1,
    })
  })

  it('has no record when nobody named one — the dock then shows its list', () => {
    expect(dockFocusOf(info(undefined, 0))).toEqual({ revision: 0 })
    expect(dockFocusOf(undefined)).toEqual({ revision: 0 })
    expect(dockFocusOf({})).toEqual({ revision: 0 })
  })

  it('refuses an id that is not a usable string', () => {
    // An empty or non-string id would ask the API for a record that cannot
    // exist; the list is the honest answer.
    expect(dockFocusOf(info({ id: '' }, 1))).toEqual({ revision: 1 })
    expect(dockFocusOf(info({ id: 42 }, 1))).toEqual({ revision: 1 })
  })

  it('defaults the revision rather than passing a non-number on', () => {
    expect(dockFocusOf(info({ id: 'x' }, undefined))).toEqual({ id: 'x', revision: 0 })
    expect(dockFocusOf(info({ id: 'x' }, '3'))).toEqual({ id: 'x', revision: 0 })
  })
})
