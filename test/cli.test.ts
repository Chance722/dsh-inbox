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

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  chooseProfile,
  ensurePresetRow,
  isEntryPoint,
  listProfiles,
  missingPnpmMessage,
  parse,
  pnpmInstallAttempts,
  profileCreationAttempts,
} from '../src/cli.js'

/** A composition that already speaks for a couple of other plugins. */
const COMPOSITION = [
  '- id: tool-web',
  "  name: '@deepseek-ai/dsh-tool-web'",
  '',
  '# dsh-inbox: the vault tools',
  '- id: dsh-inbox',
  "  name: '@oldscope/dsh-inbox'",
  '',
].join('\n')

/** How many times our row appears; two would mean two loads of one plugin. */
const rows = (body: string): number => (body.match(/- id: dsh-inbox/g) ?? []).length

describe('dsh-inbox init arguments', () => {
  it('leaves the profile to be detected when one was not named', () => {
    expect(parse(['init'])).toEqual({
      profile: undefined,
      preset: 'inbox',
      source: '@chance722/dsh-inbox',
      defaultPreset: true,
      createProfile: false,
      installPnpm: false,
    })
    // The command word is optional: the README shows it, `npx` may drop it.
    expect(parse([])?.profile).toBeUndefined()
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
        'C:\\repo\\dsh-inbox',
        '--no-default',
        '--create-profile',
        '--install-pnpm',
      ]),
    ).toEqual({
      profile: 'web',
      preset: 'mine',
      source: 'C:\\repo\\dsh-inbox',
      defaultPreset: false,
      createProfile: true,
      installPnpm: true,
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

describe('which profile to install into', () => {
  it('uses the profile it was given, whatever else is on the machine', () => {
    expect(chooseProfile({ profile: 'work', createProfile: false }, ['web', 'work'])).toEqual({
      kind: 'use',
      profile: 'work',
      label: '',
    })
  })

  it('prefers web — the profile `dsh web` already starts', () => {
    const choice = chooseProfile({ profile: undefined, createProfile: false }, ['alpha', 'web'])
    expect(choice).toMatchObject({ kind: 'use', profile: 'web' })
  })

  it('takes the only profile when there is exactly one', () => {
    const choice = chooseProfile({ profile: undefined, createProfile: false }, ['solo'])
    expect(choice).toMatchObject({ kind: 'use', profile: 'solo' })
  })

  it('creates web from the shipped template on a machine with no profiles', () => {
    const choice = chooseProfile({ profile: undefined, createProfile: true }, [])
    expect(choice).toMatchObject({ kind: 'use', profile: 'web' })
  })

  it('refuses to guess on a machine with nothing to guess from', () => {
    const choice = chooseProfile({ profile: undefined, createProfile: false }, [])
    expect(choice.kind).toBe('refuse')
    // The refusal has to carry the way out, or it is just a dead end.
    expect(choice.kind === 'refuse' ? choice.message : '').toMatch(/--create-profile/)
  })

  it('asks instead of picking when several profiles and no web exist', () => {
    const choice = chooseProfile({ profile: undefined, createProfile: false }, ['alpha', 'beta'])
    expect(choice.kind).toBe('refuse')
    const message = choice.kind === 'refuse' ? choice.message : ''
    expect(message).toContain('alpha')
    expect(message).toContain('beta')
    expect(message).toMatch(/--profile/)
  })
})

describe('reading the machine', () => {
  it('counts a directory as a profile only when the dsh package.json sits in it', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-inbox-profiles-'))
    try {
      for (const name of ['web', 'inbox']) {
        mkdirSync(join(root, 'profiles', name), { recursive: true })
        writeFileSync(join(root, 'profiles', name, 'package.json'), '{}')
      }
      // The store pnpm keeps next to the profiles is not one of them.
      mkdirSync(join(root, 'profiles', 'node_modules', '@deepseek-ai'), { recursive: true })
      expect(listProfiles(root)).toEqual(['inbox', 'web'])
      expect(listProfiles(join(root, 'nothing-here'))).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('creating a missing profile', () => {
  it('tries the web template first, then the bare form dsh asks for', () => {
    // Measured on a fresh %DSH_HOME% before 0.2.0 shipped: `web` is a *shipped*
    // template, and `--from-default-profile web` refuses it with
    // "profile \"web\" is shipped and cannot be a custom profile target" — so
    // the retry is what makes `init --profile web --create-profile` work at all.
    const attempts = profileCreationAttempts('web')
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toContain('--from-default-profile')
    expect(attempts[1]).not.toContain('--from-default-profile')
    expect(attempts.every((args) => args.includes('--dump-config'))).toBe(true)
    // A custom name keeps the same shape: the template, then the bare form.
    expect(profileCreationAttempts('inbox')[0]).toEqual([
      '--profile',
      'inbox',
      '--from-default-profile',
      'web',
      '--dump-config',
    ])
  })
})

describe('a machine without pnpm', () => {
  it('says what is missing, why, and how to fix it', () => {
    // dsh's `plugin add` forwards to pnpm, so the raw failure is cmd's
    // "'pnpm' is not recognized" arriving after the profile was made. The
    // message has to stand on its own: what, why, and the command to run.
    const message = missingPnpmMessage('web', '@chance722/dsh-inbox')
    expect(message).toContain('pnpm')
    expect(message).toContain('npm i -g pnpm')
    // …including the flag that does it for you, which is the one-liner the
    // README leads with.
    expect(message).toContain('--install-pnpm')
    expect(message).toContain('dsh plugin --profile web add @chance722/dsh-inbox')
  })

  it('prefers npm, then falls back to corepack', () => {
    // npm is what ran `npx`, and its global shims are already on PATH;
    // corepack is the no-download fallback for Nodes that still ship it.
    expect(pnpmInstallAttempts()).toEqual([
      ['npm', 'i', '-g', 'pnpm'],
      ['corepack', 'enable', 'pnpm'],
    ])
  })
})

describe('running as a program', () => {
  it('recognises itself through a junction, which is how pnpm installs it', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-inbox-entry-'))
    try {
      const real = join(root, 'real')
      mkdirSync(real, { recursive: true })
      const file = join(real, 'cli.js')
      writeFileSync(file, '// not the installer\n')
      const linked = join(root, 'linked')
      symlinkSync(real, linked, 'junction')

      const moduleUrl = pathToFileURL(file).href
      expect(isEntryPoint(moduleUrl, file)).toBe(true)
      // The bug this pins down: `import.meta.url` is the real path while
      // argv[1] keeps the junction path, so comparing the URLs directly said
      // "not me" and the installer exited 0 without doing anything.
      expect(isEntryPoint(moduleUrl, join(linked, 'cli.js'))).toBe(true)
      expect(isEntryPoint(moduleUrl, join(real, 'something-else.js'))).toBe(false)
      expect(isEntryPoint(moduleUrl, undefined)).toBe(false)
      expect(isEntryPoint(moduleUrl, '/no/such/file.js')).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
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
    const body = COMPOSITION.replace('@oldscope/dsh-inbox', '@chance722/dsh-inbox')
    const outcome = ensurePresetRow(body)
    expect(outcome.change).toBe('unchanged')
    expect(outcome.body).toBe(body)
  })

  it('renames a row left over from an older package name instead of adding a second one', () => {
    // The trap: the package was renamed, so matching by name would say "not
    // there" and append a row pointing at a package that no longer resolves.
    const outcome = ensurePresetRow(COMPOSITION)
    expect(outcome.change).toBe('renamed')
    expect(outcome.from).toBe('@oldscope/dsh-inbox')
    expect(outcome.body).toContain("name: '@chance722/dsh-inbox'")
    expect(outcome.body).not.toContain('@oldscope/dsh-inbox')
    expect(rows(outcome.body)).toBe(1)
    // Everything else in the file is untouched.
    expect(outcome.body).toContain("name: '@deepseek-ai/dsh-tool-web'")
  })

  it('copes with the quoting styles YAML allows', () => {
    for (const line of ['  name: @oldscope/dsh-inbox', '  name: "@oldscope/dsh-inbox"']) {
      const outcome = ensurePresetRow(`- id: dsh-inbox\n${line}\n`)
      expect(outcome.change).toBe('renamed')
      expect(outcome.body).toContain('@chance722/dsh-inbox')
      expect(outcome.body).not.toContain('@oldscope/dsh-inbox')
    }
  })
})
