import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { MILESTONE, PACKAGE_NAME } from '../shared/constants.js'

/** Stable Cordis plugin name for the host half. */
export const name = 'dsh-inbox'

/** The host half only talks to the tool registry in M0. */
export const inject = ['tools']

/**
 * Register the M0 probe tool.
 *
 * The tool exists to answer one question: can a third-party package put a tool
 * in front of the model at all? It deliberately touches no vault state, because
 * the storage layer arrives with M1.
 *
 * @param ctx - host plugin context carrying the tool registry.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(
    defineTool({
      name: 'inbox_status',
      description:
        'Report whether the dsh-inbox vault plugin is loaded and which milestone it is at. ' +
        'Takes no arguments and reads nothing from the vault.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            package: { type: 'string', required: true },
            milestone: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `dsh-inbox (${value.milestone}) loaded: ${value.ok}` },
        ],
      },
      async execute() {
        return { ok: true, package: PACKAGE_NAME, milestone: MILESTONE }
      },
    }),
  )
}
