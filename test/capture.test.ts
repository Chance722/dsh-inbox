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

  it('files text and links as unread records', async () => {
    const text = await captureText(vault, '记得给 dsh-inbox 写文档', 'panel')
    expect(text.item.kind).toBe('text')
    expect(text.item.status).toBe('unread')
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
    expect(first.item.attachmentIds).toEqual(['att-1'])
    expect(vault.getAttachment('att-1')?.width).toBe(800)

    const second = await captureImage(vault, ref, 'panel')
    expect(second.merged).toBe(true)
    expect(vault.size).toBe(1)
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

    expect(summary).toEqual({ stored: 2, merged: 0 })
    expect(vault.list().map((item) => item.kind).sort()).toEqual(['image', 'link'])
  })

  it('reports an empty submission as nothing to store', async () => {
    expect(await capture(vault, { text: '   ' }, 'chat')).toEqual({ stored: 0, merged: 0 })
    expect(await capture(vault, {}, 'chat')).toEqual({ stored: 0, merged: 0 })
  })

  it('merges both halves of a repeated mixed submission', async () => {
    const payload = {
      text: 'https://zhuanlan.zhihu.com/p/2',
      attachments: [{ id: 'att-4', mime: 'image/png', bytes: 100, width: 10, height: 10 }],
    }
    await capture(vault, payload, 'chat')
    expect(await capture(vault, payload, 'panel')).toEqual({ stored: 0, merged: 2 })
    expect(vault.size).toBe(2)
  })
})
