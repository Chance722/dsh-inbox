/**
 * Where the WebDAV settings live, and why they live there.
 *
 * URL, folder and username are *configuration*: they belong in dsh's settings
 * service, so a deployment can ship defaults and a user can change them from a
 * configuration surface. The password is a *secret*: it goes through the
 * credentials service, which keeps values out of configuration files entirely.
 *
 * Both services are optional. Without them the plugin keeps working from its own
 * composed values — a headless profile has no settings provider and must not
 * break — and the panel simply says what is missing.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import type { WebdavSettings, WebdavStatus } from '../../shared/panel-wire.js'
import type { Vault } from '../vault/vault.js'

export type { WebdavSettings, WebdavStatus } from '../../shared/panel-wire.js'

/** Namespace this plugin owns in the settings service. */
export const SETTINGS_NAMESPACE = 'dsh-inbox-webdav'

/** The credential key holding the password. */
export const PASSWORD_KEY = 'DSH_INBOX_WEBDAV_PASSWORD'

/** The composed defaults, so a fresh install has a sane shape. */
export const DEFAULT_SETTINGS: WebdavSettings = {
  baseUrl: '',
  directory: '/inbox',
  username: '',
}

/** The namespace's schema: every field optional, so a partial user layer is valid. */
export const WebdavSettingsSchema = z.object({
  baseUrl: z.string().default(''),
  directory: z.string().default('/inbox'),
  username: z.string().default(''),
})

/** The slice of the settings service this file uses. */
interface SettingsScope {
  get(): WebdavSettings
  update(patch: Partial<WebdavSettings>): void
}

interface SettingsLike {
  register(
    namespace: string,
    schema: unknown,
    options: { base: WebdavSettings },
  ): SettingsScope
  get(namespace: string): WebdavSettings | undefined
}

/** The slice of the credentials service this file uses. */
interface CredentialsLike {
  set(ref: string, value: string): Promise<void>
  resolve(ref: string): Promise<{ value: string } | undefined>
  unset(ref: string): Promise<void>
}

/** Resolve the current settings, falling back to the composed defaults. */
export function readSettings(ctx: Context): WebdavSettings {
  const settings = ctx.get('settings') as SettingsLike | undefined
  if (settings === undefined) return DEFAULT_SETTINGS
  return settings.get(SETTINGS_NAMESPACE) ?? DEFAULT_SETTINGS
}

/** Read the password, or undefined when none is stored. */
export async function readPassword(ctx: Context): Promise<string | undefined> {
  const credentials = ctx.get('credentials') as CredentialsLike | undefined
  if (credentials === undefined) return undefined
  try {
    return (await credentials.resolve(PASSWORD_KEY))?.value
  } catch {
    return undefined
  }
}

/** Everything the panel needs, without ever handing out the password. */
export async function describeWebdav(ctx: Context): Promise<WebdavStatus> {
  const credentials = ctx.get('credentials') as CredentialsLike | undefined
  return {
    settings: readSettings(ctx),
    passwordSet: (await readPassword(ctx)) !== undefined,
    settingsAvailable: ctx.get('settings') !== undefined,
    credentialsAvailable: credentials !== undefined,
  }
}

/** What a save may change. An absent password leaves the stored one alone. */
export interface WebdavPatch {
  baseUrl?: string
  directory?: string
  username?: string
  /** Empty string clears the stored password; undefined leaves it. */
  password?: string
}

/**
 * Persist a configuration change.
 *
 * The password never lands in settings: it is written (or cleared) through the
 * credentials service, and a composition without one refuses the write instead
 * of quietly storing a secret somewhere else.
 *
 * @param ctx - host context.
 * @param vault - the open vault, used for the "settings unavailable" fallback.
 * @param base - composed defaults for the settings base layer.
 * @param patch - what to change.
 * @returns whether the write went through, and why not when it did not.
 */
export async function saveWebdav(
  ctx: Context,
  vault: Vault | undefined,
  base: WebdavSettings,
  patch: WebdavPatch,
): Promise<{ ok: boolean; reason?: string }> {
  const settings = ctx.get('settings') as SettingsLike | undefined
  const credentials = ctx.get('credentials') as CredentialsLike | undefined

  const config: Partial<WebdavSettings> = {}
  if (patch.baseUrl !== undefined) config.baseUrl = patch.baseUrl.trim()
  if (patch.directory !== undefined) {
    const directory = patch.directory.trim()
    config.directory = directory.startsWith('/') ? directory : `/${directory}`
  }
  if (patch.username !== undefined) config.username = patch.username.trim()

  if (Object.keys(config).length > 0) {
    if (settings === undefined) {
      return { ok: false, reason: '这个组合里没有设置服务，改不了地址' }
    }
    // `update()` merges into the *user* layer and persists; the composed base
    // stays the deployment's, which is what makes a shipped default work.
    settings.register(SETTINGS_NAMESPACE, WebdavSettingsSchema, { base }).update(config)
  }

  if (patch.password !== undefined) {
    if (credentials === undefined) {
      return { ok: false, reason: '这个组合里没有凭证服务，密码不知道存哪才安全' }
    }
    if (patch.password.length === 0) await credentials.unset(PASSWORD_KEY)
    else await credentials.set(PASSWORD_KEY, patch.password)
  }

  void vault
  return { ok: true }
}
