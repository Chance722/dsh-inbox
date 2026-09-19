/**
 * The model-facing tools, driven through their registered definitions against a
 * real vault.
 *
 * Two properties matter more than formatting and are asserted directly:
 * credentials never come back in clear text, and image bytes never enter the
 * result — only a marker the UI resolves locally.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureText } from '../src/host/capture.js'
import type { Source } from '../src/shared/vocabulary.js'
import { SEARCH_PAGE, TEXT_BUDGET, registerInboxTools } from '../src/host/tools.js'
import { Vault } from '../src/host/vault/vault.js'

/**
 * This suite cares about the record each paste produced, so it files text
 * directly rather than going through the multi-attachment summary.
 */
const capture = (target: Vault, payload: { text: string }, source: Source) =>
  captureText(target, payload.text, source)

/** A registered tool definition, as much of it as these tests touch. */
interface RegisteredTool {
  name: string
  execute: (args: Record<string, unknown>, exec?: unknown) => Promise<string>
}

let root: string
let ctx: Context
let vault: Vault | undefined
let tools: Map<string, RegisteredTool>

/** Capture the definitions the plugin registers, without a tool registry. */
function mount(): void {
  const fake = {
    tools: {
      register: (definition: RegisteredTool) => {
        tools.set(definition.name, definition)
      },
    },
  } as unknown as Context
  registerInboxTools(fake, () => vault)
}

function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const tool = tools.get(name)
  if (tool === undefined) throw new Error(`tool ${name} was not registered`)
  return tool.execute(args)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-tools-'))
  ctx = new CordisContext()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  vault = await Vault.open(ctx)
  tools = new Map()
  mount()
})

afterEach(async () => {
  await vault?.close()
  vault = undefined
  await rm(root, { recursive: true, force: true })
})

describe('inbox_search', () => {
  it('lists what was stored, newest first, with ids the model can reuse', async () => {
    await capture(vault!, { text: '一段灵感' }, 'panel')
    const link = await capture(vault!, { text: 'https://mp.weixin.qq.com/s/abc' }, 'panel')

    const answer = await call('inbox_search')
    expect(answer).toContain('匹配 2 条')
    expect(answer).toContain('一段灵感')
    expect(answer).toContain('wechat')
    expect(answer).toContain(link.item.id)
  })

  it('filters by status, category and free text', async () => {
    const first = await capture(vault!, { text: '第一条' }, 'panel')
    await capture(vault!, { text: '第二条' }, 'panel')
    await vault!.patch(first.item.id, { status: 'read', category: 'idea' })

    expect(await call('inbox_search', { status: 'unread' })).toContain('第二条')
    expect(await call('inbox_search', { status: 'unread' })).not.toContain('第一条')
    expect(await call('inbox_search', { category: 'idea' })).toContain('第一条')
    expect(await call('inbox_search', { text: '第二条' })).toContain('匹配 1 条')
  })

  it('says so plainly when nothing matches', async () => {
    expect(await call('inbox_search', { text: '根本不存在' })).toContain('没有匹配的记录')
  })

  it('caps the page and says how many are left', async () => {
    for (let index = 0; index < SEARCH_PAGE + 3; index += 1) {
      await capture(vault!, { text: `第 ${String(index)} 条` }, 'panel')
    }
    const answer = await call('inbox_search')
    expect(answer).toContain(`匹配 ${String(SEARCH_PAGE + 3)} 条`)
    expect(answer).toContain(`还有 3 条没列出来`)
  })

  it('lists a secret record but never its text', async () => {
    await capture(vault!, { text: 'secretid=AKIDexample secretkey=abcdef' }, 'panel')
    const record = vault!.list({ kinds: ['text'] })[0]
    await vault!.patch(record!.id, { category: 'secret', note: '腾讯云测试环境' })

    const answer = await call('inbox_search')
    expect(answer).toContain('腾讯云测试环境')
    expect(answer).not.toContain('AKIDexample')
  })

  it('explains itself while the vault is closed', async () => {
    await vault?.close()
    vault = undefined
    expect(await call('inbox_search')).toContain('仓库没有打开')
  })
})

describe('inbox_get', () => {
  it('returns the text, link, note and tags of one record', async () => {
    const filed = await capture(vault!, { text: 'https://zhuanlan.zhihu.com/p/1' }, 'panel')
    await vault!.patch(filed.item.id, {
      category: 'article',
      note: '缓存那篇',
      tags: ['缓存', '待看'],
      title: '知乎专栏',
    })

    const answer = await call('inbox_get', { id: filed.item.id })
    expect(answer).toContain('知乎专栏')
    expect(answer).toContain('https://zhuanlan.zhihu.com/p/1')
    expect(answer).toContain('缓存那篇')
    expect(answer).toContain('#缓存')
  })

  it('truncates long text at the budget and says how much is left', async () => {
    const long = 'x'.repeat(TEXT_BUDGET + 500)
    const filed = await capture(vault!, { text: long }, 'panel')

    const answer = await call('inbox_get', { id: filed.item.id })
    expect(answer).toContain(`共 ${String(long.length)} 字`)
    expect(answer).not.toContain('x'.repeat(TEXT_BUDGET + 1))
  })

  it('refuses to read a credential out loud', async () => {
    const filed = await capture(vault!, { text: 'password=hunter2' }, 'panel')
    await vault!.patch(filed.item.id, { category: 'secret' })

    const answer = await call('inbox_get', { id: filed.item.id })
    expect(answer).toContain('明文不会通过对话输出')
    expect(answer).not.toContain('hunter2')
  })

  it('describes an image and hands out a marker instead of bytes', async () => {
    await vault!.addAttachment({
      storeId: 'sha256:abc',
      mime: 'image/png',
      bytes: 5825,
      width: 800,
      height: 600,
      filename: 'shot.png',
    })
    const attachmentId = vault!.findAttachmentByStoreId('sha256:abc')?.id ?? ''
    const filed = await vault!.create({
      kind: 'image',
      category: 'document',
      source: 'chat',
      attachmentIds: [attachmentId],
    })

    const answer = await call('inbox_get', { id: filed.id })
    expect(answer).toContain('shot.png')
    expect(answer).toContain('800×600')
    expect(answer).toContain(`[attachment:${attachmentId}]`)
    expect(answer).toContain('证件类')
  })

  it('says when the id is unknown', async () => {
    expect(await call('inbox_get', { id: 'nope' })).toContain('没找到')
  })
})
