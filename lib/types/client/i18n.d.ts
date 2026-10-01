/**
 * How the panel follows dsh's language.
 *
 * dsh ships a locale service (`@deepseek-ai/dsh-client-locale`): the user picks
 * a language under 设置 → 常规, the host persists it, and the page's `<html
 * lang>` follows it. The panel does not invent a switch of its own — it
 * registers its copy as a dictionary in that service and reads back whatever
 * language is active, which is also why a language pack we have never heard of
 * (say `ja` falling back to English) still reads correctly.
 *
 * Two paths, in this order:
 *
 * 1. **The locale service**, when the composition has one. Our namespace is
 *    registered for both shipped locales, and the active id is read from the
 *    service's own snapshot — so the panel switches the moment the user does.
 * 2. **The document**, when it does not. `<html lang>` is the host's own
 *    statement of the active language and `navigator` covers the rest, so a
 *    bare composition still reads in the reader's language rather than
 *    defaulting to Chinese. This is the same seam `scheme.ts` uses for colour.
 *
 * `t()` reads the active language at call time, and `useLocaleRevision()`
 * re-renders a tree when it changes, so no memoised copy outlives a switch.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Category, CategorySource, Kind } from '../shared/vocabulary.js';
import { type MessageKey } from './messages.js';
/** The namespace our copy registers under; nothing else may claim it. */
export declare const MESSAGES_NS = "dsh-inbox";
/** Translation parameters, substituted into `{name}` placeholders. */
export type TranslationParams = Record<string, string | number>;
/** Subscribe to language changes; `useSyncExternalStore` drives the panel. */
export declare function subscribeToLocale(listener: () => void): () => void;
/** A counter that changes whenever the active language does. */
export declare function localeRevision(): number;
/**
 * Re-render a tree when the language changes.
 *
 * The panel, the dock and the conversation cards are three separate React trees
 * (three slots), so each one subscribes — a tree that skipped this would keep
 * the language it first rendered in. The returned number is the revision, and is
 * only there so React has something that changes to compare.
 *
 * @returns the current locale revision.
 */
export declare function useLocaleRevision(): number;
/**
 * Narrow a BCP 47 tag to one of the two dictionaries we carry.
 *
 * `zh`, `zh-CN`, `zh-Hant` are Chinese; everything else reads English, which is
 * what dsh itself falls back to. Pure, so the rule is testable without a DOM.
 *
 * @param tag - a language tag, or undefined when nothing named one.
 * @returns which dictionary to read.
 */
export declare function resolveLanguage(tag: string | undefined): 'zh' | 'en';
/** Which language the panel is reading right now. */
export declare function activeLanguage(): 'zh' | 'en';
/**
 * Translate one key.
 *
 * Falls back from the active dictionary to English to the key itself, so a key
 * that lost its translation reads as a visible key rather than as an empty
 * string.
 *
 * @param key - a key of the shipped dictionary.
 * @param params - values for the `{name}` placeholders.
 * @returns the copy for the active language.
 */
export declare function t(key: MessageKey, params?: TranslationParams): string;
/**
 * The panel's word for a record kind.
 *
 * The host half has its own labels for the same four kinds (`vocabulary.ts`),
 * and they stay Chinese on purpose: they travel into tool results and into the
 * readable copy the vault writes to the cloud, where the reader is the model or
 * another device rather than this browser. The cast is the price of building a
 * key from a value; `test/i18n.test.ts` checks that all four resolve.
 *
 * @param kind - the record's kind.
 * @returns the label in the active language.
 */
export declare function kindLabel(kind: Kind): string;
/** The panel's word for a category; see {@link kindLabel} for the why. */
export declare function categoryLabel(category: Category): string;
/** The panel's badge for who judged a category (规则判定 / 模型判定 / 手动判定). */
export declare function sourceLabel(source: CategorySource): string;
/** One sentence explaining what that badge implies. */
export declare function sourceHint(source: CategorySource): string;
/**
 * Hook the panel's copy up to dsh's language.
 *
 * Called once from the browser half's `apply`, before any panel renders.
 *
 * @param ctx - the browser plugin context.
 */
export declare function installLocale(ctx: Context): void;
/** Whether the host's locale service took our dictionaries (for diagnostics). */
export declare function localeServiceBound(): boolean;
