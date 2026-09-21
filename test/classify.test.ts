/**
 * The rule layer and the redactor.
 *
 * These are the two places M5 promises something precise: rules that decide only
 * what they can prove, and a redactor that always removes a credential value
 * before any text could leave the machine.
 */

import { describe, expect, it } from 'vitest'

import {
  classifyImage,
  classifyLink,
  classifyText,
  findSecret,
  platformOf,
} from '../src/host/classify/rules.js'
import { looksRedacted, redact } from '../src/host/classify/redact.js'

describe('platform and link rules', () => {
  it('names the platform by host, including subdomains and short links', () => {
    expect(platformOf('https://space.bilibili.com/1')).toBe('bilibili')
    expect(platformOf('https://b23.tv/abc')).toBe('bilibili')
    expect(platformOf('https://mp.weixin.qq.com/s/abc')).toBe('wechat')
    expect(platformOf('https://juejin.cn/post/7300000000000000000')).toBe('juejin')
    expect(platformOf('https://zhuanlan.zhihu.com/p/123')).toBe('zhihu')
    expect(platformOf('https://youtu.be/abc')).toBe('youtube')
    expect(platformOf('https://blog.csdn.net/someone/article/details/1')).toBe('csdn')
    expect(platformOf('https://news.ycombinator.com/item?id=1')).toBe('hackernews')
    expect(platformOf('https://example.com/a')).toBeUndefined()
  })

  it('calls a video page media, a public-account article article', () => {
    expect(classifyLink('https://www.bilibili.com/video/BV1xx')).toMatchObject({
      category: 'media',
      platform: 'bilibili',
      confidence: 'decided',
    })
    expect(classifyLink('https://www.bilibili.com/read/cv123')).toMatchObject({
      category: 'article',
    })
    expect(classifyLink('https://mp.weixin.qq.com/s/abc')).toMatchObject({
      category: 'article',
      platform: 'wechat',
    })
    expect(classifyLink('https://www.youtube.com/watch?v=x')).toMatchObject({ category: 'media' })
  })

  it('admits when it only recognises the platform', () => {
    expect(classifyLink('https://github.com/foo/bar')).toMatchObject({
      category: 'other',
      platform: 'github',
      confidence: 'unsure',
    })
    expect(classifyLink('https://example.com/a')).toMatchObject({ confidence: 'unsure' })
  })

  it('falls back to what the platform mostly serves when the path says nothing', () => {
    // The reported case (2026-09-21): a 掘金 post arrived with a platform of
    // `undefined`, so nothing showed in the detail pane. Some of these paths do
    // say what they are (`/post/`), but the ones only the site can read — a
    // numeric id, an opaque `/cover/abc.html` — need the host to speak.
    expect(classifyLink('https://juejin.cn/post/7300000000000000000')).toMatchObject({
      category: 'article',
      platform: 'juejin',
      confidence: 'decided',
    })
    expect(classifyLink('https://vimeo.com/12345')).toMatchObject({
      category: 'media',
      platform: 'vimeo',
      confidence: 'decided',
    })
    expect(classifyLink('https://v.qq.com/x/cover/abc.html')).toMatchObject({
      category: 'media',
      platform: 'tencentvideo',
    })
    expect(classifyLink('https://www.zhihu.com/question/123')).toMatchObject({
      category: 'article',
      platform: 'zhihu',
    })
    expect(classifyLink('https://medium.com/@someone/a-post')).toMatchObject({
      category: 'article',
      platform: 'medium',
    })
    expect(classifyLink('https://www.instagram.com/p/abc')).toMatchObject({
      category: 'article',
      platform: 'instagram',
    })
  })
})

describe('credential rules', () => {
  it('recognises the shapes people actually paste', () => {
    for (const sample of [
      'secretId=AKIDxxxxxxxxxxxxxxxx',
      'secretkey: abcdefghijklmnop',
      'api_key = 1234567890abcdef',
      'password=hunter2',
      'token: ghp_abcdefghijklmnopqrstuvwxyz012345',
      'sk-abcdefghijklmnopqrstuvwx',
      'AKIAIOSFODNN7EXAMPLE',
      '-----BEGIN RSA PRIVATE KEY-----',
      'mongodb://user:pass@host:27017/db',
    ]) {
      expect(findSecret(sample), sample).toBeDefined()
      expect(classifyText(sample).category).toBe('secret')
    }
  })

  it('leaves ordinary prose and links alone', () => {
    expect(classifyText('这是一条灵感：给 inbox 写文档')).toMatchObject({
      category: 'other',
      confidence: 'unsure',
    })
    expect(findSecret('我记得密码是写在纸上的')).toBeUndefined()
  })
})

describe('image heuristics', () => {
  it('flags a card-shaped ratio as a suspected document without deciding', () => {
    const verdict = classifyImage({ width: 856, height: 540 })
    expect(verdict.category).toBe('image')
    expect(verdict.confidence).toBe('unsure')
    expect(verdict.tags).toEqual(['疑似证件'])
  })

  it('treats a photo ratio as an ordinary image', () => {
    expect(classifyImage({ width: 1200, height: 800 })).toMatchObject({
      category: 'image',
      confidence: 'decided',
    })
  })

  it('stays unsure without dimensions', () => {
    expect(classifyImage({})).toMatchObject({ category: 'image', confidence: 'unsure' })
    expect(classifyImage({ width: 0, height: 100 })).toMatchObject({ confidence: 'unsure' })
  })
})

describe('redact', () => {
  it('keeps the label and removes the value', () => {
    const out = redact('腾讯云的 secretId=AKIDexample secretKey=abcdef123456')
    expect(out).toContain('secretId')
    expect(out).not.toContain('AKIDexample')
    expect(out).not.toContain('abcdef123456')
    expect(looksRedacted(out)).toBe(true)
  })

  it('masks standalone tokens and private keys', () => {
    expect(redact('用 sk-abcdefghijklmnopqrstuvwx 调它')).not.toContain('sk-abcdefghijklmnopqrstuvwx')
    expect(
      redact('-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----'),
    ).toContain('私钥已脱敏')
  })

  it('leaves text that carries no credential untouched', () => {
    const prose = '今天想到一个主意：把 inbox 的搜索结果做成卡片'
    expect(redact(prose)).toBe(prose)
    expect(looksRedacted(prose)).toBe(false)
  })

  it('removes the value in every shape the rules know', () => {
    // The label survives on purpose — a redacted string still reads as "this
    // was a credential field", which is what a classifier needs. What must not
    // survive is the value itself.
    const samples: readonly (readonly [string, string])[] = [
      ['secretId=AKIDxxxxxxxxxxxxxxxx', 'AKIDxxxxxxxxxxxxxxxx'],
      ['token: ghp_abcdefghijklmnopqrstuvwxyz012345', 'ghp_abcdefghijklmnopqrstuvwxyz012345'],
      ['api_key = AKIAIOSFODNN7EXAMPLE', 'AKIAIOSFODNN7EXAMPLE'],
      ['password: hunter2', 'hunter2'],
      ['mongodb://user:pass@host:27017/db', 'pass'],
    ]
    for (const [sample, secret] of samples) {
      expect(redact(sample), sample).not.toContain(secret)
    }
  })
})
