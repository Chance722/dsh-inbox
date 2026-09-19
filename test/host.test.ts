import { describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/host/index.js'
import { MILESTONE, PACKAGE_NAME } from '../src/shared/constants.js'

/**
 * Stand-in for the Cordis context. `effect` deliberately never runs its
 * callback, so these tests cover the registration surface without opening a
 * domain — the vault itself is covered against the real storage stack in
 * `vault.test.ts`.
 */
function fakeContext() {
  const register = vi.fn()
  const effect = vi.fn(() => () => {})
  return {
    register,
    effect,
    ctx: {
      tools: { register },
      effect,
      storageDomain: { open: vi.fn() },
    } as never,
  }
}

describe('dsh-inbox host half', () => {
  it('does not depend on the tool registry by name collision', () => {
    expect(name).toBe('dsh-inbox')
    expect(inject).toEqual(['tools', 'storageDomain'])
  })

  it('registers exactly one model-facing tool', () => {
    const { register, ctx } = fakeContext()
    apply(ctx)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('reports package identity and milestone', async () => {
    const { register, ctx } = fakeContext()
    apply(ctx)

    const tool = register.mock.calls[0]?.[0] as {
      name: string
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    expect(tool.name).toBe('inbox_status')
    await expect(tool.execute({}, {})).resolves.toEqual({
      ok: true,
      package: PACKAGE_NAME,
      milestone: MILESTONE,
      vaultOpen: false,
      items: 0,
    })
  })
})
