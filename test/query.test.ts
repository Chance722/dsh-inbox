import { describe, expect, it } from 'vitest'

import { countWatchLater, selectItems } from '../src/host/vault/query.js'
import type { Item } from '../src/host/vault/spec.js'

function item(overrides: Partial<Item> & { id: string; createdAt: string }): Item {
  return {
    kind: 'text',
    category: 'idea',
    source: 'panel',
    updatedAt: overrides.createdAt,
    tags: [],
    attachmentIds: [],
    ...overrides,
  }
}

const vault: Item[] = [
  item({
    id: 'a',
    createdAt: '2026-09-01T10:00:00.000Z',
    watchLater: true,
    title: 'React 并发渲染笔记',
    tags: ['前端'],
  }),
  item({
    id: 'b',
    createdAt: '2026-09-02T10:00:00.000Z',
    kind: 'link',
    category: 'media',
    url: 'https://www.bilibili.com/video/BV1xx',
    platform: 'bilibili',
    watchLater: true,
    title: '那个讲动画原理的视频',
    tags: ['动画', '待看'],
  }),
  item({
    id: 'c',
    createdAt: '2026-09-03T10:00:00.000Z',
    kind: 'image',
    category: 'document',
    // Not flagged: this is the "read" one from the old model, which is simply
    // "not 待看" now.
    note: '身份证照',
  }),
  item({
    id: 'd',
    createdAt: '2026-09-04T10:00:00.000Z',
    kind: 'link',
    category: 'article',
    url: 'https://mp.weixin.qq.com/s/abc',
    platform: 'wechat',
    watchLater: true,
    title: '一篇关于缓存的公众号文章',
  }),
  item({
    id: 'e',
    createdAt: '2026-09-05T10:00:00.000Z',
    deletedAt: '2026-09-06T10:00:00.000Z',
  }),
]

describe('selectItems', () => {
  it('returns newest first and hides soft-deleted records', () => {
    expect(selectItems(vault).map((record) => record.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('includes soft-deleted records on request', () => {
    expect(selectItems(vault, { includeDeleted: true }).map((record) => record.id)).toEqual([
      'e',
      'd',
      'c',
      'b',
      'a',
    ])
  })

  it('matches free text across title, note, url and tags, case-insensitively', () => {
    expect(selectItems(vault, { text: '并发' }).map((record) => record.id)).toEqual(['a'])
    expect(selectItems(vault, { text: 'BV1XX' }).map((record) => record.id)).toEqual(['b'])
    expect(selectItems(vault, { text: '身份证' }).map((record) => record.id)).toEqual(['c'])
    expect(selectItems(vault, { text: '动画' }).map((record) => record.id)).toEqual(['b'])
  })

  it('treats categories as an OR set and different fields as AND', () => {
    expect(selectItems(vault, { categories: ['media', 'article'] }).map((r) => r.id)).toEqual(['d', 'b'])
    expect(
      selectItems(vault, { categories: ['media', 'article'], watchLater: true }).map((r) => r.id),
    ).toEqual(['d', 'b'])
  })

  it('requires every listed tag', () => {
    expect(selectItems(vault, { tags: ['动画'] }).map((r) => r.id)).toEqual(['b'])
    expect(selectItems(vault, { tags: ['动画', '待看'] }).map((r) => r.id)).toEqual(['b'])
    expect(selectItems(vault, { tags: ['动画', '前端'] })).toEqual([])
  })

  it('pages after ordering, not before', () => {
    expect(selectItems(vault, { limit: 2 }).map((r) => r.id)).toEqual(['d', 'c'])
    expect(selectItems(vault, { limit: 2, offset: 2 }).map((r) => r.id)).toEqual(['b', 'a'])
    expect(selectItems(vault, { offset: 3 }).map((r) => r.id)).toEqual(['a'])
  })

  it('treats a blank query as no text filter', () => {
    expect(selectItems(vault, { text: '   ' })).toHaveLength(4)
  })
})

describe('countWatchLater', () => {
  it('counts the flagged live records, and ignores soft-deleted ones', () => {
    expect(countWatchLater(vault)).toBe(3)
  })
})
