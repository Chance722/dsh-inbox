/**
 * The model fallback's guard rails: when it runs, what it costs, and what it
 * refuses to do. The live call itself is covered by the acceptance run; these
 * are the decisions that must hold without a network.
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BUDGET,
  freshSpend,
  parseCategory,
  rollSpend,
  shouldAskModel,
  spendOf,
  today,
  withinBudget,
} from '../src/host/classify/model.js'
import type { Classification } from '../src/host/classify/rules.js'
import type { Item } from '../src/host/vault/spec.js'

function item(overrides: Partial<Item>): Item {
  return {
    id: 'i1',
    kind: 'text',
    category: 'other',
    status: 'unread',
    source: 'panel',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
    tags: [],
    attachmentIds: [],
    ...overrides,
  }
}

const unsure: Classification = { category: 'other', confidence: 'unsure', reason: '规则没定' }
const decided: Classification = { category: 'media', confidence: 'decided', reason: '视频页' }

describe('when the fallback runs', () => {
  it('asks only when no rule decided', () => {
    expect(shouldAskModel(unsure, item({ text: '下周三之前把发票报销掉' }))).toBe(true)
    expect(shouldAskModel(decided, item({ text: 'https://b23.tv/x' }))).toBe(false)
  })

  it('asks about an image, because ratio cannot see a phone snapshot of a document', () => {
    // The red line changed on 2026-09-19: the user authorised sending images out
    // for classification, since a phone photo of an ID card has a photo's ratio.
    const verdict: Classification = { category: 'image', confidence: 'unsure', reason: '疑似证件' }
    expect(shouldAskModel(verdict, item({ kind: 'image', attachmentIds: ['a'] }))).toBe(true)
  })

  it('skips an image that has nothing to look at', () => {
    const verdict: Classification = { category: 'image', confidence: 'unsure', reason: '没有尺寸' }
    expect(shouldAskModel(verdict, item({ kind: 'image' }))).toBe(false)
  })

  it('skips content too short to be about anything', () => {
    expect(shouldAskModel(unsure, item({ text: '收到' }))).toBe(false)
  })

  it('asks about a link only when the host is recognised', () => {
    const known: Classification = {
      category: 'other',
      platform: 'github',
      confidence: 'unsure',
      reason: '认得出平台，说不准类型',
    }
    const unknown: Classification = { category: 'other', confidence: 'unsure', reason: '不认识的站点' }
    expect(shouldAskModel(known, item({ kind: 'link', url: 'https://github.com/foo/bar' }))).toBe(true)
    expect(shouldAskModel(unknown, item({ kind: 'link', url: 'https://x.co' }))).toBe(false)
  })

  it('skips records with nothing to read', () => {
    expect(shouldAskModel(unsure, item({}))).toBe(false)
  })
})

describe('budget', () => {
  it('starts fresh each local day', () => {
    const spent = spendOf(freshSpend(), 1_000)
    expect(rollSpend(spent, new Date())).toEqual(spent)
    const tomorrow = new Date(Date.now() + 26 * 60 * 60 * 1_000)
    expect(rollSpend(spent, tomorrow)).toEqual(freshSpend(tomorrow))
    expect(today(new Date(2026, 8, 19))).toBe('2026-09-19')
  })

  it('stops at the call cap and at the token cap', () => {
    expect(withinBudget({ day: today(), calls: DEFAULT_BUDGET.maxCallsPerDay - 1, tokens: 0 })).toBe(true)
    expect(withinBudget({ day: today(), calls: DEFAULT_BUDGET.maxCallsPerDay, tokens: 0 })).toBe(false)
    expect(
      withinBudget({ day: today(), calls: 1, tokens: DEFAULT_BUDGET.maxTokensPerDay }),
    ).toBe(false)
  })

  it('counts what one call cost', () => {
    expect(spendOf({ day: today(), calls: 2, tokens: 100 }, 250)).toEqual({
      day: today(),
      calls: 3,
      tokens: 350,
    })
    expect(spendOf({ day: today(), calls: 0, tokens: 0 }, -5).tokens).toBe(0)
  })
})

describe('reading the answer', () => {
  it('accepts the category however the model spells it', () => {
    expect(parseCategory('article')).toBe('article')
    expect(parseCategory('  Article\n')).toBe('article')
    expect(parseCategory('这类东西属于 article。')).toBe('article')
  })

  it('refuses an answer that names no category', () => {
    expect(parseCategory('我不确定')).toBeUndefined()
    expect(parseCategory('')).toBeUndefined()
  })
})
