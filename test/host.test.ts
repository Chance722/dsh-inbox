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
  const registerCommand = vi.fn()
  const effect = vi.fn(() => () => {})
  const inject = vi.fn()
  return {
    register,
    registerCommand,
    effect,
    inject,
    ctx: {
      get: () => undefined,
      tools: { register },
      commands: { register: registerCommand },
      effect,
      inject,
      storageDomain: { open: vi.fn() },
    } as never,
  }
}

describe('dsh-inbox host half', () => {
  it('does not depend on the tool registry by name collision', () => {
    expect(name).toBe('dsh-inbox')
    expect(inject).toEqual(['tools', 'commands', 'storageDomain'])
  })

  it('registers the vault tools the model may call', () => {
    const { register, ctx } = fakeContext()
    apply(ctx)
    const names = register.mock.calls.map(
      (call) => (call[0] as { name: string }).name,
    )
    expect(names).toEqual(['inbox_search', 'inbox_get', 'inbox_status'])
  })

  it('registers the /inbox command without recording its input', () => {
    const { registerCommand, ctx } = fakeContext()
    apply(ctx)
    expect(registerCommand).toHaveBeenCalledTimes(1)
    const definition = registerCommand.mock.calls[0]?.[0] as {
      name: string
      recordInput?: boolean
      input?: { attachments?: boolean }
    }
    expect(definition.name).toBe('inbox')
    expect(definition.recordInput).toBe(false)
    expect(definition.input?.attachments).toBe(true)
  })

  it('reports package identity and milestone through inbox_status', async () => {
    const { register, ctx } = fakeContext()
    apply(ctx)

    const tool = register.mock.calls
      .map((call) => call[0] as { name: string; execute: (a: unknown, e: unknown) => Promise<unknown> })
      .find((candidate) => candidate.name === 'inbox_status')
    if (tool === undefined) throw new Error('inbox_status was not registered')

    await expect(tool.execute({}, {})).resolves.toEqual({
      ok: true,
      package: PACKAGE_NAME,
      milestone: MILESTONE,
      vaultOpen: false,
      items: 0,
    })
  })
})
