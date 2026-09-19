/**
 * The `/inbox` command: file what the user just typed or attached, without
 * turning it into a model message.
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only import: it also brings in the package's `Context.commands`
// augmentation, which is why the call below typechecks at all.
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'

import { capture, type CapturedAttachment } from './capture.js'
import type { Vault } from './vault/vault.js'

/** One-line result text for the composer. */
function describe(summary: { stored: number; merged: number }): string {
  const parts: string[] = []
  if (summary.stored > 0) parts.push(`已存入 ${summary.stored} 条`)
  if (summary.merged > 0) parts.push(`合并 ${summary.merged} 条重复项`)
  return parts.join('，')
}

/** The command wire carries durable blocks; the vault stores plain metadata. */
function toCaptured(block: CommandInvocation['attachments'][number]): CapturedAttachment {
  if (block.type === 'image') {
    const { attachmentId, mediaType, bytes, width, height, name } = block.attachment
    return {
      id: attachmentId,
      mime: mediaType,
      bytes,
      width,
      height,
      ...(name === undefined ? {} : { filename: name }),
    }
  }
  const { attachmentId, name, bytes } = block.attachment
  return { id: attachmentId, mime: 'application/octet-stream', bytes, filename: name }
}

/**
 * Register `/inbox` against the interactive command surface.
 *
 * `recordInput: false` is load-bearing, not tidiness: by default a command's
 * raw input is written to the session log, and the vault is exactly where
 * credentials are supposed to go — the payload must live in the vault and
 * nowhere else (see the credentials rule in AGENTS.md).
 *
 * @param ctx - host context; the commands service must be mounted.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export function registerInboxCommand(ctx: Context, vault: () => Vault | undefined): void {
  ctx.commands.register({
    name: 'inbox',
    description: '收进仓库：把这段文字、链接或附件存进 dsh-inbox，不发给模型',
    input: { hint: '<文字 / 链接；图片可直接拖进输入框>', attachments: true },
    recordInput: false,
    async handler(invocation: CommandInvocation) {
      const open = vault()
      if (open === undefined) {
        return { kind: 'error', text: 'dsh-inbox 仓库还没打开（或打开失败），稍后再试' }
      }

      const summary = await capture(
        open,
        { text: invocation.rawInput, attachments: invocation.attachments.map(toCaptured) },
        'chat',
      )

      if (summary.stored === 0 && summary.merged === 0) {
        return {
          kind: 'error',
          text: '没东西可存：/inbox 后面跟文字或链接，或者把图片拖进输入框',
        }
      }
      return { kind: 'success', text: describe(summary) }
    },
  })
}
