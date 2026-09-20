/**
 * Pushing by itself, a few seconds after the user stops typing.
 *
 * The rule the user asked for: 入库后防抖自动推 — file something, and a moment
 * later it is in the cloud, without anyone pressing anything. The debounce is
 * what makes that bearable for the remote and for the user: pasting five things
 * in a row is *one* push five seconds after the last one, not five pushes.
 *
 * Its failures are deliberately quiet. A background nicety must never turn a
 * successful paste into an error toast, and the panel's 刷新 button reports the
 * same push when the user presses it — so a broken remote is still visible the
 * moment anyone looks.
 */

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Context } from '@deepseek-ai/cordis'

import type { Vault } from '../vault/vault.js'
import { pushRemote } from './push.js'

/** How long the vault stays quiet before it pushes. */
export const AUTO_PUSH_DELAY_MS = 5_000

/** The real push, injectable so the debounce can be tested without a server. */
export type PushNow = () => Promise<unknown>

/**
 * One debouncer per process.
 *
 * A module-level timer rather than one per call site: the point is that five
 * pastes produce one push, and per-call-site timers would produce five.
 */
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Queue a push for a moment from now, replacing any push already queued.
 *
 * @param run - what to run; the real one is {@link makeAutoPush}.
 */
export function scheduleAutoPush(run: PushNow): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void run().catch(() => undefined)
  }, AUTO_PUSH_DELAY_MS)
  // Never hold the process open for a courtesy.
  timer.unref?.()
}

/** Forget a queued push; used by tests and by a clean shutdown. */
export function cancelAutoPush(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

/**
 * The push the debouncer runs, wired to a real vault.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes live.
 * @returns a function that pushes once.
 */
export function makeAutoPush(
  ctx: Context,
  vault: () => Vault | undefined,
  attachments: () => AttachmentStore | undefined,
): PushNow {
  return async () => {
    const open = vault()
    const store = attachments()
    if (open === undefined || store === undefined) return
    await pushRemote(ctx, open, store)
  }
}
