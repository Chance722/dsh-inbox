/**
 * The two shapes of dsh's settings service, behind one small door.
 *
 * This plugin keeps a handful of *values* in dsh's settings: which list density
 * the panel opens with, and where the sync endpoint lives. dsh moved that
 * service between the two lines we ship to, and the two shapes are not
 * compatible:
 *
 * - **0.1.x**: you declare a namespace of your own — `register(namespace,
 *   schema, { base })` — and then address it by name with `get(namespace)` /
 *   `update(namespace, patch)`.
 * - **0.2.x**: the service keeps no namespaces at all. The address is the
 *   *profile row id of the plugin itself* (`describe()` reports `ns`, i.e. the
 *   row's `id`), and only fields the plugin's own `Config` marks with
 *   `volatile()` may be written through `update(id, patch)`.
 *
 * Asking the wrong one is not a tidy error. On 0.2.x the old call throws
 * `No configurable plugin entry "dsh-inbox-ui"`, and because `update()` there is
 * `async`, an unawaited rejection escapes as an unhandled rejection — which dsh
 * treats as fatal, so the desktop host exits (measured 2026-09-30: clicking the
 * panel's list-mode toggle killed the whole app). Hence: the shape is chosen
 * once, here, and every write is awaited and answered with a reason instead of
 * a throw.
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * One group of fields this plugin keeps in dsh's settings.
 *
 * The two names are the same group under the two service shapes: the namespace
 * is how 0.1.x addresses it, the field list is how 0.2.x finds the same values
 * inside the plugin's own config row.
 */
export interface SettingsSection {
    /** The namespace this group owns in the 0.1.x settings service. */
    namespace: string;
    /** The fields this group owns in the 0.2.x plugin config row. */
    fields: readonly string[];
}
/** How a write ended. A refusal is an answer, not an exception. */
export type SettingsWrite = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
/** Read one group; merge fields into it. */
export interface SettingsStore {
    /** The group's stored fields, or undefined when nothing is stored for it. */
    read(section: SettingsSection): Record<string, unknown> | undefined;
    write(section: SettingsSection, patch: Record<string, unknown>): Promise<SettingsWrite>;
}
/** The 0.1.x settings service: namespaces you declare and then address by name. */
export interface LegacySettings {
    register(namespace: string, schema: unknown, options: {
        base: unknown;
    }): unknown;
    get(namespace: string): Record<string, unknown> | undefined;
    update(namespace: string, patch: Record<string, unknown>): unknown;
}
/**
 * Mark one config field as live, so the 0.2.x settings service will write it.
 *
 * `volatile()` is what makes a field writable through that service, and marking
 * is a no-op on a runtime that never heard of it (0.1.x), so one field map
 * serves both lines: the plain schema still declares the namespace there.
 *
 * @param field - a schemastery field.
 * @returns the same field, marked where the runtime knows how.
 */
export declare function markLive<T>(field: T): T;
/**
 * The namespace-shaped service, or undefined when this composition has none.
 *
 * Only declarations go through here: 0.2.x has no `register` at all, and its
 * config row is declared by the exported `Config` instead.
 *
 * @param ctx - host context.
 */
export declare function legacySettings(ctx: Context): LegacySettings | undefined;
/**
 * The settings this plugin reads and writes, whichever shape the runtime has.
 *
 * @param ctx - host context.
 * @returns the store, or undefined when there is nothing to store into.
 */
export declare function settingsStore(ctx: Context): SettingsStore | undefined;
