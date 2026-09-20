/**
 * Capture rules, both pure and against a real vault: what a pasted string is,
 * how repeats are recognised, and what merging preserves.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  capture,
  captureImage,
  captureText,
  normalizeLink,
  platformOf,
  sniff,
} from '../src/host/capture.js'
import { Vault } from '../src/host/vault/vault.js'

describe('sniff', () => {
  it('treats a bare http(s) url as a link', () => {
    expect(sniff('https://www.bilibili.com/video/BV1xx')).toEqual({
      kind: 'link',
      url: 'https://www.bilibili.com/video/BV1xx',
      platform: 'bilibili',
    })
  })

  it('keeps prose containing a url as text', () => {
    expect(sniff('看这个 https://example.com 挺有意思').kind).toBe('text')
  })

  it('ignores surrounding whitespace but not inner whitespace', () => {
    expect(sniff('  https://example.com/a  ').kind).toBe('link')
    expect(sniff('https://example.com/a b').kind).toBe('text')
  })

  it('refuses non-http schemes and empty input', () => {
    expect(sniff('ftp://example.com/a').kind).toBe('text')
    expect(sniff('   ').kind).toBe('text')
  })
})

describe('platformOf', () => {
  it('matches hosts and their subdomains', () => {
    expect(platformOf('https://b23.tv/abc')).toBe('bilibili')
    expect(platformOf('https://space.bilibili.com/1')).toBe('bilibili')
    expect(platformOf('https://mp.weixin.qq.com/s/abc')).toBe('wechat')
    expect(platformOf('https://zhuanlan.zhihu.com/p/1')).toBe('zhihu')
  })

  it('returns undefined for unknown hosts and unparseable values', () => {
    expect(platformOf('https://example.com/a')).toBeUndefined()
    expect(platformOf('not a url')).toBeUndefined()
  })
})

describe('normalizeLink', () => {
  it('drops tracking parameters, the fragment and the trailing slash', () => {
    expect(
      normalizeLink('https://www.bilibili.com/video/BV1xx/?spm_id_from=333.999&vd_source=abc#reply'),
    ).toBe('https://bilibili.com/video/BV1xx')
  })

  it('keeps parameters that carry identity', () => {
    expect(normalizeLink('https://example.com/p?id=42')).toBe('https://example.com/p?id=42')
  })

  it('unifies www and host case', () => {
    expect(normalizeLink('https://WWW.Example.com/A')).toBe('https://example.com/A')
  })
})

describe('capture against a real vault', () => {
  let root: string
  let ctx: Context
  let vault: Vault

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-inbox-capture-'))
    ctx = new Context()
    await ctx.plugin(Storage).await()
    await ctx.plugin(storageJson, { root }).await()
    await ctx.plugin(storageDomain, { backend: 'json' }).await()
    vault = await Vault.open(ctx)
  })

  afterEach(async () => {
    await vault.close()
    await rm(root, { recursive: true, force: true })
  })

  it('files text and links as records, unflagged', async () => {
    const text = await captureText(vault, '记得给 dsh-inbox 写文档', 'panel')
    expect(text.item.kind).toBe('text')
    // Nothing is flagged 待看 on the way in any more — that flag is the user's.
    expect(text.item.watchLater).toBeUndefined()
    expect(text.merged).toBe(false)

    const link = await captureText(vault, 'https://mp.weixin.qq.com/s/abc', 'chat')
    expect(link.item).toMatchObject({ kind: 'link', platform: 'wechat' })
    expect(vault.size).toBe(2)
  })

  it('merges a repeat link even when the share parameters differ', async () => {
    const first = await captureText(vault, 'https://www.bilibili.com/video/BV1xx', 'panel')
    const second = await captureText(
      vault,
      'https://bilibili.com/video/BV1xx/?spm_id_from=333.999',
      'chat',
    )

    expect(second.merged).toBe(true)
    expect(second.item.id).toBe(first.item.id)
    expect(vault.size).toBe(1)
  })

  it('merges a repeat text and keeps the first note', async () => {
    const first = await captureText(vault, '一段灵感', 'panel')
    const second = await captureText(vault, '一段灵感', 'chat', '模型猜的描述')

    expect(second.merged).toBe(true)
    expect(second.item.note).toBe('模型猜的描述')

    const third = await captureText(vault, '一段灵感', 'chat', '用户后写的描述')
    expect(third.item.note).toBe('模型猜的描述')
    expect(third.item.id).toBe(first.item.id)
  })

  it('files an image by its attachment reference and merges the same id', async () => {
    const ref = { id: 'att-1', mime: 'image/png', bytes: 2048, width: 800, height: 600 }
    const first = await captureImage(vault, ref, 'chat')
    expect(first.item.kind).toBe('image')
    const attachmentId = first.item.attachmentIds[0] ?? ''
    expect(vault.getAttachment(attachmentId)?.width).toBe(800)
    expect(vault.findAttachmentByStoreId('att-1')?.id).toBe(attachmentId)

    const second = await captureImage(vault, ref, 'panel')
    expect(second.merged).toBe(true)
    expect(vault.size).toBe(1)
  })

  it('keeps a non-path-safe store id out of the record key', async () => {
    // dsh's own attachment ids look like `sha256:<hex>`; a colon cannot be a
    // per-record key, which is why the index row carries a generated id.
    const storeId = 'sha256:fd1842488dfd70ca985ad3d6d7d9193d320d34ef416818c068f81b134a14a4b5'
    const outcome = await captureImage(
      vault,
      { id: storeId, mime: 'image/png', bytes: 5825, width: 800, height: 600 },
      'chat',
    )

    const attachmentId = outcome.item.attachmentIds[0] ?? ''
    expect(attachmentId).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(vault.getAttachment(attachmentId)?.storeId).toBe(storeId)
    expect(vault.findAttachmentByStoreId(storeId)?.mime).toBe('image/png')
  })

  it('calls a non-image attachment a file', async () => {
    const outcome = await captureImage(
      vault,
      { id: 'att-2', mime: 'application/pdf', bytes: 10, filename: 'a.pdf' },
      'chat',
    )
    expect(outcome.item.kind).toBe('file')
  })

  it('files a mixed submission (image + text) in one call', async () => {
    const summary = await capture(
      vault,
      {
        text: 'https://zhuanlan.zhihu.com/p/1',
        attachments: [{ id: 'att-3', mime: 'image/png', bytes: 100, width: 10, height: 10 }],
      },
      'chat',
    )

    expect(summary).toEqual({ stored: 2, merged: 0, restored: 0 })
    expect(vault.list().map((item) => item.kind).sort()).toEqual(['image', 'link'])
  })

  it('reports an empty submission as nothing to store', async () => {
    expect(await capture(vault, { text: '   ' }, 'chat')).toEqual({
      stored: 0,
      merged: 0,
      restored: 0,
    })
    expect(await capture(vault, {}, 'chat')).toEqual({ stored: 0, merged: 0, restored: 0 })
  })

  it('merges both halves of a repeated mixed submission', async () => {
    const payload = {
      text: 'https://zhuanlan.zhihu.com/p/2',
      attachments: [{ id: 'att-4', mime: 'image/png', bytes: 100, width: 10, height: 10 }],
    }
    await capture(vault, payload, 'chat')
    expect(await capture(vault, payload, 'panel')).toEqual({ stored: 0, merged: 2, restored: 0 })
    expect(vault.size).toBe(2)
  })

  it('gives a repeat paste a second chance at a name, and only once', async () => {
    // A link filed before headlines were fetched has no name but its URL;
    // handing it over again is the only way to ask for one.
    const asked: string[] = []
    const ctx = {
      get: (name: string) =>
        name === 'web'
          ? {
              async fetch(request: { url: string }) {
                asked.push(request.url)
                return {
                  url: request.url,
                  statusCode: 200,
                  body: { kind: 'html' as const, content: '<title>示例页</title>' },
                  truncated: false,
                }
              },
            }
          : undefined,
    } as unknown as Context

    await captureText(vault, 'https://example.com/a', 'panel')
    const repeat = await capture(vault, { text: 'https://example.com/a' }, 'panel', { ctx })

    expect(repeat).toEqual({ stored: 0, merged: 1, restored: 0 })
    expect(asked).toEqual(['https://example.com/a'])
    // The fetch is deliberately not awaited by `capture()`: poll for its write.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (vault.list({ kinds: ['link'] })[0]?.linkTitle !== undefined) break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    expect(vault.list({ kinds: ['link'] })[0]?.linkTitle).toBe('示例页')

    // Named now, so the next repeat costs nothing at all.
    await capture(vault, { text: 'https://example.com/a' }, 'panel', { ctx })
    expect(asked).toEqual(['https://example.com/a'])
  })

  describe('re-capturing something that is in the recycle bin', () => {
    it('takes the record back out instead of leaving it invisible', async () => {
      const first = await captureText(vault, '一段灵感', 'panel', '写给自己的描述')
      await vault.setWatchLater(first.item.id)
      await vault.softDelete(first.item.id)
      expect(vault.list()).toHaveLength(0)

      const again = await captureText(vault, '一段灵感', 'panel')

      expect(again.merged).toBe(true)
      expect(again.restored).toBe(true)
      // The same record, with everything the user had put on it still there.
      expect(again.item.id).toBe(first.item.id)
      expect(again.item.createdAt).toBe(first.item.createdAt)
      expect(again.item.note).toBe('写给自己的描述')
      expect(again.item.watchLater).toBe(true)
      expect(again.item.deletedAt).toBeUndefined()
      expect(vault.getBin()).toHaveLength(0)
      expect(vault.list()).toHaveLength(1)
    })

    it('does the same for an image, whose dedupe key is the attachment', async () => {
      const ref = { id: 'att-bin', mime: 'image/png', bytes: 2048, width: 800, height: 600 }
      const first = await captureImage(vault, ref, 'chat')
      await vault.softDelete(first.item.id)

      const again = await captureImage(vault, ref, 'panel')

      expect(again.restored).toBe(true)
      expect(again.item.id).toBe(first.item.id)
      expect(again.item.deletedAt).toBeUndefined()
      // No second attachment row either — the original reference is still good.
      expect(vault.size).toBe(1)
    })

    it('leaves a record that was never deleted alone', async () => {
      const first = await captureText(vault, '一段灵感', 'panel')
      const again = await captureText(vault, '一段灵感', 'panel')
      expect(again.merged).toBe(true)
      expect(again.restored).toBe(false)
      expect(again.item.id).toBe(first.item.id)
    })

    it('counts the rescue in the submission summary', async () => {
      const filed = await captureText(vault, '一段灵感', 'panel')
      await vault.softDelete(filed.item.id)

      const summary = await capture(vault, { text: '一段灵感' }, 'panel')

      // One merged record, and that one is the rescued one: the panel says
      // 「从回收站取回 1 条」 and never also 「合并 1 条重复项」.
      expect(summary).toEqual({ stored: 0, merged: 1, restored: 1 })
    })
  })
})
