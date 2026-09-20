/**
 * The headline behind a link: what may be read out of a page, when the fetch is
 * allowed to happen at all, and what it is allowed to write.
 *
 * The rules under test are the ones that keep this honest: no headline is worth
 * a user's own name, and nothing at all is written when the vault moved on while
 * the request was in flight.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureText } from '../src/host/capture.js'
import {
  MAX_LINK_TITLE_CHARS,
  fetchLinkTitle,
  titleFromHtml,
  type WebFetchSeam,
} from '../src/host/link-title.js'
import { Vault } from '../src/host/vault/vault.js'

describe('titleFromHtml', () => {
  it('reads the headline and collapses it to one line', () => {
    expect(titleFromHtml('<html><head><title>\n  一篇 好文章\n</title>')).toBe('一篇 好文章')
    expect(titleFromHtml('<TITLE>大写标签也算</TITLE>')).toBe('大写标签也算')
  })

  it('decodes the entities a real headline uses', () => {
    expect(titleFromHtml('<title>A &amp; B &#39;quoted&#39; &lt;tag&gt;</title>')).toBe(
      "A & B 'quoted' <tag>",
    )
    expect(titleFromHtml('<title>&#x1F600; 表情</title>')).toBe('😀 表情')
    // An entity we do not know is left exactly as it came.
    expect(titleFromHtml('<title>&weird; 保留</title>')).toBe('&weird; 保留')
  })

  it('says nothing when there is nothing to say', () => {
    expect(titleFromHtml('<html><body>没有标题</body></html>')).toBeUndefined()
    expect(titleFromHtml('<title>   </title>')).toBeUndefined()
  })

  it('caps a runaway headline', () => {
    const long = 'x'.repeat(MAX_LINK_TITLE_CHARS + 50)
    expect(titleFromHtml(`<title>${long}</title>`)).toHaveLength(MAX_LINK_TITLE_CHARS)
  })
})

/**
 * A seam that answers with one canned page, and remembers what it was asked.
 *
 * `whileFetching` runs *inside* the request, which is the only way to reproduce
 * something happening to the record while the fetch is in flight.
 */
function seam(
  answer: { statusCode?: number; kind?: 'html' | 'text'; content?: string } | Error,
  whileFetching?: () => Promise<void>,
): WebFetchSeam & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    async fetch(request) {
      asked.push(request.url)
      await whileFetching?.()
      if (answer instanceof Error) throw answer
      return {
        url: request.url,
        statusCode: answer.statusCode ?? 200,
        body: { kind: answer.kind ?? 'html', content: answer.content ?? '' },
        truncated: false,
      }
    },
  }
}

describe('fetchLinkTitle against a real vault', () => {
  let root: string
  let ctx: Context
  let vault: Vault

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-inbox-title-'))
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

  it('stores the page headline beside the link, never as its name', async () => {
    const filed = await captureText(vault, 'https://mp.weixin.qq.com/s/abc', 'panel')
    const web = seam({ content: '<title>三体读后感</title>' })

    expect(await fetchLinkTitle(vault, filed.item.id, web)).toBe('三体读后感')

    const stored = vault.get(filed.item.id)
    expect(stored?.linkTitle).toBe('三体读后感')
    // `title` stays empty: it is the user's field, and the credentials rule
    // depends on nothing else being able to write it.
    expect(stored?.title).toBeUndefined()
    expect(web.asked).toEqual(['https://mp.weixin.qq.com/s/abc'])
    // A headline is searchable like any other word on the record.
    expect(vault.list({ text: '三体' }).map((item) => item.id)).toEqual([filed.item.id])
  })

  it('keeps the name the user typed', async () => {
    const filed = await captureText(vault, 'https://example.com/a', 'panel')
    await vault.patch(filed.item.id, { title: '我给它起的名字' })
    const web = seam({ content: '<title>页面自己的标题</title>' })

    expect(await fetchLinkTitle(vault, filed.item.id, web)).toBeUndefined()
    // Not even a request: a record that already has a name does not need one.
    expect(web.asked).toEqual([])
    expect(vault.get(filed.item.id)?.linkTitle).toBeUndefined()
    expect(vault.get(filed.item.id)?.title).toBe('我给它起的名字')
  })

  it('writes nothing when the user renamed the record mid-flight', async () => {
    const filed = await captureText(vault, 'https://example.com/b', 'panel')
    const web = seam({ content: '<title>迟到</title>' }, async () => {
      await vault.patch(filed.item.id, { title: '我改过了' })
    })

    expect(await fetchLinkTitle(vault, filed.item.id, web)).toBeUndefined()
    expect(web.asked).toEqual(['https://example.com/b'])
    expect(vault.get(filed.item.id)?.linkTitle).toBeUndefined()
  })

  it('leaves everything alone when the fetch fails or the page is not HTML', async () => {
    const failed = await captureText(vault, 'https://example.com/dead', 'panel')
    expect(
      await fetchLinkTitle(vault, failed.item.id, seam(new Error('ECONNREFUSED'))),
    ).toBeUndefined()
    expect(await fetchLinkTitle(vault, failed.item.id, seam({ statusCode: 404 }))).toBeUndefined()
    expect(
      await fetchLinkTitle(vault, failed.item.id, seam({ kind: 'text', content: 'no html' })),
    ).toBeUndefined()
    expect(
      await fetchLinkTitle(vault, failed.item.id, seam({ content: '<p>没有标题</p>' })),
    ).toBeUndefined()
    expect(vault.get(failed.item.id)?.linkTitle).toBeUndefined()
  })

  it('does not fetch for anything that is not a link', async () => {
    const text = await captureText(vault, '一段随手记', 'panel')
    const web = seam({ content: '<title>不该被请求</title>' })

    expect(await fetchLinkTitle(vault, text.item.id, web)).toBeUndefined()
    expect(web.asked).toEqual([])
  })
})
