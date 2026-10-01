/**
 * The built plugin is tracked in git, so the bytes that ship are the bytes this
 * repository last built.
 *
 * That is the whole reason a GitHub-URL install works without asking the user
 * for anything: pnpm builds a git dependency only when its manifest carries a
 * non-empty `prepare`, and the alternative — every user allowing that build, in
 * a profile file, with a key that names the exact commit — is not an install
 * path; mechanisms in docs/help/dsh-plugin-platform.md. So this package has no
 * `prepare` and ships `lib/` instead.
 *
 * The cost of that choice is drift: edit `src/`, forget `pnpm build`, commit,
 * and every git install quietly serves the previous build. This is the guard —
 * it runs the same comparison a person would run by hand (`pnpm check:lib`),
 * and it is slow on purpose (~10s of esbuild and tsc) because it really does
 * rebuild into a scratch directory and compare with what is committed.
 */

import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

describe('the artifacts committed to git', () => {
  it('are a fresh build of src/, so no install has to build them', () => {
    const check = spawnSync(process.execPath, ['scripts/check-lib.mjs'], {
      encoding: 'utf8',
      timeout: 120_000,
    })
    const output = `${check.stdout ?? ''}${check.stderr ?? ''}`
    expect(output).toContain('matches a fresh build')
    expect(check.status).toBe(0)
  }, 150_000)
})
