/**
 * What a record is called on screen.
 *
 * This module is pure, so it can be tested without a browser — which matters,
 * because two of these cases are the red line (`AGENTS.md` 3): a credential's
 * own text must never be printed, and its heading is what tells two credentials
 * apart instead.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { NOTE_IN_HEADING_CHARS, headingOf, headingTooltipOf, isSecret } from '../src/client/heading.js'
import type { EntrySummary } from '../src/shared/panel-wire.js'
import { installLanguage } from './helpers/locale.js'

/**
 * The copy these cases assert is Chinese — the panel's primary language — so the
 * language is pinned rather than inherited from the machine's locale.
 */
beforeAll(() => {
  installLanguage('zh')
})

/** The smallest record the heading rule reads. */
function entry(fields: Partial<EntrySummary>): EntrySummary {
  return {
    id: 'e1',
    kind: 'text',
    category: 'other',
    watchLater: false,
    tags: [],
    createdAt: '2026-09-19T09:00:00.000Z',
    updatedAt: '2026-09-19T09:00:00.000Z',
    attachmentCount: 0,
    ...fields,
  }
}

describe('record headings', () => {
  it('prefers the title, then the url, then the preview', () => {
    expect(headingOf(entry({ title: '知乎专栏', url: 'https://example.com/a', preview: '正文' }))).toBe(
      '知乎专栏',
    )
    expect(headingOf(entry({ url: 'https://example.com/a', preview: '正文' }))).toBe(
      'https://example.com/a',
    )
    expect(headingOf(entry({ preview: '正文' }))).toBe('正文')
    expect(headingOf(entry({}))).toBe('（无标题）')
  })

  it('names a credential by its description, never by its text', () => {
    // `preview` is the first line of the stored text — the field the old list
    // and the dock used to print for a credential.
    const secret = entry({
      category: 'secret',
      preview: 'secretid=AKIDexample secretkey=abcdef',
      note: '腾讯云测试环境',
    })

    expect(isSecret(secret)).toBe(true)
    // No name, so the note is the last resort — and never the text.
    expect(headingOf(secret)).toBe('腾讯云测试环境')
    expect(headingOf(secret)).not.toContain('AKIDexample')
    expect(headingTooltipOf(secret)).not.toContain('AKIDexample')
  })

  it('leaves a credential with no description as the plain label', () => {
    expect(headingOf(entry({ category: 'secret', preview: 'secretid=AKIDexample' }))).toBe('密钥 / 账密')
    // Whitespace is not a description either.
    expect(headingOf(entry({ category: 'secret', note: '   ' }))).toBe('密钥 / 账密')
  })

  it('clamps a long description on the card and keeps it whole in the tooltip', () => {
    const note = '生产环境的对象存储密钥，只在报销系统里用，别和测试环境那把搞混'
    const secret = entry({ category: 'secret', note })

    expect(headingOf(secret)).toBe(`${note.slice(0, NOTE_IN_HEADING_CHARS)}…`)
    expect(headingOf(secret).length).toBeLessThan(headingTooltipOf(secret).length)
    expect(headingTooltipOf(secret)).toBe(note)
  })

  it('collapses newlines, so a heading can never become two lines', () => {
    const secret = entry({ category: 'secret', note: '第一行\n第二行' })
    expect(headingOf(secret)).toBe('第一行 第二行')
  })

  it('does not hang a description on records that may show their own text', () => {
    expect(headingOf(entry({ title: '公众号文章', note: '缓存那篇' }))).toBe('公众号文章')
  })

  it('prefers the headline fetched from the page over the bare URL', () => {
    const link = entry({
      kind: 'link',
      url: 'https://mp.weixin.qq.com/s/abc',
      linkTitle: '三体读后感',
    })
    expect(headingOf(link)).toBe('三体读后感')
    // Nobody's name but the user's outranks it.
    expect(headingOf({ ...link, title: '我起的名字' })).toBe('我起的名字')
    // A link whose page never answered still has its address.
    expect(headingOf(entry({ kind: 'link', url: 'https://example.com/a' }))).toBe(
      'https://example.com/a',
    )
  })

  it('never lets a fetched headline name a credential', () => {
    expect(
      headingOf(entry({ category: 'secret', linkTitle: '登录 - 某站点', note: '公司邮箱' })),
    ).toBe('公司邮箱')
  })

  describe('a record with no text of its own', () => {
    it('is named by the file it arrived as, with the note left to the tooltip', () => {
      // Exactly the case that used to read 「（无标题）」: an uploaded photo, whose
      // file name was stored all along and never used.
      expect(headingOf(entry({ kind: 'image', attachmentName: 'IMG_20260918.jpg' }))).toBe(
        'IMG_20260918.jpg',
      )
      const photo = entry({ kind: 'image', attachmentName: 'IMG_20260918.jpg', note: '身份证正面' })
      expect(headingOf(photo)).toBe('IMG_20260918.jpg')
      expect(headingTooltipOf(photo)).toBe('IMG_20260918.jpg（身份证正面）')
    })

    it('prefers a name the user typed over the file name', () => {
      expect(
        headingOf(
          entry({
            kind: 'image',
            title: '身份证正面',
            attachmentName: 'IMG_20260918.jpg',
            note: '给银行用',
          }),
        ),
      ).toBe('身份证正面')
    })

    it('falls back to the description when there is no file name either', () => {
      expect(headingOf(entry({ kind: 'file', note: '报税表' }))).toBe('报税表')
      expect(headingOf(entry({ kind: 'file' }))).toBe('（无标题）')
    })

    it('treats an empty name as no name, not as a blank heading', () => {
      expect(headingOf(entry({ kind: 'image', title: '   ', attachmentName: 'a.png' }))).toBe('a.png')
    })

    it('clamps the description on the card and keeps it whole in the tooltip', () => {
      const note = '身份证正面，给银行开户用，别和反面那张搞混了，反面那张已经没用了'
      const image = entry({ kind: 'image', attachmentName: 'IMG_1.jpg', note })
      // The row is just the name; the note rides on the hover.
      expect(headingOf(image)).toBe('IMG_1.jpg')
      expect(headingTooltipOf(image)).toBe(`IMG_1.jpg（${note}）`)
      // A record with no name *and* no file name still falls back to the note,
      // clamped.
      const nameless = entry({ kind: 'file', note })
      expect(headingOf(nameless)).toBe(`${note.slice(0, NOTE_IN_HEADING_CHARS)}…`)
      expect(headingTooltipOf(nameless)).toBe(note)
    })

  it('never lets a file name name a credential', () => {
    const secret = entry({ category: 'secret', attachmentName: 'password.txt', note: '测试环境' })
    // Neither the attachment name nor the text may become a credential's row:
    // the note is the user's own word, and the only one allowed through.
    expect(headingOf(secret)).toBe('测试环境')
    expect(headingOf(secret)).not.toContain('password.txt')
    expect(headingOf(entry({ category: 'secret', attachmentName: 'password.txt' }))).toBe(
      '密钥 / 账密',
    )
  })

  it('shows the name the user gave a credential', () => {
    // Reported: renaming a 密钥 / 账密 record changed nothing in the list —
    // the credential branch returned the fixed label plus the description and
    // never looked at the name at all.
    const secret = entry({ category: 'secret', title: '公司邮箱', note: '腾讯云测试环境' })
    // The name *is* the row now — no 「密钥 / 账密（…）」 wrapper eating the width
    // the name needs; the key glyph beside it says what kind of thing this is.
    expect(headingOf(secret)).toBe('公司邮箱')
    // The note left the row, so the hover carries it.
    expect(headingTooltipOf(secret)).toBe('公司邮箱（腾讯云测试环境）')

    expect(headingOf(entry({ category: 'secret', title: '公司邮箱' }))).toBe('公司邮箱')
    expect(headingOf(entry({ category: 'secret', title: '  ', note: '备注顶上来' }))).toBe(
      '备注顶上来',
    )
  })
  })
})
