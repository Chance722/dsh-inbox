/**
 * The panel's own preferences — how it looks, not what it holds.
 *
 * Deliberately a namespace of its own rather than more fields on the remote
 * namespace: "which WebDAV server do I pull from" and "how dense should the
 * list be" are different questions that happen to share a storage service, and
 * merging them would make the remote config the home of unrelated UI state.
 *
 * It lives in dsh's settings (not `localStorage`) for the same reason the
 * theme's font size does: a preference is user state, and the user should find
 * it where they find their other settings.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { UI_LIST_MODES, type UiListMode, type UiPrefs } from '../../shared/panel-wire.js'

/** Namespace this plugin owns for panel preferences. */
export const UI_SETTINGS_NAMESPACE = 'dsh-inbox-ui'

/** What a fresh install looks like: two columns of cards, the roomier of the two. */
export const DEFAULT_UI_PREFS: UiPrefs = { listMode: 'grid' }

/** The namespace's schema; every field optional so a partial layer is valid. */
export const UiPrefsSchema = z.object({
  listMode: z.union(['grid', 'compact']).default('grid'),
})

/** The slice of the settings service this file uses. */
interface SettingsScope {
  get(): UiPrefs
  update(patch: Partial<UiPrefs>): void
}

interface SettingsLike {
  register(namespace: string, schema: unknown, options: { base: UiPrefs }): SettingsScope
  get(namespace: string): UiPrefs | undefined
  update(namespace: string, patch: Partial<UiPrefs>): void
}

/**
 * Declare the namespace. Registering more than once in a process throws, so a
 * second activation of the plugin simply keeps the first declaration.
 *
 * @param ctx - host context.
 */
export function installUiSettings(ctx: Context): void {
  const settings = ctx.get('settings') as SettingsLike | undefined
  if (settings === undefined) return
  try {
    settings.register(UI_SETTINGS_NAMESPACE, UiPrefsSchema, { base: DEFAULT_UI_PREFS })
  } catch {
    // Already declared by an earlier activation in this process.
  }
}

/**
 * Read the panel preferences, falling back to the defaults.
 *
 * @param ctx - host context.
 * @returns the preferences, plus whether a settings service was there at all.
 */
export function readUiPrefs(ctx: Context): UiPrefs & { settingsAvailable: boolean } {
  const settings = ctx.get('settings') as SettingsLike | undefined
  if (settings === undefined) return { ...DEFAULT_UI_PREFS, settingsAvailable: false }
  const stored = settings.get(UI_SETTINGS_NAMESPACE)?.listMode
  const listMode = UI_LIST_MODES.includes(stored as UiListMode)
    ? (stored as UiListMode)
    : DEFAULT_UI_PREFS.listMode
  return { listMode, settingsAvailable: true }
}

/**
 * Persist a preference change.
 *
 * @param ctx - host context.
 * @param patch - what to change; an absent field changes nothing.
 * @returns whether the write went through, and why not when it did not.
 */
export function saveUiPrefs(
  ctx: Context,
  patch: { listMode?: string },
): { ok: boolean; reason?: string } {
  if (patch.listMode === undefined) return { ok: true }
  if (!UI_LIST_MODES.includes(patch.listMode as UiListMode)) {
    return {
      ok: false,
      reason: `列表模式只支持 ${UI_LIST_MODES.join(' / ')}，收到的是 ${patch.listMode}`,
    }
  }
  const settings = ctx.get('settings') as SettingsLike | undefined
  if (settings === undefined) return { ok: false, reason: '这个组合里没有设置服务，记不住列表模式' }
  installUiSettings(ctx)
  settings.update(UI_SETTINGS_NAMESPACE, { listMode: patch.listMode as UiListMode })
  return { ok: true }
}
