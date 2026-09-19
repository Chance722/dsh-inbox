/**
 * The `/inbox` command's behaviour, driven through its real handler definition
 * against a real vault.
 *
 * The full trip (typing `/inbox …` in the web composer) also needs a live
 * session and a workspace, which a unit test cannot fabricate; what this covers
 * is everything on our side of the command boundary.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition, CommandInvocation } from '@deepseek-ai/dsh-commands'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { registerInboxCommand } from '../src/host/command.js'
import { Vault } from '../src/host/vault/vault.js'

let root: string
let ctx: Context
let vault: Vault | undefined
let definition: CommandDefinition

/** Capture the definition the plugin registers, without a command registry. */
function register(): void {
  const fake = {
    commands: {
      register: (candidate: CommandDefinition) => {
        definition = candidate
        return () => {}
      },
    },
  } as unknown as Context
  registerInboxCommand(fake, () => vault)
}

function invoke(rawInput: string, attachments: CommandInvocation['attachments'] = []) {
  return definition.handler({
    commandId: 'c1',
    agent: {},
    rawInput,
    attachments,
    signal: new AbortController().signal,
  } as unknown as CommandInvocation)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-command-'))
  ctx = new CordisContext()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  vault = await Vault.open(ctx)
  register()
})

afterEach(async () => {
  await vault?.close()
  vault = undefined
  await rm(root, { recursive: true, force: true })
})

describe('/inbox command', () => {
  it('declares itself, accepts attachments, and keeps its input out of the session log', () => {
    expect(definition.name).toBe('inbox')
    expect(definition.recordInput).toBe(false)
    expect(definition.input?.attachments).toBe(true)
  })

  it('files the text after the command name, ignoring separator whitespace', async () => {
    const result = await invoke('   记得给 dsh-inbox 写文档')
    expect(result).toEqual({ kind: 'success', text: '已存入 1 条' })
    expect(vault?.list()[0]?.text).toBe('记得给 dsh-inbox 写文档')
  })

  it('files a link and reports it as one record', async () => {
    const result = await invoke('https://mp.weixin.qq.com/s/abc')
    expect(result.kind).toBe('success')
    expect(vault?.list()[0]).toMatchObject({ kind: 'link', platform: 'wechat' })
  })

  it('files a composer image alongside the text', async () => {
    // The wire shape carries a branded AttachmentId; the test builds the block
    // literally, so it asserts the shape once rather than importing the brand.
    const image = {
      type: 'image',
      attachment: {
        attachmentId: 'att-9',
        mediaType: 'image/jpeg',
        bytes: 4096,
        width: 1200,
        height: 800,
        name: 'id.jpg',
      },
    } as unknown as CommandInvocation['attachments'][number]

    const result = await invoke('这张是身份证照', [image])

    expect(result).toEqual({ kind: 'success', text: '已存入 2 条' })
    expect(vault?.size).toBe(2)
    expect(vault?.findAttachmentByStoreId('att-9')?.filename).toBe('id.jpg')
  })

  it('merges a repeated submission instead of double-storing it', async () => {
    await invoke('https://zhuanlan.zhihu.com/p/1')
    const again = await invoke('https://zhuanlan.zhihu.com/p/1?utm_source=x')
    expect(again).toEqual({ kind: 'success', text: '合并 1 条重复项' })
    expect(vault?.size).toBe(1)
  })

  it('refuses an empty submission', async () => {
    const result = await invoke('   ')
    expect(result.kind).toBe('error')
    expect(vault?.size).toBe(0)
  })

  it('explains itself when the vault never opened', async () => {
    await vault?.close()
    vault = undefined
    const result = await invoke('anything')
    expect(result).toEqual({
      kind: 'error',
      text: 'dsh-inbox 仓库还没打开（或打开失败），稍后再试',
    })
  })
})
