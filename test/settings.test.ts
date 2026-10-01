/**
 * The settings door: two service shapes behind one seam.
 *
 * The 0.2.x shape is here because getting it wrong is what killed the desktop
 * host — its `update()` is async, so a call made in the 0.1.x way rejects on a
 * promise nobody waits for, and dsh treats an unhandled rejection as fatal. The
 * refusal has to come back as an answer instead.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { describe, expect, it, vi } from 'vitest'

import { Config } from '../src/host/index.js'
import { legacySettings, markLive, settingsStore, type SettingsSection } from '../src/host/settings.js'
import { UI_FIELDS, UI_SECTION, UiPrefsSchema } from '../src/host/ui/config.js'
import { WEBDAV_FIELDS, WEBDAV_SECTION, WebdavSettingsSchema } from '../src/host/webdav/config.js'

const SECTION: SettingsSection = { namespace: 'dsh-inbox-ui', fields: ['listMode'] }

/** The 0.1.x service: namespaces a plugin declares and then addresses by name. */
function legacySettingsService(initial: Record<string, unknown> = {}) {
  let current = { listMode: 'grid', ...initial }
  return {
    current: () => current,
    register: vi.fn((_namespace: string, _schema: unknown, options: { base: Record<string, unknown> }) => {
      current = { ...options.base, ...current }
      return { get: () => current, update: () => undefined }
    }),
    get: vi.fn(() => current),
    update: vi.fn((_namespace: string, patch: Record<string, unknown>) => {
      current = { ...current, ...patch }
    }),
  }
}

/** The 0.2.x service: one config row per plugin, addressed by row id. */
function modernSettingsService(initial: Record<string, unknown> = {}) {
  let current = { listMode: 'grid', protocol: 'webdav', baseUrl: '', ...initial }
  return {
    current: () => current,
    describe: vi.fn(() => [{ ns: 'dsh-inbox', value: { ...current } }]),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      if (id !== 'dsh-inbox') throw new Error(`No configurable plugin entry "${id}"`)
      current = { ...current, ...patch }
    }),
  }
}

/** A context whose plugin was loaded from the profile row `dsh-inbox`. */
const context = (settings?: unknown, rowId = 'dsh-inbox'): Context =>
  ({
    get: (name: string) => (name === 'settings' ? settings : undefined),
    fiber: { entry: { options: { id: rowId } } },
  }) as unknown as Context

describe('choosing a door', () => {
  it('is nothing at all without a settings service', () => {
    expect(settingsStore(context())).toBeUndefined()
    expect(legacySettings(context())).toBeUndefined()
  })

  it('is nothing at all when the service is neither shape', () => {
    expect(settingsStore(context({ launch: () => undefined }))).toBeUndefined()
  })

  it('takes the namespace door when the service declares namespaces', () => {
    const settings = legacySettingsService()
    expect(legacySettings(context(settings))).toBe(settings)
    expect(settingsStore(context(settings))?.read(SECTION)).toEqual({ listMode: 'grid' })
  })

  it('takes the config-row door when the service is the 0.2.x one', () => {
    const settings = modernSettingsService({ listMode: 'compact' })
    // No `register` at all: that is how the two shapes are told apart.
    expect(legacySettings(context(settings))).toBeUndefined()
    expect(settingsStore(context(settings))?.read(SECTION)).toEqual({ listMode: 'compact' })
  })

  it('has no address for a context that came from no profile row', () => {
    // Without a row id there is nothing to write to, and saying so beats
    // writing a namespace the 0.2.x service has never heard of.
    const settings = modernSettingsService()
    const ctx = { get: () => settings, fiber: {} } as unknown as Context
    expect(settingsStore(ctx)).toBeUndefined()
  })
})

