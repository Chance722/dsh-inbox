/**
 * The two things DSH STORE reads out of this repository, pinned as tests.
 *
 * The marketplace's submission precheck treats the bundle patch as text (one
 * regex, no YAML parse) and the manifest as data, and its verdict decides
 * whether the plugin is listed at all: a patch that binds `name:` to the
 * official namespace is a hard `SUBMISSION_PATCH_PROTECTED` failure, and a
 * manifest with no exact `compatible` release in the newest three dsh versions
 * gets its candidate pruned. Both rules are silent — the automation contacts an
 * author once, ever, and then only updates the marketplace — so this file is
 * the cheap local guard instead of finding out months later.
 *
 * It also pins what the override is *for*: the browser-shaped fetch identity in
 * `docs/help/link-title-fetch.md` survives only while that row is still here.
 * Mechanics and measurements: `docs/help/dsh-store-submission.md`.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/** The precheck's own patterns, copied rather than paraphrased. */
const NAMED_OFFICIAL_ROW = /\bname:\s*['"]?@deepseek-ai\//i
const NAMES_OFFICIAL_ROW = /@deepseek-ai\//
const DISABLED_TRUE = /disabled:\s*true/i
const ENTRY_ID = /(?:^|\n)\s*- id:\s*['"]?([A-Za-z0-9][A-Za-z0-9._-]{0,95})['"]?\s*(?:\n|$)/g
/** Ids the store refuses outright, whichever package ships them. */
const PROTECTED_ENTRY_IDS = new Set(['ui-settings-plugin-inventory', 'dsh-safe-plugin-manager'])

const patch = readFileSync('cordis.patch.yml', 'utf8')
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const compatibility = manifest.dsh?.compatibility ?? {}
const releases: Record<string, string> = compatibility.dshReleases ?? {}

describe('the bundle patch, as the precheck scans it', () => {
  it('never binds a row name to the official namespace', () => {
    expect(patch).not.toMatch(NAMED_OFFICIAL_ROW)
  })

  it('never disables an official component', () => {
    expect(NAMES_OFFICIAL_ROW.test(patch) && DISABLED_TRUE.test(patch)).toBe(false)
  })

  it('declares our own entry id and no protected one', () => {
    const ids = [...patch.matchAll(ENTRY_ID)].map((match) => match[1] ?? '')
    expect(ids).toContain('dsh-inbox')
    expect(ids.filter((id) => PROTECTED_ENTRY_IDS.has(id))).toEqual([])
  })

  it('still overrides the fetch identity the link-title fetch depends on', () => {
    expect(patch).toMatch(/\n- id: web-fetch-http\n/)
    expect(patch).toMatch(/userAgent: 'Mozilla\/5\.0 [^\n]*dsh-inbox Safari/)
  })
})

describe('the compatibility the manifest declares', () => {
  it('gives every listed release an exact verdict', () => {
    const entries = Object.entries(releases)
    expect(entries.length).toBeGreaterThan(0)
    for (const [version, status] of entries) {
      // Full SemVer only: the store rejects the historical `rc.N` shorthand,
      // where two release lines would collide on the same key.
      expect(version).toMatch(/^\d+\.\d+\.\d+-[0-9A-Za-z.]+$/)
      expect(['compatible', 'incompatible', 'unknown']).toContain(status)
    }
  })

  it('keeps at least one release compatible, or the listing is withdrawn', () => {
    expect(Object.values(releases)).toContain('compatible')
  })

  it('states the same DSH range the install gate enforces', () => {
    const ranges = new Set(
      Object.entries(manifest.peerDependencies as Record<string, string>)
        .filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
        .map(([, range]) => range),
    )
    expect(ranges.size).toBe(1)
    expect([...ranges][0]).toBe(compatibility.dsh)
  })

  it('states the Node range the vault storage needs', () => {
    expect(manifest.engines?.node).toBe('>=22')
  })
})
