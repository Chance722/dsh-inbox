/**
 * What a record is called on screen.
 *
 * This module is pure, so it can be tested without a browser — which matters,
 * because two of these cases are the red line (`AGENTS.md` 3): a credential's
 * own text must never be printed, and its heading is what tells two credentials
 * apart instead.
 */

import { describe, expect, it } from 'vitest'

import { NOTE_IN_HEADING_CHARS, headingOf, headingTooltipOf, isSecret } from '../src/client/heading.js'
import type { EntrySummary } from '../src/shared/panel-wire.js'

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
    expect(headingOf(secret)).toBe('密钥 / 账密（腾讯云测试环境）')
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

    expect(headingOf(secret)).toBe(`密钥 / 账密（${note.slice(0, NOTE_IN_HEADING_CHARS)}…）`)
    expect(headingOf(secret).length).toBeLessThan(headingTooltipOf(secret).length)
    expect(headingTooltipOf(secret)).toBe(`密钥 / 账密（${note}）`)
  })

  it('collapses newlines, so a heading can never become two lines', () => {
    const secret = entry({ category: 'secret', note: '第一行\n第二行' })
    expect(headingOf(secret)).toBe('密钥 / 账密（第一行 第二行）')
  })

  it('does not hang a description on records that may show their own text', () => {
    expect(headingOf(entry({ title: '公众号文章', note: '缓存那篇' }))).toBe('公众号文章')
  })

  describe('a record with no text of its own', () => {
    it('is named by the file it arrived as, plus the description', () => {
      // Exactly the case that used to read 「（无标题）」: an uploaded photo, whose
      // file name was stored all along and never used.
      expect(headingOf(entry({ kind: 'image', attachmentName: 'IMG_20260918.jpg' }))).toBe(
        'IMG_20260918.jpg',
      )
      expect(
        headingOf(
          entry({ kind: 'image', attachmentName: 'IMG_20260918.jpg', note: '身份证正面' }),
        ),
      ).toBe('IMG_20260918.jpg（身份证正面）')
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
      expect(headingOf(image)).toBe(`IMG_1.jpg（${note.slice(0, NOTE_IN_HEADING_CHARS)}…）`)
      expect(headingTooltipOf(image)).toBe(`IMG_1.jpg（${note}）`)
    })

  it('never lets a file name name a credential', () => {
    const secret = entry({ category: 'secret', attachmentName: 'password.txt', note: '测试环境' })
    expect(headingOf(secret)).toBe('密钥 / 账密（测试环境）')
  })

  it('shows the name the user gave a credential', () => {
    // Reported: renaming a 密钥 / 账密 record changed nothing in the list —
    // the credential branch returned the fixed label plus the description and
    // never looked at the name at all.
    const secret = entry({ category: 'secret', title: '公司邮箱', note: '腾讯云测试环境' })
    expect(headingOf(secret)).toBe('密钥 / 账密（公司邮箱）')
    expect(headingTooltipOf(secret)).toBe('密钥 / 账密（公司邮箱）')

    // The prefix stays: a row must still say what it is, and the parentheses
    // carry the user's own words only.
    expect(headingOf(entry({ category: 'secret', title: '公司邮箱' }))).toBe('密钥 / 账密（公司邮箱）')
    expect(headingOf(entry({ category: 'secret', title: '  ' , note: '备注顶上来' }))).toBe(
      '密钥 / 账密（备注顶上来）',
    )
  })
  })
})
