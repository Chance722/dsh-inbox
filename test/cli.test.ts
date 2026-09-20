/**
 * The installer's argument parsing.
 *
 * The installer itself writes into someone's `~/.dsh`, so the tests stay on the
 * parser: defaults, the flags the README documents, and the refusals (unknown
 * flag, missing value, a preset id that would not be a directory-safe name).
 * `--create-profile` is here because it is the difference between "one command
 * installs it" being true and being true only for people who already have the
 * profile.
 */

import { describe, expect, it } from 'vitest'

import { ensurePresetRow, parse } from '../src/cli.js'

/** A composition that already speaks for a couple of other plugins. */
const COMPOSITION = [
  '- id: tool-web',
  "  name: '@deepseek-ai/dsh-tool-web'",
  '',
  '# dsh-inbox: the vault tools',
  '- id: dsh-inbox',
  "  name: '@duoyu/dsh-inbox'",
  '',
].join('\n')

/** How many times our row appears; two would mean two loads of one plugin. */
const rows = (body: string): number => (body.match(/- id: dsh-inbox/g) ?? []).length

describe('dsh-inbox init arguments', () => {
  it('installs into the inbox profile by default', () => {
    expect(parse(['init'])).toEqual({
      profile: 'inbox',
      preset: 'inbox',
      source: '@chance722/dsh-inbox',
      defaultPreset: true,
      createProfile: false,
    })
    // The command word is optional: the README shows it, `npx` may drop it.
    expect(parse([])?.profile).toBe('inbox')
  })

  it('reads every documented flag', () => {
    expect(
      parse([
        'init',
        '--profile',
        'web',
        '--preset',
        'mine',
        '--package',
        'D:\\Workspace\\dsh-inbox',
        '--no-default',
        '--create-profile',
      ]),
    ).toEqual({
      profile: 'web',
      preset: 'mine',
      source: 'D:\\Workspace\\dsh-inbox',
      defaultPreset: false,
      createProfile: true,
    })
  })

  it('does not create a profile unless it was asked to', () => {
    // The flag is what lets the installer run on a fresh machine; without it a
    // mistyped profile name must stay an error.
    expect(parse(['init', '--profile', 'web2'])?.createProfile).toBe(false)
    expect(parse(['init', '--create-profile'])?.createProfile).toBe(true)
  })

  it('asks for help by returning nothing to do', () => {
    expect(parse(['--help'])).toBeUndefined()
    expect(parse(['init', '-h'])).toBeUndefined()
  })

  it('refuses what it cannot act on', () => {
    expect(() => parse(['--mystery'])).toThrow(/看不懂的选项/)
    expect(() => parse(['--profile'])).toThrow(/需要一个值/)
    expect(() => parse(['--preset'])).toThrow(/需要一个值/)
    // A preset id becomes a directory name under `~/.dsh/.agent-presets`.
    expect(() => parse(['--preset', 'Inbox 2'])).toThrow(/preset id/)
    expect(() => parse(['--preset', '../evil'])).toThrow(/preset id/)
  })
})

describe('the preset row', () => {
  it('adds the row when the preset has never heard of us', () => {
    const outcome = ensurePresetRow('- id: tool-web\n')
    expect(outcome.change).toBe('added')
    expect(outcome.body).toContain("- id: dsh-inbox\n  name: '@chance722/dsh-inbox'")
    expect(rows(outcome.body)).toBe(1)
  })

  it('leaves the file alone when the row already points at the package', () => {
    const body = COMPOSITION.replace('@duoyu/dsh-inbox', '@chance722/dsh-inbox')
    const outcome = ensurePresetRow(body)
    expect(outcome.change).toBe('unchanged')
    expect(outcome.body).toBe(body)
  })

  it('renames a row left over from the old package instead of adding a second one', () => {
    // The trap: the package was renamed, so matching by name would say "not
    // there" and append a row pointing at a package that no longer resolves.
    const outcome = ensurePresetRow(COMPOSITION)
    expect(outcome.change).toBe('renamed')
    expect(outcome.from).toBe('@duoyu/dsh-inbox')
    expect(outcome.body).toContain("name: '@chance722/dsh-inbox'")
    expect(outcome.body).not.toContain('@duoyu/dsh-inbox')
    expect(rows(outcome.body)).toBe(1)
    // Everything else in the file is untouched.
    expect(outcome.body).toContain("name: '@deepseek-ai/dsh-tool-web'")
  })

  it('copes with the quoting styles YAML allows', () => {
    for (const line of ['  name: @duoyu/dsh-inbox', '  name: "@duoyu/dsh-inbox"']) {
      const outcome = ensurePresetRow(`- id: dsh-inbox\n${line}\n`)
      expect(outcome.change).toBe('renamed')
      expect(outcome.body).toContain('@chance722/dsh-inbox')
      expect(outcome.body).not.toContain('@duoyu/dsh-inbox')
    }
  })
})
