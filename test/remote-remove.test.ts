/**
 * Deleting on the remote what the user emptied out of the bin.
 *
 * The names matter here: a record owns its `.json` and its `.txt`, an attachment
 * owns its bytes under `<id>.<ext>`, its `.meta.json`, and the pre-extension
 * `<id>` that older versions wrote — the only pass that will ever clean those up.
 */

import { describe, expect, it } from 'vitest'

import { removeWith } from '../src/host/remote/remove.js'
import type { Attachment } from '../src/host/vault/spec.js'

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    storeId: 'sha256:abc',
    mime: 'image/jpeg',
    bytes: 100,
    createdAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  }
}

/** A writer that records the paths it was asked to remove. */
function remover(options: { fail?: (path: string) => boolean } = {}): {
  gone: string[]
  remove: (path: string) => Promise<void>
} {
  const gone: string[] = []
  return {
    gone,
    remove: async (path) => {
      if (options.fail?.(path) === true) throw new Error('HTTP 403 · read-only')
      gone.push(path)
    },
  }
}

describe('removeWith', () => {
  it('removes both objects of every record', async () => {
    const writer = remover()

    const outcome = await removeWith(writer, 'inbox/sync', {
      itemIds: ['11111111-1111-4111-8111-111111111111'],
      attachments: [],
    })

    expect(outcome).toEqual({ removed: 2, failures: [] })
    expect(writer.gone.sort()).toEqual([
      'inbox/sync/items/11111111-1111-4111-8111-111111111111.json',
      'inbox/sync/items/11111111-1111-4111-8111-111111111111.txt',
    ])
  })

  it('removes an attachment\u2019s bytes, its row, and the name older versions used', async () => {
    const writer = remover()

    await removeWith(writer, 'inbox/sync', {
      itemIds: [],
      attachments: [attachment({ filename: 'IMG_0001.jpg' })],
    })

    expect(writer.gone.sort()).toEqual([
      'inbox/sync/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'inbox/sync/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
      'inbox/sync/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.meta.json',
    ])
  })

  it('takes the extension from the file itself when there is one', async () => {
    const writer = remover()

    await removeWith(writer, 'inbox/sync', {
      itemIds: [],
      attachments: [attachment({ mime: 'application/octet-stream', filename: '报税表.xlsx' })],
    })

    expect(writer.gone).toContain(
      'inbox/sync/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.xlsx',
    )
  })

  it('keeps going when the remote refuses one of them', async () => {
    // A read-only share, or a policy that forbids DELETE: the other objects must
    // still go, and the caller must be able to say which one did not.
    const writer = remover({ fail: (path) => path.endsWith('.txt') })

    const outcome = await removeWith(writer, 'inbox/sync', {
      itemIds: ['11111111-1111-4111-8111-111111111111'],
      attachments: [],
    })

    expect(outcome.removed).toBe(1)
    expect(outcome.failures.join()).toContain('.txt')
    expect(outcome.failures.join()).toContain('read-only')
  })

  it('does nothing at all when nothing was removed locally', async () => {
    const writer = remover()
    expect(await removeWith(writer, 'inbox/sync', { itemIds: [], attachments: [] })).toEqual({
      removed: 0,
      failures: [],
    })
    expect(writer.gone).toEqual([])
  })
})