describe('the two faces of one field', () => {
  /** Whether a schema node carries the 0.2.x "you may write this" mark. */
  const marked = (field: unknown): boolean =>
    (field as { meta?: { volatile?: boolean } }).meta?.volatile === true

  /** One field out of an object schema, by name. */
  const field = (schema: unknown, name: string): unknown =>
    (schema as { dict?: Record<string, unknown> }).dict?.[name]

  it('marks the config row live', () => {
    // Without this mark 0.2.x refuses the write outright, and the panel is back
    // to "the toggle does nothing".
    expect(marked(field(Config, 'listMode'))).toBe(true)
    expect(marked(field(Config, 'baseUrl'))).toBe(true)
  })

  it('leaves the namespace schemas exactly as 0.1.x knew them', () => {
    // 0.1.x is told these same fields are a *namespace* schema; marking them
    // live on the way there would be a change to the line that never broke.
    expect(marked(field(UiPrefsSchema, 'listMode'))).toBe(false)
    expect(marked(field(WebdavSettingsSchema, 'baseUrl'))).toBe(false)
    expect(marked(UI_FIELDS.listMode)).toBe(false)
    expect(marked(WEBDAV_FIELDS.baseUrl)).toBe(false)
  })

  it('is a no-op on a runtime whose schemastery never heard of volatile()', () => {
    const plain = { meta: {} }
    expect(markLive(plain)).toBe(plain)
    const field = z.string()
    expect(markLive(field)).not.toBe(field)
    expect(marked(field)).toBe(false)
  })
})

describe('reading a section', () => {
  it('hands back only the fields that section owns', () => {
    const settings = modernSettingsService({ listMode: 'compact', baseUrl: 'https://dav.example' })
    const store = settingsStore(context(settings))!

    expect(store.read(UI_SECTION)).toEqual({ listMode: 'compact' })
    expect(store.read(WEBDAV_SECTION)).toMatchObject({ baseUrl: 'https://dav.example' })
    expect(store.read(WEBDAV_SECTION)).not.toHaveProperty('listMode')
  })

  it('falls back to nothing when the service cannot report at all', () => {
    // `describe()` reads the profile from disk; a broken profile must not take
    // the panel's own preferences down with it.
    const settings = {
      describe: () => {
        throw new Error('profile is unreadable')
      },
      update: async () => undefined,
    }
    expect(settingsStore(context(settings))!.read(SECTION)).toBeUndefined()
  })
})

describe('writing a section', () => {
  it('addresses a namespace through the 0.1.x door', async () => {
    const settings = legacySettingsService()
    const store = settingsStore(context(settings))!

    expect(await store.write(SECTION, { listMode: 'compact' })).toEqual({ ok: true })
    expect(settings.update).toHaveBeenCalledWith('dsh-inbox-ui', { listMode: 'compact' })
    expect(settings.current().listMode).toBe('compact')
  })

  it('addresses the plugin row through the 0.2.x door', async () => {
    const settings = modernSettingsService()
    const store = settingsStore(context(settings))!

    expect(await store.write(SECTION, { listMode: 'compact' })).toEqual({ ok: true })
    expect(settings.update).toHaveBeenCalledWith('dsh-inbox', { listMode: 'compact' })
    expect(settings.current().listMode).toBe('compact')
  })

  it('answers a refusal instead of leaving a rejected promise behind', async () => {
    // The desktop crash, in one test: this rejection had no awaiter, and node
    // (with dsh's own handler) took the host down over it.
    const settings = modernSettingsService()
    settings.update.mockRejectedValueOnce(new Error('No configurable plugin entry "dsh-inbox-ui"'))

    const written = await settingsStore(context(settings))!.write(SECTION, { listMode: 'compact' })
    expect(written.ok).toBe(false)
    expect(written.ok === false && written.reason).toContain('No configurable plugin entry')
  })

  it('answers a synchronous refusal too', async () => {
    const settings = legacySettingsService()
    settings.update.mockImplementationOnce(() => {
      throw new Error('no user layer to write into')
    })

    const written = await settingsStore(context(settings))!.write(SECTION, { listMode: 'compact' })
    expect(written.ok).toBe(false)
  })
})
