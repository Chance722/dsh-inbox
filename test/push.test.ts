/**
 * Pushing the vault to the remote.
 *
 * The transport is a function here, so what is under test is the policy: what
 * counts as changed, where an object lands, that bytes are uploaded once, and
 * that one failure does not take the other nineteen writes with it.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureText } from '../src/host/capture.js'
import { pushOnce } from '../src/host/remote/push.js'
import { Vault } from '../src/host/vault/vault.js'

/** An attachment store that can hand back the bytes it was told about. */
function fakeAttachments(files: Map<string, Uint8Array>): AttachmentStore {
  return {
    async readImage(ref: { attachmentId: string }) {
      const data = files.get(ref.attachmentId)
      if (data === undefined) throw new Error('没有这些字节')
      return { ref, data }
    },
    async *readFileStream(ref: { attachmentId: string }) {
      const data = files.get(ref.attachmentId)
      if (data === undefined) throw new Error('没有这些字节')
      yield data
    },
  } as unknown as AttachmentStore
}

describe('pushOnce', () => {
  let root: string
  let ctx: Context
  let vault: Vault

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-inbox-push-'))
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

  /** A writer that records what it was asked to store. */
  function recorder(): {
    written: Map<string, { bytes: Uint8Array; contentType: string }>
    write: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>
  } {
    const written = new Map<string, { bytes: Uint8Array; contentType: string }>()
    return {
      written,
      write: async (path, bytes, contentType) => {
        written.set(path, { bytes, contentType })
      },
    }
  }

  it('writes every record under sync/items, and remembers the cursor', async () => {
    await captureText(vault, '一条笔记', 'panel')
    const link = await captureText(vault, 'https://example.com/a', 'panel')
    const { written, write } = recorder()

    const result = await pushOnce(vault, fakeAttachments(new Map()), write, 'inbox/sync')

    expect(result).toMatchObject({ status: 'ok', pushed: 2, attachments: 0, skipped: 0, listed: 2 })
    expect(written.has(`inbox/sync/items/${link.item.id}.json`)).toBe(true)
    expect([...written.keys()].every((key) => key.startsWith('inbox/sync/items/'))).toBe(true)
    const packed = JSON.parse(new TextDecoder().decode([...written.values()][0]?.bytes)) as {
      format: string
      record: { id: string }
    }
    expect(packed.format).toBe('dsh-inbox-item/1')
    expect(packed.record.id).toHaveLength(36)
    expect(vault.global.sync.lastPushAt).toBeDefined()
  })

  it('only sends what changed since the last push', async () => {
    await captureText(vault, '第一条', 'panel')
    const first = recorder()
    await pushOnce(vault, fakeAttachments(new Map()), first.write, 'inbox/sync')
    expect(first.written.size).toBe(1)

    const second = recorder()
    const nothing = await pushOnce(vault, fakeAttachments(new Map()), second.write, 'inbox/sync')
    expect(nothing).toMatchObject({ pushed: 0, skipped: 1 })
    expect(second.written.size).toBe(0)

    // A new capture is what a push is for.
    await captureText(vault, '第二条', 'panel')
    const third = recorder()
    expect(await pushOnce(vault, fakeAttachments(new Map()), third.write, 'inbox/sync')).toMatchObject({
      pushed: 1,
      skipped: 1,
    })
  })

  it('uploads an attachment once, even when two records point at it', async () => {
    const attachment = await vault.addAttachment({
      storeId: 'sha256:abc',
      mime: 'image/png',
      bytes: 4,
      width: 1,
      height: 1,
      filename: 'shot.png',
    })
    await vault.create({
      kind: 'image',
      category: 'image',
      source: 'panel',
      attachmentIds: [attachment.id],
    })
    await vault.create({
      kind: 'image',
      category: 'image',
      source: 'panel',
      attachmentIds: [attachment.id],
    })
    const { written, write } = recorder()
    const files = new Map([[attachment.storeId, new TextEncoder().encode('PNG!')]])

    const result = await pushOnce(vault, fakeAttachments(files), write, 'inbox/sync')

    expect(result).toMatchObject({ status: 'ok', pushed: 2, attachments: 1 })
    expect(written.get(`inbox/sync/attachments/${attachment.id}`)?.bytes).toEqual(
      new TextEncoder().encode('PNG!'),
    )
    expect(written.get(`inbox/sync/attachments/${attachment.id}`)?.contentType).toBe('image/png')
  })

  it('keeps going when one write fails, and says which one', async () => {
    await captureText(vault, '第一条', 'panel')
    const second = await captureText(vault, 'https://example.com/b', 'panel')
    const written: string[] = []
    const write = async (path: string): Promise<void> => {
      if (path.includes(second.item.id)) throw new Error('HTTP 403 · AccessDenied')
      written.push(path)
    }

    const result = await pushOnce(vault, fakeAttachments(new Map()), write, 'inbox/sync')

    expect(result.status).toBe('partial')
    expect(result.pushed).toBe(1)
    expect(result.reason).toContain('AccessDenied')
    expect(written).toHaveLength(1)
  })

  it('still syncs a record whose bytes this host cannot read', async () => {
    const attachment = await vault.addAttachment({
      storeId: 'sha256:missing',
      mime: 'image/png',
      bytes: 4,
      width: 1,
      height: 1,
    })
    await vault.create({
      kind: 'image',
      category: 'image',
      source: 'panel',
      attachmentIds: [attachment.id],
    })
    const { written, write } = recorder()

    const result = await pushOnce(vault, fakeAttachments(new Map()), write, 'inbox/sync')

    expect(result.pushed).toBe(1)
    expect(result.attachments).toBe(0)
    expect(result.status).toBe('partial')
    expect(result.reason).toContain('拿不到字节')
    expect(written.has(`inbox/sync/items/${vault.list()[0]?.id ?? ''}.json`)).toBe(true)
  })

  it('carries tombstones up, so another device learns about the deletion', async () => {
    const filed = await captureText(vault, '会被删掉的', 'panel')
    await vault.softDelete(filed.item.id)
    const { written, write } = recorder()

    await pushOnce(vault, fakeAttachments(new Map()), write, 'inbox/sync')

    const packed = JSON.parse(
      new TextDecoder().decode(written.get(`inbox/sync/items/${filed.item.id}.json`)?.bytes),
    ) as { record: { deletedAt?: string } }
    expect(packed.record.deletedAt).toBeDefined()
  })
})
