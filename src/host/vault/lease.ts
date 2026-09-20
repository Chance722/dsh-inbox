/**
 * One vault per process, however many times this plugin gets loaded.
 *
 * dsh composes the plugin **twice**: the profile bundle gives the host half (the
 * panel needs it there), and the agent preset lists it again so a session's
 * assistant can see `inbox_search` / `inbox_get` — the tool registry is
 * per-session, so a plugin that is only in the profile is invisible to the
 * model. Two loads, one process, and `ctx.storageDomain` enforces **single-open
 * per domain name** (`DomainError: domain 'dsh_inbox' is already open`, thrown
 * from the facility's `reserved` set). The second instance therefore failed to
 * open and every tool it registered answered 「仓库没有打开」 — measured
 * 2026-09-20 in a real session, with the panel working fine at the same time
 * (that one was the profile instance, holding the domain).
 *
 * So the domain is a process resource, not a per-instance one. The first caller
 * opens it and becomes the owner; every later caller borrows the same {@link Vault}
 * and the last release closes it. Two consequences worth knowing:
 *
 * - **One vault, one key.** The panel's unlock and the conversation tools now
 *   share the in-memory key, which is what "unlock once" always meant.
 * - **The pull on open happens once per process**, for whoever opened it. Every
 *   later session starts against the same live data, and 「刷新」 is still the
 *   way to pull again.
 *
 * The registry lives on `globalThis` rather than module scope: two copies of the
 * package (a versioned install plus a linked checkout, say) would otherwise each
 * keep their own map and the collision would come back.
 */

import type { Context } from '@deepseek-ai/cordis'

import { Vault } from './vault.js'

/** Domain name; also the key this registry uses. */
const ENTRY = 'dsh_inbox'

/** One shared slot, plus how many consumers are currently holding it. */
interface Entry {
  /** Leases handed out and not yet released. */
  owners: number
  /** Settles when the open attempt finishes; never rejects. */
  opening: Promise<void>
  vault?: Vault
  /** Why the last open attempt failed, kept for the status tool to report. */
  error?: string
}

/** The slice of `globalThis` this module owns. */
interface Scope {
  __dshInboxVaults?: Map<string, Entry>
}

/**
 * A consumer's claim on the process's vault.
 *
 * `current` is undefined while the domain is still loading and stays undefined
 * when the open failed — a caller must report that, not pretend the vault is
 * empty.
 */
export interface VaultLease {
  /** The vault, once it is open. */
  current(): Vault | undefined
  /** The failure message, when the open attempt ended badly. */
  failure(): string | undefined
  /** Give the claim back; the last one out closes the vault. */
  release(): Promise<void>
}

/** The shared registry, created on first use. */
function registryOf(): Map<string, Entry> {
  const scope = globalThis as unknown as Scope
  return (scope.__dshInboxVaults ??= new Map())
}

/**
 * Claim the process's vault, opening it if this is the first claim.
 *
 * @param ctx - host context carrying the storage domain facility.
 * @param onOpened - called once, by the instance that actually opened the
 *   domain (the first one), for work that belongs to "the vault just came up".
 * @returns the lease; the caller releases it from its own disposer.
 */
export function leaseVault(ctx: Context, onOpened?: (vault: Vault) => void): VaultLease {
  const store = registryOf()
  const live = store.get(ENTRY)
  if (live !== undefined) {
    live.owners += 1
    return leaseOf(live, store)
  }

  const entry: Entry = { owners: 1, opening: Promise.resolve() }
  store.set(ENTRY, entry)
  entry.opening = Vault.open(ctx).then(
    (vault) => {
      entry.vault = vault
      // Everybody let go while this was loading (a session that ended during
      // boot): nobody is left to use it, so close it and forget the slot.
      if (entry.owners === 0) {
        store.delete(ENTRY)
        void vault.close()
        return
      }
      onOpened?.(vault)
    },
    (error: unknown) => {
      // Leave no failed slot behind: a later load may well succeed (the panel's
      // instance and a session's instance are not in the same composition).
      if (store.get(ENTRY) === entry) store.delete(ENTRY)
      entry.error = error instanceof Error ? error.message : String(error)
    },
  )
  return leaseOf(entry, store)
}

/** Wrap one entry as a lease; shared by the opener and every borrower. */
function leaseOf(entry: Entry, store: Map<string, Entry>): VaultLease {
  return {
    current: () => entry.vault,
    failure: () => entry.error,
    release: async () => {
      entry.owners -= 1
      if (entry.owners > 0) return
      await entry.opening
      const vault = entry.vault
      entry.vault = undefined
      if (store.get(ENTRY) === entry) store.delete(ENTRY)
      await vault?.close()
    },
  }
}
