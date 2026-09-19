import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { MILESTONE, PACKAGE_NAME } from '../shared/constants.js'
import { registerInboxCommand } from './command.js'
import { registerInboxRpc } from './rpc.js'
import { registerInboxTools } from './tools.js'
import { Vault } from './vault/vault.js'
import { runPull } from './webdav/run.js'

/** Stable Cordis plugin name for the host half. */
export const name = 'dsh-inbox'

/** Tool registry, command surface, and the storage domain form we persist through. */
export const inject = ['tools', 'commands', 'storageDomain']

/**
 * Open the vault and publish the tool.
 *
 * Opening a domain is asynchronous while `apply` is not, so the handle arrives
 * through an effect: the tool reads whatever is open at call time, and reports
 * the failure instead of pretending the vault is empty when it is not.
 *
 * @param ctx - host plugin context carrying the tool registry and storage.
 */
export function apply(ctx: Context): void {
  let vault: Vault | undefined
  let openError: string | undefined

  ctx.effect(() => {
    let cancelled = false
    const opening = Vault.open(ctx).then(
      (opened) => {
        if (cancelled) {
          void opened.close()
          return
        }
        vault = opened
        // One pull per start, in the background: whatever the phone dropped
        // should be waiting by the time the panel opens, and a broken WebDAV
        // server must never delay or fail the boot.
        ctx.inject(['attachments'], (scoped) => {
          void runPull(scoped, opened, scoped.attachments).catch(() => undefined)
        })
      },
      (error: unknown) => {
        openError = error instanceof Error ? error.message : String(error)
      },
    )

    return async () => {
      cancelled = true
      await opening
      const opened = vault
      vault = undefined
      await opened?.close()
    }
  }, 'dsh-inbox: vault')

  registerInboxCommand(ctx, () => vault)
  registerInboxRpc(ctx, () => vault)
  registerInboxTools(ctx, () => vault)

  ctx.tools.register(
    defineTool({
      name: 'inbox_status',
      description:
        'Report whether the dsh-inbox vault is loaded, how many records it holds and whether it ' +
        'opened cleanly. Takes no arguments.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            package: { type: 'string', required: true },
            milestone: { type: 'string', required: true },
            vaultOpen: { type: 'boolean', required: true },
            items: { type: 'number', required: true },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: value.vaultOpen
              ? `dsh-inbox (${value.milestone}): vault open, ${value.items} record(s).`
              : `dsh-inbox (${value.milestone}): vault NOT open${value.error ? ` — ${value.error}` : ''}.`,
          },
        ],
      },
      async execute() {
        const open = vault
        return {
          ok: true,
          package: PACKAGE_NAME,
          milestone: MILESTONE,
          vaultOpen: open !== undefined,
          items: open?.size ?? 0,
          ...(openError === undefined ? {} : { error: openError }),
        }
      },
    }),
  )
}
