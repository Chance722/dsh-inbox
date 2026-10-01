/**
 * The model fallback: one small call, only when a rule could not decide, always
 * redacted, always capped.
 *
 * What it does and does not send:
 *   - **an image record's bytes do go** — this is the one place the plugin hands
 *     a picture to the model, and it is deliberate: a phone snapshot of an ID
 *     document has a photo's aspect ratio, so only the picture can decide, and
 *     the user authorised exactly this on 2026-09-19 (`AGENTS.md` 4). Nothing
 *     else about the record travels with it;
 *   - **credential text never goes** (`redact()` runs first, and a record whose
 *     rule verdict is already `secret` is never asked about at all);
 *   - **the user always wins** — a verdict they set, or one a rule already
 *     decided, is never overwritten, and the daily cap outranks a pending call.
 *
 * Spending is capped per local day and persisted in the vault's global slot, so
 * a restart cannot reset the meter.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Category } from '../../shared/vocabulary.js';
import type { Item } from '../vault/spec.js';
import type { Vault } from '../vault/vault.js';
import type { Classification } from './rules.js';
/** Provider route registered by the shipped DeepSeek adapter. */
export declare const PROVIDER = "deepseek-official";
/** The cheap model this vault classifies with. */
export declare const MODEL = "deepseek-flash";
/** How much the fallback may spend, and how fast. */
export interface ModelBudget {
    /** Calls per local day. */
    maxCallsPerDay: number;
    /** Prompt + completion tokens per local day. */
    maxTokensPerDay: number;
    /**
     * Output ceiling for one call. A category word needs almost nothing, but this
     * model spends tokens thinking first — 64 was enough to get cut off before it
     * ever answered, so the ceiling has to fit the reasoning too.
     */
    maxTokensPerCall: number;
}
/**
 * The thresholds, chosen so a bad day costs pocket change and a runaway loop
 * cannot happen: 200 calls is far more than a person pastes in a day, and
 * 100k tokens is a few 分 at flash prices.
 */
export declare const DEFAULT_BUDGET: ModelBudget;
/** Today's spend, as persisted in the vault's global slot. */
export interface ModelSpend {
    /** `YYYY-MM-DD` in local time. */
    day: string;
    calls: number;
    tokens: number;
}
/** Local calendar day, because the cap is a human's day, not a UTC one. */
export declare function today(now?: Date): string;
/** Fresh spend record for a new day. */
export declare function freshSpend(now?: Date): ModelSpend;
/** Roll the record over when the day changed. */
export declare function rollSpend(spend: ModelSpend | undefined, now?: Date): ModelSpend;
/**
 * Whether one more call fits the budget.
 *
 * @param spend - the rolled-over spend record.
 * @param budget - the configured caps.
 * @returns true when a call may be made.
 */
export declare function withinBudget(spend: ModelSpend, budget?: ModelBudget): boolean;
/** Record one finished call. */
export declare function spendOf(spend: ModelSpend, tokens: number): ModelSpend;
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
export declare function shouldAskModel(verdict: Classification, item: Item, minimumChars?: number): boolean;
/**
 * Read one category out of whatever the model replied.
 *
 * @param answer - the model's text.
 * @returns the category, or undefined when the reply names none of them.
 */
export declare function parseCategory(answer: string): Category | undefined;
/** What one fallback attempt produced, for the caller to record or ignore. */
export type FallbackOutcome = {
    kind: 'applied';
    category: Category;
    tokens: number;
} | {
    kind: 'skipped';
    reason: string;
} | {
    kind: 'failed';
    reason: string;
};
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
export declare function classifyWithModel(ctx: Context, vault: Vault, item: Item, verdict: Classification, budget?: ModelBudget): Promise<FallbackOutcome>;
