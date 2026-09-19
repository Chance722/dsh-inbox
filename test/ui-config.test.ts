/**
 * The panel's own preferences: a namespace of their own, a bad value refused,
 * and a composition without a settings service degrading to defaults instead of
 * throwing.
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

describe('panel preferences', () => {
  it('falls back to the default layout with no settings service', () => {
    expect(readUiPrefs(context())).toEqual({ ...DEFAULT_UI_PREFS, settingsAvailable: false })
    expect(readUiPrefs(context(fakeSettings())).listMode).toBe('grid')
  })

  it('remembers the chosen layout', () => {
    const settings = fakeSettings()
    const ctx = context(settings)

    expect(saveUiPrefs(ctx, { listMode: 'grid' }).ok).toBe(true)
    expect(settings.current().listMode).toBe('grid')
    expect(readUiPrefs(ctx).listMode).toBe('grid')

    expect(saveUiPrefs(ctx, { listMode: 'compact' }).ok).toBe(true)
    expect(readUiPrefs(ctx).listMode).toBe('compact')
  })

  it('refuses a layout it does not have, and says which ones it does', () => {
    const result = saveUiPrefs(context(fakeSettings()), { listMode: 'masonry' })
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

  it('refuses to remember anything when there is nowhere to remember it', () => {
    const result = saveUiPrefs(context(), { listMode: 'grid' })
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
