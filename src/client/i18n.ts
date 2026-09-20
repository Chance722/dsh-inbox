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

import { useSyncExternalStore } from 'react'

import type { Context } from '@deepseek-ai/cordis'

import type { Category, CategorySource, Kind } from '../shared/vocabulary.js'
import { MESSAGES, type MessageKey } from './messages.js'

/** The namespace our copy registers under; nothing else may claim it. */
export const MESSAGES_NS = 'dsh-inbox'

/**
 * The slice of the host's locale service this file uses.
 *
 * Structural on purpose (the same choice `link-title.ts` makes for `ctx.web`):
 * the service belongs to an rc package, and a composition without it must fall
 * back to the document instead of failing to load.
 */
interface LocaleLike {
  register(ns: string, locale: string, dict: Record<string, string>): () => void
  bind(ns: string): (key: string) => string
  subscribe(listener: () => void): () => void
  getSnapshot(): { active: string }
}

/** Translation parameters, substituted into `{name}` placeholders. */
export type TranslationParams = Record<string, string | number>

let service: LocaleLike | undefined
let bound: ((key: string) => string) | undefined
let observed: string | undefined
let revision = 0
const listeners = new Set<() => void>()

function notify(): void {
  revision += 1
  for (const listener of listeners) listener()
}

/** Subscribe to language changes; `useSyncExternalStore` drives the panel. */
export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A counter that changes whenever the active language does. */
export function localeRevision(): number {
  return revision
}

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
export function useLocaleRevision(): number {
  return useSyncExternalStore(subscribeToLocale, localeRevision, localeRevision)
}

/**
 * Narrow a BCP 47 tag to one of the two dictionaries we carry.
 *
 * `zh`, `zh-CN`, `zh-Hant` are Chinese; everything else reads English, which is
 * what dsh itself falls back to. Pure, so the rule is testable without a DOM.
 *
 * @param tag - a language tag, or undefined when nothing named one.
 * @returns which dictionary to read.
 */
export function resolveLanguage(tag: string | undefined): 'zh' | 'en' {
  return tag !== undefined && tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/** The document's declared language, when there is a document. */
function documentLanguage(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const tag = document.documentElement?.getAttribute('lang')
  return typeof tag === 'string' && tag.length > 0 ? tag : undefined
}

/** The browser's first preferred language, when there is a browser. */
function browserLanguage(): string | undefined {
  if (typeof navigator === 'undefined') return undefined
  const preferred = navigator.languages?.[0] ?? navigator.language
  return typeof preferred === 'string' && preferred.length > 0 ? preferred : undefined
}

/** Which language the panel is reading right now. */
export function activeLanguage(): 'zh' | 'en' {
  return resolveLanguage(observed ?? documentLanguage() ?? browserLanguage())
}

/** Substitute `{name}` placeholders; a placeholder with no value is left alone. */
function fill(text: string, params: TranslationParams): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

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
export function t(key: MessageKey, params?: TranslationParams): string {
  const text = bound?.(key) ?? MESSAGES[activeLanguage()][key] ?? MESSAGES.en[key] ?? key
  return params === undefined ? text : fill(text, params)
}

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
export function kindLabel(kind: Kind): string {
  return t(`kind.${kind}` as MessageKey)
}

/** The panel's word for a category; see {@link kindLabel} for the why. */
export function categoryLabel(category: Category): string {
  return t(`category.${category}` as MessageKey)
}

/** The panel's badge for who judged a category (规则判定 / 模型判定 / 手动判定). */
export function sourceLabel(source: CategorySource): string {
  return t(`source.${source}` as MessageKey)
}

/** One sentence explaining what that badge implies. */
export function sourceHint(source: CategorySource): string {
  return t(`source.${source}.hint` as MessageKey)
}

/**
 * Why a link never got a name.
 *
 * The host stores a machine-readable code (`http:403`, `no-title`, …) — never a
 * sentence, and deliberately not in the host's language — so the panel can say
 * it in the reader's.
 *
 * @param code - the stored `linkTitleError`, or undefined when there is none.
 * @returns a sentence, or undefined when there is nothing to explain.
 */
export function titleMissReason(code: string | undefined): string | undefined {
  if (code === undefined || code.length === 0) return undefined
  if (code.startsWith('http:')) return t('link.http', { status: code.slice('http:'.length) })
  if (code.startsWith('not-html:')) return t('link.notHtml')
  if (code.startsWith('network:')) return t('link.unreachable')
  if (code === 'no-title') return t('link.noTitle')
  return t('link.unknown')
}

/**
 * Follow `<html lang>` for compositions that ship no locale service.
 *
 * @returns the disposer that stops watching.
 */
function observeDocument(): () => void {
  observed = documentLanguage()
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(() => {
    const next = documentLanguage()
    if (next === observed) return
    observed = next
    notify()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  return () => {
    observer.disconnect()
  }
}

/**
 * Hook the panel's copy up to dsh's language.
 *
 * Called once from the browser half's `apply`, before any panel renders.
 *
 * @param ctx - the browser plugin context.
 */
export function installLocale(ctx: Context): void {
  const locale = ctx.get('locale') as LocaleLike | undefined
  if (locale === undefined) {
    ctx.effect(() => observeDocument(), 'dsh-inbox: follow <html lang>')
    return
  }
  service = locale
  ctx.effect(() => locale.register(MESSAGES_NS, 'zh', MESSAGES.zh), 'dsh-inbox: zh dictionary')
  ctx.effect(() => locale.register(MESSAGES_NS, 'en', MESSAGES.en), 'dsh-inbox: en dictionary')
  bound = locale.bind(MESSAGES_NS)
  observed = locale.getSnapshot().active
  ctx.effect(
    () =>
      locale.subscribe(() => {
        observed = locale.getSnapshot().active
        notify()
      }),
    'dsh-inbox: language changes',
  )
}

/** Whether the host's locale service took our dictionaries (for diagnostics). */
export function localeServiceBound(): boolean {
  return service !== undefined
}
