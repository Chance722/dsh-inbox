/**
 * Taking another device's records in.
 *
 * The rules under test are the three the user chose: newer wins with no conflict
 * copies, deletes arrive as tombstones, and only the `.json` is read — the `.txt`
 * beside it is a view for people, not a source.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mergeOnce, type SyncTree } from '../src/host/remote/merge.js'
import type { Item } from '../src/host/vault/spec.js'
import { Vault } from '../src/host/vault/vault.js'

/** One `sync/` tree held in memory, exactly the shape the merge reads. */
function tree(files: Record<string, string | Uint8Array>): SyncTree {
  const entries = Object.entries(files).map(([path, body]) => ({
    path,
    body: typeof body === 'string' ? new TextEncoder().encode(body) : body,
  }))
  return {
    list: async (prefix) =>
      entries.filter((entry) => entry.path.startsWith(prefix)).map((entry) => ({ path: entry.path })),
    read: async (path) => {
      const found = entries.find((entry) => entry.path === path)
      if (found === undefined) throw new Error(`远端没有 ${path}`)
      return found.body
    },
  }
}

/** A record as the push would have packed it. */
function packed(record: Partial<Item> & { id: string; updatedAt: string }): string {
  return JSON.stringify({
    format: 'dsh-inbox-item/1',
    record: {
      kind: 'text',
      category: 'other',
      source: 'panel',
      createdAt: record.updatedAt,
      tags: [],
      attachmentIds: [],
      ...record,
    },
  })
}

/** Admission that says yes and hands back a deterministic store id. */
const admit = {
  image: async (bytes: Uint8Array, mime: string) => ({ storeId: `sha256:${mime}:${String(bytes.byteLength)}` }),
  file: async (bytes: Uint8Array, name: string) => ({ storeId: `file:${name}:${String(bytes.byteLength)}` }),
}

