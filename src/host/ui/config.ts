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
import { legacySettings, settingsStore, type SettingsSection } from '../settings.js'

/** Namespace this plugin owns for panel preferences (0.1.x settings service). */
export const UI_SETTINGS_NAMESPACE = 'dsh-inbox-ui'

/** What a fresh install looks like: two columns of cards, the roomier of the two. */
export const DEFAULT_UI_PREFS: UiPrefs = { listMode: 'grid' }

/**
 * The fields the panel remembers, in one place: the 0.1.x namespace schema and
 * the 0.2.x config row are both built from this map, and the row needs only the
 * names (see `../settings.js`).
 */
export const UI_FIELDS = {
  listMode: z.union(['grid', 'compact']).default('grid'),
}

/** The namespace's schema; every field optional so a partial layer is valid. */
export const UiPrefsSchema = z.object(UI_FIELDS)

/** Where the panel's own preferences live, under either service shape. */
export const UI_SECTION: SettingsSection = {
  namespace: UI_SETTINGS_NAMESPACE,
  fields: Object.keys(UI_FIELDS),
}

/**
 * Declare the namespace. Registering more than once in a process throws, so a
 * second activation of the plugin simply keeps the first declaration.
 *
 * Nothing to declare on 0.2.x — the exported `Config` is the declaration there.
 *
 * @param ctx - host context.
 */
export function installUiSettings(ctx: Context): void {
  const settings = legacySettings(ctx)
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
  const store = settingsStore(ctx)
  if (store === undefined) return { ...DEFAULT_UI_PREFS, settingsAvailable: false }
  const stored = store.read(UI_SECTION)?.listMode
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
export async function saveUiPrefs(
  ctx: Context,
  patch: { listMode?: string },
): Promise<{ ok: boolean; reason?: string }> {
  if (patch.listMode === undefined) return { ok: true }
  if (!UI_LIST_MODES.includes(patch.listMode as UiListMode)) {
    return {
      ok: false,
      reason: `列表模式只支持 ${UI_LIST_MODES.join(' / ')}，收到的是 ${patch.listMode}`,
    }
  }
  const store = settingsStore(ctx)
  if (store === undefined) return { ok: false, reason: '这个组合里没有设置服务，记不住列表模式' }
  installUiSettings(ctx)
  const written = await store.write(UI_SECTION, { listMode: patch.listMode })
  // The raw reason: the panel wraps it in its own sentence, and a second one
  // here would read "列表模式没记住：列表模式没记住：…".
  if (!written.ok) return { ok: false, reason: written.reason }
  return { ok: true }
}
