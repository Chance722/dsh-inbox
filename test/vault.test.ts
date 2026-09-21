/**
 * Exercise the vault against the real storage stack — the hub, the json
 * backend, and the domain form — rather than a hand-written fake, so the test
 * also pins the interface this plugin actually depends on at runtime.
 */

import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Vault } from '../src/host/vault/vault.js'

let root: string
let ctx: Context
let vault: Vault

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-test-'))
  ctx = new Context()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  vault = await Vault.open(ctx)
})

afterEach(async () => {
  await vault.close()
  await rm(root, { recursive: true, force: true })
})

describe('vault over the real storage domain', () => {
  it('files a record and reads it back', async () => {
    const created = await vault.create({
      kind: 'link',
      category: 'article',
      source: 'panel',
      url: 'https://mp.weixin.qq.com/s/abc',
      platform: 'wechat',
      title: '一篇公众号文章',
    })

    expect(created.watchLater).toBeUndefined()
    expect(created.tags).toEqual([])
    expect(vault.get(created.id)).toEqual(created)
    expect(vault.size).toBe(1)
  })

  it('writes one document per record in the per-record layout', async () => {
    await vault.create({ kind: 'text', category: 'idea', source: 'panel', text: 'a' })
    await vault.create({ kind: 'text', category: 'idea', source: 'panel', text: 'b' })

    const entries = await readdir(join(root, 'dsh_inbox'), { recursive: true })
    const documents = entries.filter((name) => name.endsWith('.json'))
    expect(documents).toHaveLength(2)
  })

  it('survives a reopen', async () => {
    const created = await vault.create({
      kind: 'text',
      category: 'secret',
      source: 'panel',
      text: 'secretid=AKIDexample',
    })
    await vault.close()

    vault = await Vault.open(ctx)
    expect(vault.get(created.id)?.text).toBe('secretid=AKIDexample')
  })

  it('opens a vault the previous domain version wrote', async () => {
    /*
      The version bump that added `graves` must not cost anybody their vault: a
      version-7 document is still one of ours, read as-is. Written by hand here
      because that is exactly what upgrade day looks like — the new code opening
      documents the old code left behind.
    */
    const id = '99999999-9999-4999-8999-999999999999'
    await vault.close()
    const dir = join(root, 'dsh_inbox', 'items')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, `${id}.json`),
      JSON.stringify({
        version: 7,
        record: {
          id,
          kind: 'text',
          category: 'other',
          source: 'panel',
          createdAt: '2026-09-19T06:00:00.000Z',
          updatedAt: '2026-09-19T06:00:00.000Z',
          text: '版本 7 写下的记录',
          tags: [],
          attachmentIds: [],
        },
      }),
    )

    vault = await Vault.open(ctx)
    expect(vault.get(id)?.text).toBe('版本 7 写下的记录')
    expect(vault.purgedAt(id)).toBeUndefined()
  })

  it('patches classification and the 待看 flag without dropping the other fields', async () => {
    const created = await vault.create({
      kind: 'image',
      category: 'image',
      source: 'panel',
      note: '看起来像证件照',
    })

    const patched = await vault.patch(created.id, { category: 'document', watchLater: true })
    expect(patched.category).toBe('document')
    expect(patched.watchLater).toBe(true)
    expect(patched.note).toBe('看起来像证件照')
    expect(patched.createdAt).toBe(created.createdAt)
  })

  it('soft-deletes and restores', async () => {
    const created = await vault.create({ kind: 'text', category: 'idea', source: 'panel' })

    await vault.softDelete(created.id)
    expect(vault.list().map((item) => item.id)).toEqual([])
    expect(vault.list({ includeDeleted: true }).map((item) => item.id)).toEqual([created.id])

    await vault.restore(created.id)
    expect(vault.list().map((item) => item.id)).toEqual([created.id])
    expect(vault.get(created.id)?.deletedAt).toBeUndefined()
  })

  it('empties a record out of the bin and leaves only a grave behind', async () => {
    const created = await vault.create({
      kind: 'text',
      category: 'other',
      source: 'panel',
      text: '清掉的那条',
    })
    await vault.softDelete(created.id)

    expect(await vault.purge(created.id)).toBe(true)
    expect(vault.get(created.id)).toBeUndefined()
    expect(vault.getBin()).toHaveLength(0)

    /*
      What is on disk matters as much as what is in memory: the record's own
      document is really gone (that is "emptied", not "deleted"), and the only
      thing left of it is an id and a moment — the grave that stops a copy in
      another sync tree from filing it back in.
    */
    const documents = await readdir(join(root, 'dsh_inbox'), { recursive: true })
    expect(documents).not.toContain(join('items', `${created.id}.json`))
    expect(documents).toContain(join('graves', `${created.id}.json`))
    expect(vault.purgedAt(created.id)).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Nothing to empty is a no-op, and it does not mint a grave out of nowhere.
    expect(await vault.purge(created.id)).toBe(false)
    expect(vault.purgedAt('11111111-1111-4111-8111-111111111111')).toBeUndefined()
  })

  it('keeps attachment metadata and the global slot', async () => {
    const record = await vault.addAttachment({ storeId: 'a1', mime: 'image/png', bytes: 12 })
    expect(vault.getAttachment(record.id)?.mime).toBe('image/png')
    expect(vault.findAttachmentByStoreId('a1')?.id).toBe(record.id)

    expect(vault.global.sync).toEqual({})
    await vault.setGlobal({ sync: { lastPullAt: '2026-09-19T00:00:00.000Z' } })
    expect(vault.global.sync.lastPullAt).toBe('2026-09-19T00:00:00.000Z')
  })

  it('refuses a patch to a record that does not exist', async () => {
    await expect(vault.patch('missing', { watchLater: true })).rejects.toThrow()
  })

  it('strips one tag from every record that carries it, and only that tag', async () => {
    const first = await vault.create({ kind: 'text', category: 'other', source: 'panel', tags: ['待看', '缓存'] })
    const second = await vault.create({ kind: 'text', category: 'other', source: 'panel', tags: ['缓存'] })
    const third = await vault.create({ kind: 'text', category: 'other', source: 'panel' })

    expect(await vault.removeTag('缓存')).toBe(2)
    expect(vault.get(first.id)?.tags).toEqual(['待看'])
    expect(vault.get(second.id)?.tags).toEqual([])
    expect(vault.get(third.id)?.tags).toEqual([])
    // Removing a tag nobody carries is a no-op, not an error.
    expect(await vault.removeTag('缓存')).toBe(0)
  })
})
