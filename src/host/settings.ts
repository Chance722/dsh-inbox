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

import type { Context } from '@deepseek-ai/cordis'

/**
 * One group of fields this plugin keeps in dsh's settings.
 *
 * The two names are the same group under the two service shapes: the namespace
 * is how 0.1.x addresses it, the field list is how 0.2.x finds the same values
 * inside the plugin's own config row.
 */
export interface SettingsSection {
  /** The namespace this group owns in the 0.1.x settings service. */
  namespace: string
  /** The fields this group owns in the 0.2.x plugin config row. */
  fields: readonly string[]
}

/** How a write ended. A refusal is an answer, not an exception. */
export type SettingsWrite = { ok: true } | { ok: false; reason: string }

/** Read one group; merge fields into it. */
export interface SettingsStore {
  /** The group's stored fields, or undefined when nothing is stored for it. */
  read(section: SettingsSection): Record<string, unknown> | undefined
  write(section: SettingsSection, patch: Record<string, unknown>): Promise<SettingsWrite>
}

/** The 0.1.x settings service: namespaces you declare and then address by name. */
export interface LegacySettings {
  register(namespace: string, schema: unknown, options: { base: unknown }): unknown
  get(namespace: string): Record<string, unknown> | undefined
  update(namespace: string, patch: Record<string, unknown>): unknown
}

/** One row of the 0.2.x service's own report. */
interface SettingsDescriptor {
  ns: string
  value?: Record<string, unknown>
}

/** The 0.2.x settings service: the plugin's config row, addressed by row id. */
interface ModernSettings {
  describe(): SettingsDescriptor[]
  update(id: string, patch: Record<string, unknown>): Promise<unknown>
}

/** Whatever settings service this composition has, if any. */
function settingsService(ctx: Context): Record<string, unknown> | undefined {
  return ctx.get('settings') as Record<string, unknown> | undefined
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
export function markLive<T>(field: T): T {
  const mark = (field as { volatile?: () => unknown }).volatile
  return typeof mark === 'function' ? (mark.call(field) as T) : field
}

/**
 * The namespace-shaped service, or undefined when this composition has none.
 *
 * Only declarations go through here: 0.2.x has no `register` at all, and its
 * config row is declared by the exported `Config` instead.
 *
 * @param ctx - host context.
 */
export function legacySettings(ctx: Context): LegacySettings | undefined {
  const settings = settingsService(ctx)
  return typeof settings?.register === 'function' ? (settings as unknown as LegacySettings) : undefined
}

/**
 * The settings this plugin reads and writes, whichever shape the runtime has.
 *
 * @param ctx - host context.
 * @returns the store, or undefined when there is nothing to store into.
 */
export function settingsStore(ctx: Context): SettingsStore | undefined {
  const settings = settingsService(ctx)
  if (settings === undefined) return undefined

  if (typeof settings.register === 'function') {
    const legacy = settings as unknown as LegacySettings
    return {
      read: (section) => legacy.get(section.namespace),
      write: async (section, patch) => {
        try {
          await legacy.update(section.namespace, patch)
          return { ok: true }
        } catch (error) {
          return { ok: false, reason: reasonOf(error) }
        }
      },
    }
  }

  if (typeof settings.describe === 'function' && typeof settings.update === 'function') {
    // The address is the profile row this plugin instance was loaded from, so a
    // renamed row keeps working; without it there is nothing to write to.
    const id = pluginRowId(ctx)
    if (id === undefined) return undefined
    const modern = settings as unknown as ModernSettings
    return {
      read: (section) => {
        // `describe()`, not the config object: it answers in plain values, and
        // it is the same call the host's own settings page renders from.
        const row = readable(modern).find((each) => each.ns === id)
        return row?.value === undefined ? undefined : pick(row.value, section.fields)
      },
      write: async (section, patch) => {
        try {
          await modern.update(id, pick(patch, section.fields))
          return { ok: true }
        } catch (error) {
          return { ok: false, reason: reasonOf(error) }
        }
      },
    }
  }

  return undefined
}

/**
 * The id of the profile row this plugin instance was loaded from.
 *
 * The loader records every row's entry on the fiber it created for it
 * (`fiber.entry`, set from the row's own context), and 0.2.x settings writes are
 * addressed by exactly that row id.
 *
 * @param ctx - host context.
 * @returns the row id, or undefined when this context is not a loaded row.
 */
function pluginRowId(ctx: Context): string | undefined {
  const fiber = (ctx as { fiber?: { entry?: { options?: { id?: unknown } } } }).fiber
  const entry = fiber?.entry
  const id = entry?.options?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/** `describe()` reads the profile from disk, so a failure is a default, not a throw. */
function readable(settings: ModernSettings): SettingsDescriptor[] {
  try {
    return settings.describe()
  } catch {
    return []
  }
}

/** Only the fields this section owns — one row holds every section's. */
function pick(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const field of fields) if (Object.hasOwn(source, field)) picked[field] = source[field]
  return picked
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
