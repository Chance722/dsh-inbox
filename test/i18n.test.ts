/**
 * The panel's two languages.
 *
 * Three things are worth pinning. The dictionaries have to carry the **same
 * keys** — a key that exists in one language only is a hole that shows up as the
 * key itself on screen. The language rule has to be the host's rule. And the
 * client's own files must not hold Chinese copy any more: that is what makes
 * "the panel follows dsh's language" true rather than aspirational (dsh itself
 * enforces the same ownership with `verify-client-ui-i18n`).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MESSAGES, zh, type Dictionary } from '../src/client/messages.js'
import { resolveLanguage } from '../src/client/i18n.js'

/** Every file that renders copy, i.e. everything except the dictionaries. */
function clientUiFiles(): string[] {
  const root = 'src/client'
  return readdirSync(root)
    .filter((name) => /\.(ts|tsx)$/.test(name))
    .filter((name) => name !== 'messages.ts')
    .map((name) => join(root, name))
    .sort()
}

/**
 * The CJK string literals in a source file, ignoring comments.
 *
 * Deliberately a small scanner rather than a real parser: a literal that opens
 * and closes on one line is all this needs to catch, and a template literal
 * spanning several lines still ends at its closing backtick.
 *
 * @param source - the file's text.
 * @returns the literals that carry Chinese.
 */
function cjkLiterals(source: string): string[] {
  const found: string[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1
      index += 2
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      let cursor = index + 1
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2
          continue
        }
        if (source[cursor] === quote) break
        cursor += 1
      }
      const literal = source.slice(index, cursor + 1)
      if (/[\u3400-\u9fff]/.test(literal)) found.push(literal)
      index = cursor + 1
      continue
    }
    index += 1
  }
  return found
}

describe('the dictionaries', () => {
  it('carry exactly the same keys in both languages', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('leave no placeholder unfilled in either language', () => {
    const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '')
    const chinese: Dictionary = zh
    const english: Dictionary = MESSAGES.en
    for (const key of Object.keys(chinese)) {
      expect(placeholders(english[key] ?? ''), key).toEqual(placeholders(chinese[key] ?? ''))
    }
  })
})

describe('reading the language', () => {
  it('takes Chinese only when the tag says Chinese', () => {
    expect(resolveLanguage('zh')).toBe('zh')
    expect(resolveLanguage('zh-CN')).toBe('zh')
    expect(resolveLanguage('zh-Hant')).toBe('zh')
    expect(resolveLanguage('en-GB')).toBe('en')
    expect(resolveLanguage('ja')).toBe('en')
    expect(resolveLanguage(undefined)).toBe('en')
  })
})

describe('the client files', () => {
  it('hold no Chinese copy of their own', () => {
    const offenders: string[] = []
    for (const file of clientUiFiles()) {
      for (const literal of cjkLiterals(readFileSync(file, 'utf8'))) offenders.push(`${file}: ${literal}`)
    }
    expect(offenders).toEqual([])
  })
})
