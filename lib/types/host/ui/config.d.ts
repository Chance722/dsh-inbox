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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type UiPrefs } from '../../shared/panel-wire.js';
import { type SettingsSection } from '../settings.js';
/** Namespace this plugin owns for panel preferences (0.1.x settings service). */
export declare const UI_SETTINGS_NAMESPACE = "dsh-inbox-ui";
/** What a fresh install looks like: two columns of cards, the roomier of the two. */
export declare const DEFAULT_UI_PREFS: UiPrefs;
/**
 * The fields the panel remembers, in one place: the 0.1.x namespace schema and
 * the 0.2.x config row are both built from this map, and the row needs only the
 * names (see `../settings.js`).
 */
export declare const UI_FIELDS: {
    listMode: z<"grid" | "compact", "grid" | "compact", "defined">;
};
/** The namespace's schema; every field optional so a partial layer is valid. */
export declare const UiPrefsSchema: z<Schemastery.ObjectS<NoInfer<{
    listMode: z<"grid" | "compact", "grid" | "compact", "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    listMode: z<"grid" | "compact", "grid" | "compact", "defined">;
}>>, "plain">;
/** Where the panel's own preferences live, under either service shape. */
export declare const UI_SECTION: SettingsSection;
/**
 * Declare the namespace. Registering more than once in a process throws, so a
 * second activation of the plugin simply keeps the first declaration.
 *
 * Nothing to declare on 0.2.x — the exported `Config` is the declaration there.
 *
 * @param ctx - host context.
 */
export declare function installUiSettings(ctx: Context): void;
/**
 * Read the panel preferences, falling back to the defaults.
 *
 * @param ctx - host context.
 * @returns the preferences, plus whether a settings service was there at all.
 */
export declare function readUiPrefs(ctx: Context): UiPrefs & {
    settingsAvailable: boolean;
};
/**
 * Persist a preference change.
 *
 * @param ctx - host context.
 * @param patch - what to change; an absent field changes nothing.
 * @returns whether the write went through, and why not when it did not.
 */
export declare function saveUiPrefs(ctx: Context, patch: {
    listMode?: string;
}): Promise<{
    ok: boolean;
    reason?: string;
}>;