describe('mergeOnce', () => {
  let root: string
  let vault: Vault

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-inbox-merge-'))
    const ctx = new Context()
    await ctx.plugin(Storage).await()
    await ctx.plugin(storageJson, { root }).await()
    await ctx.plugin(storageDomain, { backend: 'json' }).await()
    vault = await Vault.open(ctx)
  })

  afterEach(async () => {
    await vault.close()
    await rm(root, { recursive: true, force: true })
  })

  it('takes in a record this machine has never seen, id and times intact', async () => {
    const remote = tree({
      'inbox/sync/items/11111111-1111-4111-8111-111111111111.json': packed({
        id: '11111111-1111-4111-8111-111111111111',
        updatedAt: '2026-09-20T05:00:00.000Z',
        text: '从手机存的',
        note: '备注也在',
      }),
    })

    const outcome = await mergeOnce(vault, remote, 'inbox/sync', admit)

    expect(outcome).toMatchObject({ merged: 1, kept: 0, attachments: 0, failures: [] })
    const imported = vault.get('11111111-1111-4111-8111-111111111111')
    expect(imported?.text).toBe('从手机存的')
    expect(imported?.note).toBe('备注也在')
    expect(imported?.createdAt).toBe('2026-09-20T05:00:00.000Z')
  })

  it('keeps the local copy when it is newer, and overwrites when the remote is', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    await vault.import({
      id,
      kind: 'text',
      category: 'other',
      source: 'panel',
      createdAt: '2026-09-20T01:00:00.000Z',
      updatedAt: '2026-09-20T06:00:00.000Z',
      tags: [],
      attachmentIds: [],
      text: '本地更新的版本',
    })

    const older = tree({ [`inbox/sync/items/${id}.json`]: packed({ id, updatedAt: '2026-09-20T05:00:00.000Z', text: '远端旧的' }) })
    expect(await mergeOnce(vault, older, 'inbox/sync', admit)).toMatchObject({ merged: 0, kept: 1 })
    expect(vault.get(id)?.text).toBe('本地更新的版本')

    const newer = tree({ [`inbox/sync/items/${id}.json`]: packed({ id, updatedAt: '2026-09-20T07:00:00.000Z', text: '远端更新的版本' }) })
    expect(await mergeOnce(vault, newer, 'inbox/sync', admit)).toMatchObject({ merged: 1, kept: 0 })
    expect(vault.get(id)?.text).toBe('远端更新的版本')
    // No conflict copy: the user's rule is "newer wins", not "keep both".
    expect(vault.size).toBe(1)
  })

  it('brings a deletion across as a tombstone', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    const remote = tree({
      [`inbox/sync/items/${id}.json`]: packed({
        id,
        updatedAt: '2026-09-20T05:00:00.000Z',
        text: '在另一台设备上删掉的',
        deletedAt: '2026-09-20T05:00:00.000Z',
      }),
    })

    await mergeOnce(vault, remote, 'inbox/sync', admit)

    expect(vault.list()).toHaveLength(0)
    expect(vault.getBin().map((item) => item.id)).toEqual([id])
  })

  it('fetches the attachments an imported record needs, row and all', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const attachmentId = '55555555-5555-4555-8555-555555555555'
    const remote = tree({
      [`inbox/sync/items/${id}.json`]: packed({
        id,
        updatedAt: '2026-09-20T05:00:00.000Z',
        kind: 'image',
        category: 'image',
        attachmentIds: [attachmentId],
      }),
      [`inbox/sync/attachments/${attachmentId}.meta.json`]: JSON.stringify({
        format: 'dsh-inbox-attachment/1',
        attachment: {
          id: attachmentId,
          mime: 'image/jpeg',
          bytes: 3,
          filename: 'IMG_9270.jpg',
          width: 3024,
          height: 4032,
          createdAt: '2026-09-20T04:00:00.000Z',
        },
      }),
      [`inbox/sync/attachments/${attachmentId}.jpg`]: new Uint8Array([1, 2, 3]),
    })

    const outcome = await mergeOnce(vault, remote, 'inbox/sync', admit)

    expect(outcome).toMatchObject({ merged: 1, attachments: 1 })
    const row = vault.getAttachment(attachmentId)
    expect(row).toMatchObject({ mime: 'image/jpeg', filename: 'IMG_9270.jpg', width: 3024, height: 4032 })
    // The store id is this machine's, the row id is the one the record points at.
    expect(row?.storeId).toBe('sha256:image/jpeg:3')
  })

  it('reads only the records, never the text views or folder markers', async () => {
    const id = '66666666-6666-4666-8666-666666666666'
    const remote = tree({
      'inbox/sync/items/': '',
      [`inbox/sync/items/${id}.txt`]: '一份给人看的视图，里面没有 format 字段',
      [`inbox/sync/items/${id}.json`]: packed({ id, updatedAt: '2026-09-20T05:00:00.000Z', text: '正文' }),
    })

    const outcome = await mergeOnce(vault, remote, 'inbox/sync', admit)

    expect(outcome).toMatchObject({ merged: 1, failures: [] })
    expect(vault.size).toBe(1)
  })

  it('reports the objects it cannot use, and keeps going', async () => {
    const good = '77777777-7777-4777-8777-777777777777'
    const remote = tree({
      [`inbox/sync/items/${good}.json`]: packed({ id: good, updatedAt: '2026-09-20T05:00:00.000Z', text: '好的' }),
      'inbox/sync/items/88888888-8888-4888-8888-888888888888.json': '{"format":"别的插件"}',
    })

    const outcome = await mergeOnce(vault, remote, 'inbox/sync', admit)

    expect(outcome.merged).toBe(1)
    expect(outcome.failures.join()).toContain('不是本插件的记录格式')
  })

  it('admits a pulled credential as ciphertext, with no key in sight', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    const remote = tree({
      [`inbox/sync/items/${id}.json`]: packed({
        id,
        updatedAt: '2026-09-20T05:00:00.000Z',
        category: 'secret',
        secret: 'v1:iv:tag:ciphertext',
        secretDigest: 'a'.repeat(64),
        note: '公司邮箱',
      }),
    })

    await mergeOnce(vault, remote, 'inbox/sync', admit)

    const imported = vault.get(id)
    expect(imported?.secret).toBe('v1:iv:tag:ciphertext')
    // Locked here, so it cannot be read — which is the point of pulling it
    // without a master password: the bytes travel, the meaning does not.
    expect(vault.secretText(imported!)).toBeUndefined()
  })
})
