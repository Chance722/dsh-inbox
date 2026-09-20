/**
 * Pushing by itself.
 *
 * The rule is "a few seconds after the user stops typing, and once" — so the
 * tests are about the debounce, not about the push: five pastes are one push,
 * and a push that fails must not throw into the paste that scheduled it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AUTO_PUSH_DELAY_MS,
  cancelAutoPush,
  scheduleAutoPush,
} from '../src/host/remote/auto-push.js'

afterEach(() => {
  cancelAutoPush()
  vi.useRealTimers()
})

describe('scheduleAutoPush', () => {
  it('waits, then pushes once', async () => {
    vi.useFakeTimers()
    let calls = 0
    scheduleAutoPush(async () => {
      calls += 1
    })

    expect(calls).toBe(0)
    await vi.advanceTimersByTimeAsync(AUTO_PUSH_DELAY_MS - 1)
    expect(calls).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toBe(1)
  })

  it('collapses a burst into one push, timed from the last change', async () => {
    vi.useFakeTimers()
    let calls = 0
    const push = async (): Promise<void> => {
      calls += 1
    }

    // Five pastes, a second apart: the vault is quiet for 5s only after the
    // fifth, so the remote sees one push, not five.
    for (let index = 0; index < 5; index += 1) {
      scheduleAutoPush(push)
      await vi.advanceTimersByTimeAsync(1_000)
    }
    expect(calls).toBe(0)

    await vi.advanceTimersByTimeAsync(AUTO_PUSH_DELAY_MS)
    expect(calls).toBe(1)
  })

  it('swallows a failed push instead of throwing into the paste', async () => {
    vi.useFakeTimers()
    const push = vi.fn(async () => {
      throw new Error('远端离线')
    })

    scheduleAutoPush(push)
    // The rejection is swallowed inside the debouncer: a paste that happened to
    // trigger a push to a dead remote must not surface as an error anywhere.
    await vi.advanceTimersByTimeAsync(AUTO_PUSH_DELAY_MS)
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('forgets a queued push when asked (shutdown, or a test)', async () => {
    vi.useFakeTimers()
    let calls = 0
    scheduleAutoPush(async () => {
      calls += 1
    })
    cancelAutoPush()

    await vi.advanceTimersByTimeAsync(AUTO_PUSH_DELAY_MS * 2)
    expect(calls).toBe(0)
  })
})
