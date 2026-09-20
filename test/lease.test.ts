/**
 * One vault per process.
 *
 * The bug this pins, in the user's words: the panel worked, and the assistant's
 * tools all answered 「仓库没有打开」 with `domain 'dsh_inbox' is already open`,
 * because dsh had loaded the plugin twice (profile bundle + agent preset) and
 * the storage facility allows one open per domain name.
 *
 * The tests run against the real storage stack, like `vault.test.ts`, so the
 * single-open rule being fought here is the real one — including one test that
 * does the raw `open` twice to show the collision is still there underneath.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { leaseVault, type VaultLease } from '../src/host/vault/lease.js'
import { vaultSpec } from '../src/host/vault/spec.js'

let root: string
let ctx: Context
let opens: number

/** Wait for a lease's open attempt to settle, the way a tool call would. */
async function ready(lease: VaultLease): Promise<void> {
  await vi.waitFor(() => {
    expect(lease.current() ?? lease.failure()).toBeDefined()
  })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-lease-'))
  ctx = new Context()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  // Count the opens the facility is actually asked for: "loaded twice" must not
  // mean "opened twice".
  opens = 0
  const facility = ctx.storageDomain
  const open = facility.open.bind(facility)
  facility.open = (spec) => {
    opens += 1
    return open(spec)
  }
})

afterEach(async () => {
  await ctx.storageDomain.closeAll()
  await rm(root, { recursive: true, force: true })
})

describe('the process-wide vault lease', () => {
  it('opens once for two loads and hands both the same vault', async () => {
    const panel = leaseVault(ctx)
    await ready(panel)
    const session = leaseVault(ctx)

    expect(opens).toBe(1)
    expect(session.current()).toBe(panel.current())

    await panel.release()
    await session.release()
  })

  it('shows the collision underneath, so the reason for the lease stays visible', async () => {
    const lease = leaseVault(ctx)
    await ready(lease)

    // The raw call a second instance used to make.
    await expect(ctx.storageDomain.open(vaultSpec)).rejects.toThrow(/already open/)

    await lease.release()
  })

  it('runs the "vault just came up" work for the opener only', async () => {
    let pulls = 0
    const panel = leaseVault(ctx, () => {
      pulls += 1
    })
    await ready(panel)
    const session = leaseVault(ctx, () => {
      pulls += 1
    })
    await ready(session)

    // One pull per process: a session that borrows a live vault does not drag
    // the remote again on top of the one the panel's instance already ran.
    expect(pulls).toBe(1)

    await panel.release()
    await session.release()
  })

  it('keeps the vault alive until the last holder lets go', async () => {
    const panel = leaseVault(ctx)
    await ready(panel)
    const session = leaseVault(ctx)
    await ready(session)

    await panel.release()

    // The session is still working: one holder leaving must not close a domain
    // another one is reading.
    const opened = session.current()
    expect(opened).toBeDefined()
    await opened?.create({ kind: 'text', category: 'idea', source: 'panel', text: 'a' })
    expect(opened?.size).toBe(1)

    await session.release()
    expect(ctx.storageDomain.get('dsh_inbox')).toBeUndefined()
  })

  it('lets a later load open the domain again once everyone is gone', async () => {
    const panel = leaseVault(ctx)
    await ready(panel)
    await panel.current()?.create({ kind: 'text', category: 'idea', source: 'panel', text: 'b' })
    await panel.release()

    const next = leaseVault(ctx)
    await ready(next)

    expect(opens).toBe(2)
    // And the records were on disk, not in the handle.
    expect(next.current()?.size).toBe(1)

    await next.release()
  })

  it('reports a failed open and leaves no broken slot behind', async () => {
    const broken = {
      storageDomain: { open: () => Promise.reject(new Error('backend exploded')) },
    } as unknown as Context

    const failed = leaseVault(broken)
    await ready(failed)

    expect(failed.current()).toBeUndefined()
    expect(failed.failure()).toBe('backend exploded')
    await failed.release()

    // A later load must be able to try for real — the failure is not cached.
    const good = leaseVault(ctx)
    await ready(good)
    expect(good.current()).toBeDefined()
    expect(opens).toBe(1)

    await good.release()
  })
})
