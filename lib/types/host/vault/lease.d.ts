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
import type { Context } from '@deepseek-ai/cordis';
import { Vault } from './vault.js';
/**
 * A consumer's claim on the process's vault.
 *
 * `current` is undefined while the domain is still loading and stays undefined
 * when the open failed — a caller must report that, not pretend the vault is
 * empty.
 */
export interface VaultLease {
    /** The vault, once it is open. */
    current(): Vault | undefined;
    /** The failure message, when the open attempt ended badly. */
    failure(): string | undefined;
    /** Give the claim back; the last one out closes the vault. */
    release(): Promise<void>;
}
/**
 * Claim the process's vault, opening it if this is the first claim.
 *
 * @param ctx - host context carrying the storage domain facility.
 * @param onOpened - called once, by the instance that actually opened the
 *   domain (the first one), for work that belongs to "the vault just came up".
 * @returns the lease; the caller releases it from its own disposer.
 */
export declare function leaseVault(ctx: Context, onOpened?: (vault: Vault) => void): VaultLease;
