/**
 * A locale service the tests can reason about.
 *
 * The panel's copy lives behind `t()`, which reads whatever the host's locale
 * service hands it — so a test that asserts a sentence has to say which language
 * it is asserting. This installs a service that is honest rather than a stub:
 * the panel's own dictionaries go in through the same `register` call the
 * browser half makes, and lookups follow the host's documented rule (the active
 * language, then English, then the key itself).
 *
 * Left uninstalled, the panel reads English, which is what dsh itself falls back
 * to when a browser names no registered language — and which would make these
 * tests depend on the machine's own locale, the thing they must not do.
 */

import type { Context } from '@deepseek-ai/cordis'

import { installLocale } from '../../src/client/i18n.js'

/** Install the panel's copy for one language, as the host would. */
export function installLanguage(language: 'zh' | 'en'): void {
  const dictionaries = new Map<string, Record<string, string>>()
  const service = {
    register: (ns: string, locale: string, dict: Record<string, string>): (() => void) => {
      dictionaries.set(`${ns}:${locale}`, dict)
      return () => {}
    },
    bind:
      (ns: string) =>
      (key: string): string => {
        const active = service.getSnapshot().active
        return dictionaries.get(`${ns}:${active}`)?.[key] ?? dictionaries.get(`${ns}:en`)?.[key] ?? key
      },
    subscribe: (): (() => void) => () => {},
    getSnapshot: (): { active: string } => ({ active: language }),
  }
  const fake = {
    get: (name: string): unknown => (name === 'locale' ? service : undefined),
    effect: (callback: () => () => void): (() => void) => callback(),
  }
  installLocale(fake as unknown as Context)
}
