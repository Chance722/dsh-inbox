/**
 * Finding the record ids in a tool result.
 *
 * This is the entire "click a record and go look at it" feature on the card side:
 * if the id cannot be found in the text the model was shown, there is nothing to
 * click. `src/host/tools.ts` writes `… · id: <uuid>` at the end of every result
 * line, so the pattern is boring on purpose — and it must not match a partial id,
 * an attachment marker, or a word that merely looks like one.
 */

import { describe, expect, it } from 'vitest'

import { recordIdsIn } from '../src/client/card.js'

const ID = '5b1f7c9e-2f4a-4c3b-9f1e-8a7d6c5b4a39'

describe('recordIdsIn', () => {
  it('finds every id in a search result, in order', () => {
    const other = '11111111-2222-4333-8444-555555555555'
    const text = [
      `1. 📄 文章 用AI的这三年`,
      `   存入：2026/9/20 13:20 · id: ${ID}`,
      `2. 🔗 链接 https://example.com`,
      `   存入：2026/9/20 13:21 · id: ${other}`,
    ].join('\n')

    expect(recordIdsIn(text)).toEqual([ID, other])
  })

  it('ignores attachment markers and text that is not an id', () => {
    expect(recordIdsIn('[attachment:5b1f7c9e-2f4a-4c3b-9f1e]')).toEqual([])
    expect(recordIdsIn('id: not-a-uuid')).toEqual([])
    // Too short to be an id: a truncated one must not become a link to nowhere.
    expect(recordIdsIn('id: 5b1f7c9e-2f4a-4c3b-9f1e')).toEqual([])
  })

  it('finds nothing in prose the model wrote itself', () => {
    expect(recordIdsIn('我帮你找到了 3 条记录，id 我就没贴出来了。')).toEqual([])
  })
})
