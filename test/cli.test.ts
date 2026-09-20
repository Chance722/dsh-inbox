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

import { parse } from '../src/cli.js'

describe('dsh-inbox init arguments', () => {
  it('installs into the inbox profile by default', () => {
    expect(parse(['init'])).toEqual({
      profile: 'inbox',
      preset: 'inbox',
      source: '@duoyu/dsh-inbox',
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
