/**
 * Exercise the vault against the real storage stack — the hub, the json
 * backend, and the domain form — rather than a hand-written fake, so the test
 * also pins the interface this plugin actually depends on at runtime.
 */

import { mkdtemp, readdir, rm } from 'node:fs/promises'
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

    expect(created.status).toBe('unread')
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

  it('patches classification and status without dropping the other fields', async () => {
    const created = await vault.create({
      kind: 'image',
      category: 'image',
      source: 'panel',
      note: '看起来像证件照',
    })

    const patched = await vault.patch(created.id, { category: 'document', status: 'read' })
    expect(patched.category).toBe('document')
    expect(patched.status).toBe('read')
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

  it('keeps attachment metadata and the global slot', async () => {
    await vault.addAttachment({ id: 'a1', sha256: 'deadbeef', mime: 'image/png', bytes: 12 })
    expect(vault.getAttachment('a1')?.mime).toBe('image/png')

    expect(vault.global.sync).toEqual({})
    await vault.setGlobal({ sync: { lastPullAt: '2026-09-19T00:00:00.000Z' } })
    expect(vault.global.sync.lastPullAt).toBe('2026-09-19T00:00:00.000Z')
  })

  it('refuses a patch to a record that does not exist', async () => {
    await expect(vault.patch('missing', { status: 'read' })).rejects.toThrow()
  })
})
