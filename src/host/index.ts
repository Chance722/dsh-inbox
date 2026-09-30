import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { PACKAGE_NAME, VERSION } from '../shared/constants.js'
import { registerInboxCommand } from './command.js'
import { registerInboxRpc } from './rpc.js'
import { markLive } from './settings.js'
import { registerInboxTools } from './tools.js'
import { installUiSettings, UI_FIELDS } from './ui/config.js'
import { leaseVault } from './vault/lease.js'
import { Vault } from './vault/vault.js'
import { runPull } from './webdav/run.js'
import { installWebdavSettings, WEBDAV_FIELDS } from './webdav/config.js'

/** Stable Cordis plugin name for the host half. */
export const name = 'dsh-inbox'

/** Tool registry, command surface, and the storage domain form we persist through. */
export const inject = ['tools', 'commands', 'storageDomain']

/**
 * What a profile may configure on our row.
 *
 * Both halves of this are settings the user changes *in the panel* — the list
 * density it opens with, and where the sync endpoint lives — so this schema is
 * not decoration: on dsh 0.2.x it is the only thing that makes those fields
 * writable at all. That service keeps no namespaces, so a setting's address is
 * the profile row of the plugin (`dsh-inbox`, see `cordis.patch.yml`), and it
 * refuses to write a field the plugin's own `Config` has not marked live
 * (`volatile()`), which `markLive` does and 0.1.x's schemastery simply ignores.
 */
export const Config = z.object({
  ...liveFields(UI_FIELDS),
  ...liveFields(WEBDAV_FIELDS),
})

/** The same fields, marked live where the runtime knows that question. */
function liveFields<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, markLive(field)]),
  ) as T
}

/**
 * Claim the vault and publish the tools.
 *
 * Loading is asynchronous while `apply` is not, so the handle arrives later:
 * every caller reads whatever is open at call time, and reports the failure
 * instead of pretending the vault is empty when it is not.
 *
 * The claim goes through `./vault/lease.js` because dsh loads this plugin twice
 * in one process (profile bundle + agent preset) while the storage domain
 * allows a single open per name — the second instance used to fail with
 * `domain 'dsh_inbox' is already open` and every tool it published answered
 * 「仓库没有打开」. The first instance owns the vault; the rest borrow it.
 *
 * @param ctx - host plugin context carrying the tool registry and storage.
 */
export function apply(ctx: Context): void {
  // Declare the configuration namespace before anything reads it — and *after*
  // the settings service exists. Registering eagerly at load looked right and
  // silently did nothing: the service is not live yet, `ctx.get('settings')`
  // answered undefined, and every read afterwards saw the defaults instead of
  // the user's stored values.
  ctx.inject(['settings'], (withSettings) => {
    installWebdavSettings(withSettings)
    installUiSettings(withSettings)
  })
  const lease = leaseVault(ctx, (opened) => {
    // One pull per start, in the background: whatever the phone dropped should
    // be waiting by the time the panel opens, and a broken WebDAV server must
    // never delay or fail the boot.
    ctx.inject(['attachments'], (scoped) => {
      void runPull(scoped, opened, scoped.attachments).catch(() => undefined)
    })
  })
  ctx.effect(() => () => lease.release(), 'dsh-inbox: vault')
  /** What the tools, the command and the panel all read at call time. */
  const openVault = (): Vault | undefined => lease.current()

  registerInboxCommand(ctx, openVault)
  registerInboxRpc(ctx, openVault)
  registerInboxTools(ctx, openVault)

  ctx.tools.register(
    defineTool({
      name: 'inbox_status',
      description:
        "Report whether the dsh-inbox (the user's 收件箱 / 仓库 / inbox) is loaded, how many records it " +
        'holds and whether it opened cleanly. Takes no arguments.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            package: { type: 'string', required: true },
            version: { type: 'string', required: true },
            vaultOpen: { type: 'boolean', required: true },
            items: { type: 'number', required: true },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: value.vaultOpen
              ? `dsh-inbox v${value.version}: vault open, ${value.items} record(s).`
              : `dsh-inbox v${value.version}: vault NOT open${value.error ? ` — ${value.error}` : ''}.`,
          },
        ],
      },
      async execute() {
        const open = openVault()
        const openError = lease.failure()
        return {
          ok: true,
          package: PACKAGE_NAME,
          version: VERSION,
          vaultOpen: open !== undefined,
          items: open?.size ?? 0,
          ...(openError === undefined ? {} : { error: openError }),
        }
      },
    }),
  )
}
