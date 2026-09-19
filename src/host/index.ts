import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { MILESTONE, PACKAGE_NAME } from '../shared/constants.js'
import { Vault } from './vault/vault.js'

/** Stable Cordis plugin name for the host half. */
export const name = 'dsh-inbox'

/** The tool registry to publish into; the storage domain form to persist through. */
export const inject = ['tools', 'storageDomain']

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
