/**
 * The manual's copy, checked the way the user checked it.
 *
 * It is a dsh plugin: the words "Codex" and "skill" have no business in it, and
 * the first draft had both — the person reading it uses dsh, and telling them to
 * ask something called Codex is simply wrong. Markdown emphasis is the other
 * trap: `**名称**` renders as literal asterisks in JSX, which is how a "polished"
 * manual ends up looking broken.
 *
 * The copy lives in `src/client/messages.ts` now (the page follows dsh's
 * language), so the checks moved with it — and they now cover both languages,
 * which is the point of having them.
 */

import { describe, expect, it } from 'vitest'

import { MESSAGES } from '../src/client/messages.js'

/** Every line of the manual, in both languages. */
function manualCopy(): string {
  const lines: string[] = []
  for (const dict of [MESSAGES.zh, MESSAGES.en] as Record<string, string>[]) {
    for (const [key, value] of Object.entries(dict)) {
      if (key.startsWith('manual.')) lines.push(value)
    }
  }
  return lines.join('\n')
}

describe('the panel manual', () => {
  it('never tells a dsh user to ask something called Codex', () => {
    expect(manualCopy()).not.toMatch(/Codex/i)
    expect(manualCopy()).not.toMatch(/\bskill\b/i)
  })

  it('says how the conversation tools actually become visible', () => {
    // The rule that bites: the panel works as soon as the plugin is installed,
    // but the *assistant* only sees the tools in a session that carries the
    // plugin — and that has to be said in the user's words, not in preset jargon.
    expect(MESSAGES.zh['manual.6.tools.body']).toContain('没带上收件箱插件')
    expect(MESSAGES.zh['manual.6.tools.body']).toContain('新开一个会话')
    expect(MESSAGES.en['manual.6.tools.body']).toContain('new session')
    // No internal milestones or tool names the reader never typed: the manual
    // says "ask your assistant", not "call inbox_search".
    const copy = manualCopy()
    expect(copy).not.toMatch(/M\d/)
    expect(copy).not.toContain('init')
  })

  it('carries no markdown that JSX would print literally', () => {
    // JSX prints `**名称**` as four asterisks around a word.
    expect(manualCopy()).not.toContain('**')
  })
})
