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
  looksLikeRefusal,
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

  it('falls back to the social card when the title element is empty', () => {
    // What a JavaScript-rendered news page looks like to a plain GET: an empty
    // <title>, with the real headline in the share metadata.
    const page = '<html><head><title></title><meta property="og:title" content="真正的标题"></head>'
    expect(titleFromHtml(page)).toBe('真正的标题')
    expect(
      titleFromHtml('<title></title><meta name="twitter:title" content="来自 twitter 的标题">'),
    ).toBe('来自 twitter 的标题')
    // Still nothing, and still no exception, when the site is an anti-bot page:
    // WeChat answers anonymous requests with exactly this shape.
    expect(
      titleFromHtml('<html><head><title></title></head><body>环境异常，完成验证后即可继续访问。</body></html>'),
    ).toBeUndefined()
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

  describe('a miss is recorded, not swallowed', () => {
    it('says the page had no title, which is what an anti-bot page looks like', async () => {
      // The reported case: WeChat answers an anonymous GET with HTTP 200, an
      // empty <title> and 「环境异常，完成验证后即可继续访问」.
      const filed = await captureText(vault, 'https://mp.weixin.qq.com/s/abc', 'panel')
      const notes: string[] = []

      expect(
        await fetchLinkTitle(
          vault,
          filed.item.id,
          seam({ content: '<html><head><title></title></head><body>环境异常</body></html>' }),
          (message) => notes.push(message),
        ),
      ).toBeUndefined()

      expect(vault.get(filed.item.id)?.linkTitleError).toBe('no-title')
      expect(vault.get(filed.item.id)?.linkTitle).toBeUndefined()
      expect(notes.join()).toContain('没有 <title>')
      // Only the host is logged: a URL can carry a token in its query string.
      expect(notes.join()).toContain('mp.weixin.qq.com')
      expect(notes.join()).not.toContain('/s/abc')
    })

    it('records an HTTP status, a non-HTML body or a failed request', async () => {
      const filed = await captureText(vault, 'https://example.com/dead', 'panel')

      await fetchLinkTitle(vault, filed.item.id, seam({ statusCode: 404 }))
      expect(vault.get(filed.item.id)?.linkTitleError).toBe('http:404')

      await fetchLinkTitle(vault, filed.item.id, seam({ kind: 'text', content: 'plain' }))
      expect(vault.get(filed.item.id)?.linkTitleError).toBe('not-html:text')

      await fetchLinkTitle(vault, filed.item.id, seam(new Error('ECONNREFUSED')))
      expect(vault.get(filed.item.id)?.linkTitleError).toBe('network:ECONNREFUSED')
    })

    it('refuses a page whose title names the refusal instead of the link', async () => {
      // The reported case (2026-09-21): bilibili answers a GET it does not like
      // with HTTP 200 and this page — 1360 bytes, a risk-captcha app that never
      // renders, and a real-looking `<title>`. Every check before the refusal
      // one passes on it, which is how 「验证码」 became a record's name.
      const filed = await captureText(
        vault,
        'https://www.bilibili.com/video/BV1bi426EEAK',
        'panel',
      )
      const notes: string[] = []
      const refusal = [
        '<!DOCTYPE html><html><head>',
        '<!-- Dejavu Release Version 64940-->',
        '<script>window._BiliGreyResult = { method: "direct", versionId: "64940", }</script>',
        '<meta charset="UTF-8"><title>验证码_哔哩哔哩</title>',
        '<link href="//s1.hdslb.com/bfs/static/jinkela/risk-captcha/css/base.css" rel="stylesheet">',
        '</head><body><div id="biliMainHeader"></div><div id="risk-captcha-app"></div>',
        '<script>window._riskdata_ = { "v_voucher": "voucher_1" }</script></body></html>',
      ].join('')

      expect(
        await fetchLinkTitle(vault, filed.item.id, seam({ content: refusal }), (message) =>
          notes.push(message),
        ),
      ).toBeUndefined()

      expect(vault.get(filed.item.id)?.linkTitle).toBeUndefined()
      expect(vault.get(filed.item.id)?.linkTitleError).toBe('refused-page')
      // Only the host is logged, never the path — the same rule as every other
      // line this module writes.
      expect(notes.join()).toContain('www.bilibili.com')
      expect(notes.join()).not.toContain('BV1bi426EEAK')
    })

    it('still takes the headline of a short page that is not a refusal', async () => {
      // The other side of the heuristic: a little text is not a refusal. Without
      // this, the check would be "any small page loses its name".
      const filed = await captureText(vault, 'https://example.com/short', 'panel')

      expect(
        await fetchLinkTitle(
          vault,
          filed.item.id,
          seam({ content: '<html><head><title>关于我们</title></head><body>很短的一页。</body></html>' }),
        ),
      ).toBe('关于我们')
      expect(vault.get(filed.item.id)?.linkTitleError).toBeUndefined()
    })

    it('keeps a headline that merely talks about a captcha', async () => {
      // A page *about* captchas is a page: it has text. The title pattern only
      // refuses a document that has nothing else to offer.
      const filed = await captureText(vault, 'https://example.com/about-captchas', 'panel')
      const body = `<p>${'一篇讲验证码是怎么工作的长文。'.repeat(30)}</p>`

      expect(
        await fetchLinkTitle(
          vault,
          filed.item.id,
          seam({ content: `<html><head><title>验证码是怎么工作的</title></head><body>${body}</body></html>` }),
        ),
      ).toBe('验证码是怎么工作的')
    })

    it('takes the headline of a real page that merely carries challenge markup', async () => {
      // The regression that broke a good headline (2026-09-21): the real page for
      // https://www.bilibili.com/video/BV1ToGC6TEjH loads `risk-captcha-sdk`, sets
      // `window._BiliGreyResult` for grey releases and names `geetest` in an error
      // filter. A first version of the refusal check treated any of those hits as a
      // verdict and left the record showing its own URL.
      const filed = await captureText(vault, 'https://www.bilibili.com/video/BV1ToGC6TEjH', 'panel')
      const page = [
        '<html><head><title>别觉得AI离你很远</title>',
        '<script src="https://s1.hdslb.com/bfs/seed/jinkela/risk-captcha-sdk/CaptchaLoader.js"></script>',
        '<script>window._BiliGreyResult={"method":"base","grayVersion":"292598"}</script>',
        '</head><body><div>',
        '真正的内容'.repeat(200),
        '</div><script>MirrorErrorFilterPlugin=["static.geetest.com"]</script></body></html>',
      ].join('')

      expect(await fetchLinkTitle(vault, filed.item.id, seam({ content: page }))).toBe(
        '别觉得AI离你很远',
      )
      expect(vault.get(filed.item.id)?.linkTitleError).toBeUndefined()
    })

    it('clears the note once a headline does arrive', async () => {
      const filed = await captureText(vault, 'https://example.com/late', 'panel')
      await fetchLinkTitle(vault, filed.item.id, seam({ content: '<title></title>' }))
      expect(vault.get(filed.item.id)?.linkTitleError).toBe('no-title')

      await fetchLinkTitle(vault, filed.item.id, seam({ content: '<title>后来抓到了</title>' }))
      expect(vault.get(filed.item.id)?.linkTitle).toBe('后来抓到了')
      expect(vault.get(filed.item.id)?.linkTitleError).toBeUndefined()
    })
  })
})

describe('looksLikeRefusal', () => {
  it('needs an empty page before challenge markup counts', () => {
    // A challenge shell is the markers *and* nothing to read.
    expect(
      looksLikeRefusal('<html><title>首页</title><script src="/cf-chl/x.js"></script>', '首页'),
    ).toBe(true)
    // The same strings on a page that has something to say are just strings a
    // real page carries too — so text wins, whatever the markup mentions.
    const real = [
      '<html><head><title>真正的标题</title>',
      '<script src="https://s1.hdslb.com/bfs/seed/jinkela/risk-captcha-sdk/CaptchaLoader.js"></script>',
      '<script>window._BiliGreyResult={"method":"base"}</script></head><body><p>',
      '正文'.repeat(400),
      '</p><script>var list=["static.geetest.com"]</script></body></html>',
    ].join('')
    expect(looksLikeRefusal(real, '真正的标题')).toBe(false)
  })

  it('needs a refusal-shaped title when the page is empty and unmarked', () => {
    expect(looksLikeRefusal('<html><title>某站</title></html>', '某站')).toBe(false)
    expect(looksLikeRefusal('<html><title>Just a moment...</title></html>', 'Just a moment...')).toBe(
      true,
    )
  })
})
