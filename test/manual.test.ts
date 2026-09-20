/**
 * The manual's copy, checked the way the user checked it.
 *
 * It is a dsh plugin: the words "Codex" and "skill" have no business in it, and
 * the first draft had both — the person reading it uses dsh, and telling them to
 * ask something called Codex is simply wrong. Markdown emphasis is the other
 * trap: `**名称**` renders as literal asterisks in JSX, which is how a "polished"
 * manual ends up looking broken.
 */

import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const SOURCE = new URL('../src/client/manual.tsx', import.meta.url)

async function text(): Promise<string> {
  return readFile(SOURCE, 'utf8')
}

describe('the panel manual', () => {
  it('never tells a dsh user to ask something called Codex', async () => {
    const source = await text()
    expect(source).not.toMatch(/Codex/i)
    expect(source).not.toMatch(/\bskill\b/i)
  })

  it('says how the conversation tools actually become visible', async () => {
    const source = await text()
    // The rule that bites: the tools are in the plugin, but the *assistant* only
    // sees them once the plugin is in the session's agent preset.
    expect(source).toContain('agent preset')
    expect(source).toContain('inbox_search')
    expect(source).toContain('inbox_get')
  })

  it('carries no markdown that JSX would print literally', async () => {
    const source = await text()
    // Comments are allowed to be emphatic; the *rendered* copy is not, and JSX
    // prints `**名称**` as four asterisks around a word.
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(withoutComments).not.toContain('**')
  })
})
