/**
 * Where the WebDAV settings go, and what happens when the services that hold
 * them are not mounted.
 *
 * The point of these tests is the seam, not the storage: the password must go
 * through credentials and nothing else, and a composition without settings must
 * degrade to its composed defaults rather than breaking.
 */

import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_SETTINGS,
  PASSWORD_KEY,
  SETTINGS_NAMESPACE,
  describeWebdav,
  readPassword,
  readSettings,
  saveWebdav,
} from '../src/host/webdav/config.js'

/** A settings service that keeps one namespace value in memory. */
function fakeSettings(initial?: Partial<typeof DEFAULT_SETTINGS>) {
  let current = { ...DEFAULT_SETTINGS, ...initial }
  let registered = false
  return {
    current: () => current,
    register: vi.fn((namespace: string, _schema: unknown, options: { base: typeof DEFAULT_SETTINGS }) => {
      // The real service refuses a second registration; the fake has to refuse
      // it too, or this test would have missed the bug it exists for.
      if (registered) throw new Error(`settings namespace "${namespace}" is already registered`)
      registered = true
      current = { ...options.base, ...current }
      return {
        get: () => current,
        update: (patch: Partial<typeof DEFAULT_SETTINGS>) => {
          current = { ...current, ...patch }
        },
      }
    }),
    get: (namespace: string) => (namespace === SETTINGS_NAMESPACE ? current : undefined),
    update: (namespace: string, patch: Partial<typeof DEFAULT_SETTINGS>) => {
      if (namespace !== SETTINGS_NAMESPACE) throw new Error('unknown namespace')
      current = { ...current, ...patch }
    },
  }
}

/** A credentials service that keeps one value. */
function fakeCredentials(initial?: string) {
  let value = initial
  return {
    value: () => value,
    set: vi.fn(async (_ref: string, next: string) => {
      value = next
    }),
    resolve: async (_ref: string) => (value === undefined ? undefined : { value }),
    unset: vi.fn(async (_ref: string) => {
      value = undefined
    }),
  }
}

function context(parts: { settings?: unknown; credentials?: unknown }): Context {
  return {
    get: (name: string) => (parts as Record<string, unknown>)[name],
  } as unknown as Context
}

describe('reading the configuration', () => {
  it('falls back to the composed defaults when no settings service is mounted', () => {
    expect(readSettings(context({}))).toEqual(DEFAULT_SETTINGS)
  })

  it('reads the resolved namespace when one is mounted', () => {
    const settings = fakeSettings({ baseUrl: 'https://data.cstcloud.cn/dav', username: 'me' })
    expect(readSettings(context({ settings }))).toMatchObject({
      baseUrl: 'https://data.cstcloud.cn/dav',
      username: 'me',
      directory: '/inbox',
    })
  })

  it('reports whether a password is stored, without reading it out', async () => {
    const credentials = fakeCredentials('hunter2')
    expect(await readPassword(context({ credentials }))).toBe('hunter2')
    expect(await readPassword(context({}))).toBeUndefined()

    const status = await describeWebdav(context({ credentials, settings: fakeSettings() }))
    expect(status).toMatchObject({
      passwordSet: true,
      credentialsAvailable: true,
      settingsAvailable: true,
    })
    expect(JSON.stringify(status)).not.toContain('hunter2')
  })
})

describe('saving the configuration', () => {
  it('writes the address through settings and the password through credentials', async () => {
    const settings = fakeSettings()
    const credentials = fakeCredentials()
    const ctx = context({ settings, credentials })

    const result = await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, {
      baseUrl: ' https://data.cstcloud.cn/dav ',
      directory: 'inbox',
      username: ' me ',
      password: 'hunter2',
    })

    expect(result.ok).toBe(true)
    expect(settings.current()).toMatchObject({
      baseUrl: 'https://data.cstcloud.cn/dav',
      directory: '/inbox',
      username: 'me',
    })
    expect(credentials.value()).toBe('hunter2')
    expect(credentials.set).toHaveBeenCalledWith(PASSWORD_KEY, 'hunter2')
    // The secret must not be anywhere in the settings layer.
    expect(JSON.stringify(settings.current())).not.toContain('hunter2')
  })

  it('saves more than once in one process', async () => {
    // Regression: registering on every save threw "already registered" on the
    // second one, and the panel could only report an empty body.
    const settings = fakeSettings()
    const ctx = context({ settings, credentials: fakeCredentials() })

    expect((await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { baseUrl: 'https://a' })).ok).toBe(true)
    expect((await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { baseUrl: 'https://b' })).ok).toBe(true)
    expect(settings.current().baseUrl).toBe('https://b')
  })

  it('accepts v4 and v2, and refuses anything else', async () => {
    const settings = fakeSettings()
    const ctx = context({ settings })

    expect((await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { signatureVersion: 'V2' })).ok).toBe(true)
    expect(settings.current().signatureVersion).toBe('v2')
    expect((await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { signatureVersion: 'v4' })).ok).toBe(true)

    const nonsense = await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { signatureVersion: 'v9' })
    expect(nonsense.ok).toBe(false)
    expect(nonsense.reason).toContain('v4 或 v2')
  })

  it('adds https to a bare host, and keeps an explicit scheme', async () => {
    const settings = fakeSettings()
    const ctx = context({ settings })

    await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, {
      endpoint: '  s3.cstcloud.cn  ',
      baseUrl: 'data.cstcloud.cn/dav',
    })
    expect(settings.current()).toMatchObject({
      endpoint: 'https://s3.cstcloud.cn',
      baseUrl: 'https://data.cstcloud.cn/dav',
    })

    await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { endpoint: 'http://192.168.1.9:9000' })
    expect(settings.current().endpoint).toBe('http://192.168.1.9:9000')

    await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { endpoint: '' })
    expect(settings.current().endpoint).toBe('')
  })

  it('clears a stored password on an empty string, and leaves it alone when omitted', async () => {
    const settings = fakeSettings()
    const credentials = fakeCredentials('existing')
    const ctx = context({ settings, credentials })

    await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { username: 'me' })
    expect(credentials.value()).toBe('existing')

    await saveWebdav(ctx, undefined, DEFAULT_SETTINGS, { password: '' })
    expect(credentials.value()).toBeUndefined()
  })

  it('refuses to store a password when there is no credential service', async () => {
    const result = await saveWebdav(
      context({ settings: fakeSettings() }),
      undefined,
      DEFAULT_SETTINGS,
      { password: 'hunter2' },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('凭证服务')
  })

  it('refuses an address change when there is no settings service', async () => {
    const result = await saveWebdav(context({}), undefined, DEFAULT_SETTINGS, {
      baseUrl: 'https://data.cstcloud.cn/dav',
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('设置服务')
  })
})
