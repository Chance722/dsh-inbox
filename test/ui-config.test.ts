/**
 * The panel's own preferences: a namespace of their own, a bad value refused,
 * and a composition without a settings service degrading to defaults instead of
 * throwing — on either of the settings services dsh ships (a namespace one on
 * 0.1.x, the plugin's own config row on 0.2.x).
 */

import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_UI_PREFS,
  UI_SETTINGS_NAMESPACE,
  installUiSettings,
  readUiPrefs,
  saveUiPrefs,
} from '../src/host/ui/config.js'

/**
 * A settings service that keeps one namespace value in memory.
 *
 * `listMode` is typed as a bare string on purpose: a profile written by an older
 * version can hold a mode this version no longer offers, and the reader has to
 * cope with exactly that.
 */
function fakeSettings(initial?: { listMode?: string }) {
  let current = { ...DEFAULT_UI_PREFS, ...initial }
  let registered = false
  return {
    current: () => current,
    register: vi.fn((namespace: string, _schema: unknown, options: { base: typeof DEFAULT_UI_PREFS }) => {
      if (registered) throw new Error(`namespace "${namespace}" is already registered`)
      registered = true
      current = { ...options.base, ...current }
      return { get: () => current, update: () => undefined }
    }),
    get: (namespace: string) => (namespace === UI_SETTINGS_NAMESPACE ? current : undefined),
    update: (namespace: string, patch: Partial<typeof DEFAULT_UI_PREFS>) => {
      if (namespace !== UI_SETTINGS_NAMESPACE) throw new Error('unknown namespace')
      current = { ...current, ...patch }
    },
  }
}

const context = (settings?: unknown): Context =>
  ({ get: (name: string) => (name === 'settings' ? settings : undefined) }) as unknown as Context

/**
 * The 0.2.x service: no namespaces, one config row per plugin, and `update()`
 * is async. `rowId` lets a test check the address it was called with.
 */
function modernSettings(initial?: { listMode?: string }) {
  let current = { ...DEFAULT_UI_PREFS, ...initial }
  return {
    current: () => current,
    describe: () => [{ ns: 'dsh-inbox', value: { ...current } }],
    update: vi.fn(async (_id: string, patch: { listMode?: string }) => {
      current = { ...current, ...patch }
    }),
  }
}

/** A context loaded from the profile row `dsh-inbox`, as the loader records it. */
const loadedContext = (settings?: unknown): Context =>
  ({
    get: (name: string) => (name === 'settings' ? settings : undefined),
    fiber: { entry: { options: { id: 'dsh-inbox' } } },
  }) as unknown as Context

describe('panel preferences', () => {
  it('falls back to the default layout with no settings service', () => {
    expect(readUiPrefs(context())).toEqual({ ...DEFAULT_UI_PREFS, settingsAvailable: false })
    expect(readUiPrefs(context(fakeSettings())).listMode).toBe('grid')
  })

  it('remembers the chosen layout', async () => {
    const settings = fakeSettings()
    const ctx = context(settings)

    expect((await saveUiPrefs(ctx, { listMode: 'grid' })).ok).toBe(true)
    expect(settings.current().listMode).toBe('grid')
    expect(readUiPrefs(ctx).listMode).toBe('grid')

    expect((await saveUiPrefs(ctx, { listMode: 'compact' })).ok).toBe(true)
    expect(readUiPrefs(ctx).listMode).toBe('compact')
  })

  it('remembers the chosen layout on the 0.2.x service too', async () => {
    const settings = modernSettings()
    const ctx = loadedContext(settings)

    expect((await saveUiPrefs(ctx, { listMode: 'compact' })).ok).toBe(true)
    expect(settings.update).toHaveBeenCalledWith('dsh-inbox', { listMode: 'compact' })
    expect(readUiPrefs(ctx).listMode).toBe('compact')
  })

  it('answers a refused write instead of throwing it at the host', async () => {
    // Regression, measured on the desktop 2026-09-30: 0.2.x's `update()` is
    // async, so the 0.1.x namespace call left an unawaited rejection behind and
    // dsh's fatal handler took the whole host down over a list-layout toggle.
    const settings = modernSettings()
    settings.update.mockRejectedValueOnce(new Error('No configurable plugin entry "dsh-inbox-ui"'))

    const result = await saveUiPrefs(loadedContext(settings), { listMode: 'compact' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('No configurable plugin entry')
  })

  it('refuses a layout it does not have, and says which ones it does', async () => {
    const result = await saveUiPrefs(context(fakeSettings()), { listMode: 'masonry' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('grid')
    expect(result.reason).toContain('masonry')
  })

  it('treats a stored mode that no longer exists as unset', () => {
    // `rows` was a real choice until the list went to two densities; a profile
    // that still remembers it must land on the default, not on a blank list.
    const settings = fakeSettings({ listMode: 'rows' })
    expect(readUiPrefs(context(settings)).listMode).toBe(DEFAULT_UI_PREFS.listMode)
  })

  it('refuses to remember anything when there is nowhere to remember it', async () => {
    const result = await saveUiPrefs(context(), { listMode: 'grid' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('设置服务')
  })

  it('declares its namespace once, even if activated twice', () => {
    const settings = fakeSettings()
    installUiSettings(context(settings))
    installUiSettings(context(settings))
    expect(settings.register).toHaveBeenCalledTimes(2)
    // The second call threw inside and was swallowed — the panel keeps working.
    expect(readUiPrefs(context(settings)).settingsAvailable).toBe(true)
  })
})
