/**
 * The model fallback: one small call, only when a rule could not decide, always
 * redacted, always capped.
 *
 * Three things this file refuses to do:
 *   - it never sends an image (the only way to judge an ID document from a
 *     picture is the picture, and that is exactly what must not leave);
 *   - it never sends credential text (`redact()` runs first, and a record whose
 *     rule verdict is already `secret` is never asked about at all);
 *   - it never overrides the user, or a rule that already decided.
 *
 * Spending is capped per local day and persisted in the vault's global slot, so
 * a restart cannot reset the meter.
 */

import type { Context } from '@deepseek-ai/cordis'

import { CATEGORIES, type Category } from '../../shared/vocabulary.js'
import type { Item } from '../vault/spec.js'
import type { Vault } from '../vault/vault.js'
import type { Classification } from './rules.js'
import { redact } from './redact.js'

/**
 * The slice of the host's model service this file uses.
 *
 * Declared here rather than importing `@deepseek-ai/dsh-llm` so the plugin keeps
 * one fewer hard dependency on an rc package: the shape is small, and the
 * end-to-end run is what proves it.
 */
interface LlmChunk {
  type: string
  text?: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

interface LlmLike {
  stream(options: {
    provider: string
    model: string
    messages: { role: string; content: { type: string; text: string }[] }[]
    system?: string
    temperature?: number
    maxTokens?: number
  }): AsyncIterable<LlmChunk>
}

/** Provider route registered by the shipped DeepSeek adapter. */
export const PROVIDER = 'deepseek-official'

/** The cheap model this vault classifies with. */
export const MODEL = 'deepseek-flash'

/** How much the fallback may spend, and how fast. */
export interface ModelBudget {
  /** Calls per local day. */
  maxCallsPerDay: number
  /** Prompt + completion tokens per local day. */
  maxTokensPerDay: number
  /**
   * Output ceiling for one call. A category word needs almost nothing, but this
   * model spends tokens thinking first — 64 was enough to get cut off before it
   * ever answered, so the ceiling has to fit the reasoning too.
   */
  maxTokensPerCall: number
}

/**
 * The thresholds, chosen so a bad day costs pocket change and a runaway loop
 * cannot happen: 200 calls is far more than a person pastes in a day, and
 * 100k tokens is a few 分 at flash prices.
 */
export const DEFAULT_BUDGET: ModelBudget = {
  maxCallsPerDay: 200,
  maxTokensPerDay: 100_000,
  maxTokensPerCall: 512,
}

/** Today's spend, as persisted in the vault's global slot. */
export interface ModelSpend {
  /** `YYYY-MM-DD` in local time. */
  day: string
  calls: number
  tokens: number
}

/** Local calendar day, because the cap is a human's day, not a UTC one. */
export function today(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** Fresh spend record for a new day. */
export function freshSpend(now = new Date()): ModelSpend {
  return { day: today(now), calls: 0, tokens: 0 }
}

/** Roll the record over when the day changed. */
export function rollSpend(spend: ModelSpend | undefined, now = new Date()): ModelSpend {
  if (spend === undefined || spend.day !== today(now)) return freshSpend(now)
  return spend
}

/**
 * Whether one more call fits the budget.
 *
 * @param spend - the rolled-over spend record.
 * @param budget - the configured caps.
 * @returns true when a call may be made.
 */
export function withinBudget(spend: ModelSpend, budget: ModelBudget = DEFAULT_BUDGET): boolean {
  return spend.calls < budget.maxCallsPerDay && spend.tokens < budget.maxTokensPerDay
}

/** Record one finished call. */
export function spendOf(
  spend: ModelSpend,
  tokens: number,
): ModelSpend {
  return { day: spend.day, calls: spend.calls + 1, tokens: spend.tokens + Math.max(0, tokens) }
}

/**
 * Whether a verdict is worth a model call.
 *
 * Only text and links are ever asked about, and only when no rule decided and
 * there is enough content to be about something.
 *
 * @param verdict - what the rules concluded.
 * @param item - the stored record.
 * @param minimumChars - how short a paste is too trivial to classify. Eight,
 *   because a Chinese note carries a sentence in that many characters ("下周三
 *   之前把发票报销掉" is eleven) while "收到" is plainly not worth a call.
 * @returns true when the fallback should run.
 */
export function shouldAskModel(
  verdict: Classification,
  item: Item,
  minimumChars = 8,
): boolean {
  if (verdict.confidence !== 'unsure') return false
  if (item.kind === 'link') {
    // A link is worth a call only when the host is one we recognise and the
    // medium is what is unclear — an unknown domain is a guess, not a question.
    return verdict.platform !== undefined
  }
  if (item.kind !== 'text') return false
  const subject = item.text ?? item.url ?? ''
  return subject.trim().length >= minimumChars
}

/**
 * Read one category out of whatever the model replied.
 *
 * @param answer - the model's text.
 * @returns the category, or undefined when the reply names none of them.
 */
export function parseCategory(answer: string): Category | undefined {
  const normalized = answer.toLowerCase()
  return CATEGORIES.find((category) => normalized.includes(category))
}

/** What one fallback attempt produced, for the caller to record or ignore. */
export type FallbackOutcome =
  | { kind: 'applied'; category: Category; tokens: number }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string }

/**
 * Ask the model about one record and patch it when the answer is usable.
 *
 * Never throws: the caller scheduled this as a background pass, and a failed
 * classification must leave the rule's verdict exactly as it was.
 *
 * @param ctx - host context carrying the model runtime.
 * @param vault - the open vault.
 * @param item - the record to classify.
 * @param verdict - the rule verdict that said `unsure`.
 * @param budget - caps for the day.
 * @returns what happened, for logging and tests.
 */
export async function classifyWithModel(
  ctx: Context,
  vault: Vault,
  item: Item,
  verdict: Classification,
  budget: ModelBudget = DEFAULT_BUDGET,
): Promise<FallbackOutcome> {
  if (!shouldAskModel(verdict, item)) {
    return { kind: 'skipped', reason: '规则已经定了，或者内容太短' }
  }

  const llm = ctx.get('llm') as LlmLike | undefined
  if (llm === undefined) {
    const reason = '这个组合里没有模型服务'
    await vault.setModelSpend(rollSpend(vault.global.model), `skipped: ${reason}`)
    return { kind: 'skipped', reason }
  }

  const spend = rollSpend(vault.global.model)
  if (!withinBudget(spend, budget)) {
    const reason = '今天的模型预算用完了'
    await vault.setModelSpend(spend, `skipped: ${reason}`)
    return { kind: 'skipped', reason }
  }

  const subject = redact((item.text ?? item.url ?? '').slice(0, 2_000))
  let answer = ''
  // A thinking model may put its only useful word in the reasoning channel, so
  // keep both and prefer the answer.
  let reasoning = ''
  let tokens = 0
  try {
    const stream = llm.stream({
      provider: PROVIDER,
      model: MODEL,
      maxTokens: budget.maxTokensPerCall,
      temperature: 0,
      system:
        '你在给一个个人收藏夹分类。只回一个词，从这些里选：' +
        `${CATEGORIES.join(' / ')}。不要解释，不要标点。`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `这段东西属于哪一类？\n\n${subject}`,
            },
          ],
        },
      ],
    })
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') answer += chunk.text
      else if (chunk.type === 'reasoning-delta') reasoning += chunk.text
      else if (chunk.type === 'usage') {
        tokens = (chunk.usage?.inputTokens ?? 0) + (chunk.usage?.outputTokens ?? 0)
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    await vault.setModelSpend(spendOf(spend, tokens), `failed: ${reason}`)
    return { kind: 'failed', reason }
  }

  const after = spendOf(spend, tokens)

  const category = parseCategory(answer) ?? parseCategory(reasoning)
  if (category === undefined) {
    const said = answer.trim() || reasoning.trim()
    const reason = `模型没给出可用类目，它说的是：${said.slice(0, 60) || '（空）'}`
    await vault.setModelSpend(after, `failed: ${reason}`)
    return { kind: 'failed', reason }
  }

  // Re-read before writing: the user may have edited the record while the call
  // was in flight, and their word outranks this one.
  const current = vault.get(item.id)
  if (current === undefined || current.categorySource === 'user') {
    const reason = '记录已经不在，或者用户自己定了类目'
    await vault.setModelSpend(after, `skipped: ${reason}`)
    return { kind: 'skipped', reason }
  }

  await vault.patch(item.id, { category, categorySource: 'model' })
  await vault.setModelSpend(after, `applied: ${category} (${String(tokens)} tokens)`)
  return { kind: 'applied', category, tokens }
}
