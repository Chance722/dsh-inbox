/**
 * The panel's wire: the exact Fetch routes the browser half calls, exercised
 * through their real handlers and the real vault.
 *
 * The attachment store is the one stand-in, deliberately: the shipped backend
 * decodes images with a native encoder we do not want as a test dependency. The
 * stand-in keeps the two things this plugin actually depends on — the method
 * names and the reference shape — including the `sha256:<hex>` id that once
 * broke the per-record key. The real store is covered by the live run.
 */

import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import type { Context } from '@deepseek-ai/cordis'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { registerInboxRpc } from '../src/host/rpc.js'
import { Vault } from '../src/host/vault/vault.js'
import {
  INBOX_API_PREFIX,
  INBOX_ENDPOINT_ATTACHMENT,
  INBOX_ENDPOINT_CAPTURE,
  INBOX_ENDPOINT_DELETE,
  INBOX_ENDPOINT_DETAIL,
  INBOX_ENDPOINT_LIST,
  INBOX_ENDPOINT_PURGE,
  INBOX_ENDPOINT_RESTORE,
  INBOX_ENDPOINT_UPDATE,
  type CaptureResult,
  type DetailResult,
  type InboxRpcResult,
  type ListResult,
  type PurgeResult,
  type UpdateResult,
} from '../src/shared/panel-wire.js'

/** Content-addressed stand-in: ids look exactly like the shipped store's. */
class FakeAttachmentStore {
  readonly objects = new Map<string, { mediaType: string; name?: string }>()

  private save(bytes: Uint8Array, mediaType: string, name?: string): string {
    const id = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    this.objects.set(id, { mediaType, ...(name === undefined ? {} : { name }) })
    return id
  }

  async saveImages(
    inputs: readonly { data: Uint8Array; mediaType: string; name?: string }[],
  ): Promise<unknown[]> {
    return inputs.map((input) => ({
      attachmentId: this.save(input.data, input.mediaType, input.name),
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 800,
      height: 600,
      ...(input.name === undefined ? {} : { name: input.name }),
    }))
  }

  async saveFile(input: { data: Uint8Array; name?: string }): Promise<unknown> {
    return {
      attachmentId: this.save(input.data, 'application/octet-stream', input.name),
      name: input.name ?? 'file',
      bytes: input.data.byteLength,
    }
  }

  /** The stand-in keeps no files, so nothing is locally previewable. */
  imageHostPath(): undefined {
    return undefined
  }
}

let root: string
let ctx: Context
let vault: Vault | undefined
let routes: Map<string, ConnectionFetchRoute>
let store: FakeAttachmentStore

/** Capture the routes the host registers, without a live connection service. */
function mount(): void {
  const fake = {
    inject: (_deps: readonly string[], run: (scoped: unknown) => void) => {
      run({
        connection: {
          fetch: {
            register: (route: ConnectionFetchRoute) => {
              routes.set(route.path, route)
              return Promise.resolve()
            },
          },
        },
        attachments: store as unknown as AttachmentStore,
        effect: (body: () => unknown) => {
          body()
          return () => {}
        },
      })
    },
  } as unknown as Context
  registerInboxRpc(fake, () => vault)
}

/** POST one payload the way the panel's `fetch` call does. */
async function post(
  endpoint: string,
  payload: unknown,
  raw?: string,
): Promise<{ status: number; body: InboxRpcResult<unknown> }> {
  const route = routes.get(`${INBOX_API_PREFIX}/${endpoint}`)
  if (route === undefined) throw new Error(`route ${endpoint} was not registered`)
  const request = new Request(`http://127.0.0.1${route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(payload),
  })
  const response = await route.fetch(request)
  return { status: response.status, body: (await response.json()) as InboxRpcResult<unknown> }
}

/** GET one attachment the way an `<img src>` does. */
async function getAttachment(id: string): Promise<Response> {
  const route = routes.get(`${INBOX_API_PREFIX}/${INBOX_ENDPOINT_ATTACHMENT}`)
  if (route === undefined) throw new Error('attachment route was not registered')
  return route.fetch(
    new Request(`http://127.0.0.1${route.path}?id=${encodeURIComponent(id)}`, { method: 'GET' }),
  )
}

/** Assert success and hand back the value. */
function value<T>(result: { status: number; body: InboxRpcResult<unknown> }): T {
  if (!result.body.ok) {
    throw new Error(`expected success, got ${result.body.error.code}: ${result.body.error.message}`)
  }
  return result.body.value as T
}

/** The failure code of a call that was refused. */
function codeOf(result: { status: number; body: InboxRpcResult<unknown> }): string {
  if (result.body.ok) throw new Error('expected a failure')
  return result.body.error.code
}

async function file(text: string, extra: Record<string, unknown> = {}): Promise<string> {
  return value<CaptureResult>(await post(INBOX_ENDPOINT_CAPTURE, { text, ...extra })).stored === 1
    ? value<ListResult>(await post(INBOX_ENDPOINT_LIST, { text })).entries[0]?.id ?? ''
    : ''
}

const PNG_BASE64 = Buffer.from('not-really-a-png-but-canonical-base64').toString('base64')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-rpc-'))
  ctx = new CordisContext()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  vault = await Vault.open(ctx)
  routes = new Map()
  store = new FakeAttachmentStore()
  mount()
})

afterEach(async () => {
  await vault?.close()
  vault = undefined
  await rm(root, { recursive: true, force: true })
})

describe('capture', () => {
  it('files pasted text and reports it back through the list', async () => {
    expect(value<CaptureResult>(await post(INBOX_ENDPOINT_CAPTURE, { text: '一段灵感' }))).toEqual({
      stored: 1,
      merged: 0,
    })

    const listed = value<ListResult>(await post(INBOX_ENDPOINT_LIST, {}))
    expect(listed.total).toBe(1)
    expect(listed.unread).toBe(1)
    expect(listed.entries[0]).toMatchObject({ kind: 'text', preview: '一段灵感' })
  })

  it('merges a repeated link instead of storing it twice', async () => {
    const url = 'https://www.bilibili.com/video/BV1xx411c7mD'
    await post(INBOX_ENDPOINT_CAPTURE, { text: url })
    const again = value<CaptureResult>(
      await post(INBOX_ENDPOINT_CAPTURE, { text: `${url}?spm_id_from=333.999` }),
    )
    expect(again).toEqual({ stored: 0, merged: 1 })
    expect(vault?.size).toBe(1)
  })

  it('stores a pasted image through the attachment store, not the domain', async () => {
    const captured = value<CaptureResult>(
      await post(INBOX_ENDPOINT_CAPTURE, {
        text: '测试图片',
        images: [{ mediaType: 'image/png', data: PNG_BASE64, name: 'shot.png' }],
      }),
    )
    expect(captured).toEqual({ stored: 2, merged: 0 })
    expect(store.objects.size).toBe(1)

    // The store named it `sha256:<hex>`; the domain must still hold a path-safe
    // key, with the store id kept beside it.
    const image = vault?.list({ kinds: ['image'] })[0]
    const attachmentId = image?.attachmentIds[0] ?? ''
    expect(attachmentId).toMatch(/^[a-zA-Z0-9_-]+$/)
    expect(vault?.getAttachment(attachmentId)?.storeId).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('refuses non-canonical base64 as a business failure, not a crash', async () => {
    const result = await post(INBOX_ENDPOINT_CAPTURE, {
      images: [{ mediaType: 'image/png', data: 'not base64 !!' }],
    })
    expect(result.status).toBe(200)
    expect(codeOf(result)).toBe('inbox/attachment-refused')
  })

  it('answers a malformed body with HTTP 400', async () => {
    const result = await post(INBOX_ENDPOINT_CAPTURE, null, '{not json')
    expect(result.status).toBe(400)
    expect(result.body.ok).toBe(false)
  })

  it('rejects an oversized text paste at the schema boundary', async () => {
    expect(codeOf(await post(INBOX_ENDPOINT_CAPTURE, { text: 'x'.repeat(200_001) }))).toBe(
      'inbox/bad-request',
    )
  })
})

describe('list', () => {
  it('registers every endpoint the panel uses', () => {
    expect([...routes.keys()].sort()).toEqual(
      [
        INBOX_ENDPOINT_ATTACHMENT,
        INBOX_ENDPOINT_CAPTURE,
        INBOX_ENDPOINT_DELETE,
        INBOX_ENDPOINT_DETAIL,
        INBOX_ENDPOINT_LIST,
        INBOX_ENDPOINT_PURGE,
        INBOX_ENDPOINT_RESTORE,
        INBOX_ENDPOINT_UPDATE,
      ]
        .map((endpoint) => `${INBOX_API_PREFIX}/${endpoint}`)
        .sort(),
    )
  })

  it('filters by status and reports matching and overall counts separately', async () => {
    const first = await file('第一条')
    await file('第二条')
    await post(INBOX_ENDPOINT_UPDATE, { id: first, status: 'read' })

    const everything = value<ListResult>(await post(INBOX_ENDPOINT_LIST, {}))
    expect(everything.matched).toBe(2)
    expect(everything.total).toBe(2)
    expect(everything.unread).toBe(1)

    const unread = value<ListResult>(
      await post(INBOX_ENDPOINT_LIST, { statuses: ['unread'] }),
    )
    expect(unread.matched).toBe(1)
    expect(unread.entries[0]?.preview).toBe('第二条')
  })

  it('filters by category, tag and free text, and counts facets over live records', async () => {
    const link = await file('https://mp.weixin.qq.com/s/abc')
    await post(INBOX_ENDPOINT_UPDATE, { id: link, category: 'article', tags: ['待看', '缓存'] })
    await file('一段灵感')

    const byCategory = value<ListResult>(
      await post(INBOX_ENDPOINT_LIST, { categories: ['article'] }),
    )
    expect(byCategory.matched).toBe(1)
    expect(byCategory.categories).toEqual(
      expect.arrayContaining([
        { value: 'article', count: 1 },
        { value: 'other', count: 1 },
      ]),
    )
    expect(byCategory.tags).toEqual(
      expect.arrayContaining([
        { value: '待看', count: 1 },
        { value: '缓存', count: 1 },
      ]),
    )

    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { tags: ['待看'] })).matched).toBe(1)
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { tags: ['待看', '缓存'] })).matched).toBe(1)
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { tags: ['待看', '前端'] })).matched).toBe(0)
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { text: '灵感' })).matched).toBe(1)
  })

  it('pages without losing the match count', async () => {
    await file('第一条')
    await file('第二条')
    await file('第三条')

    const page = value<ListResult>(await post(INBOX_ENDPOINT_LIST, { limit: 2 }))
    expect(page.entries).toHaveLength(2)
    expect(page.matched).toBe(3)

    const rest = value<ListResult>(await post(INBOX_ENDPOINT_LIST, { limit: 2, offset: 2 }))
    expect(rest.entries).toHaveLength(1)
  })
})

describe('detail, edit and the recycle bin', () => {
  it('returns the full record with its attachment metadata', async () => {
    await post(INBOX_ENDPOINT_CAPTURE, {
      text: '带附件的记录',
      images: [{ mediaType: 'image/png', data: PNG_BASE64, name: 'shot.png' }],
    })
    const image = vault?.list({ kinds: ['image'] })[0]
    const detail = value<DetailResult>(
      await post(INBOX_ENDPOINT_DETAIL, { id: image?.id ?? '' }),
    ).entry

    expect(detail.attachmentCount).toBe(1)
    expect(detail.attachments[0]).toMatchObject({ mime: 'image/png', image: true, filename: 'shot.png' })
  })

  it('edits category, note and tags, and reports the updated record', async () => {
    const id = await file('这条要改')
    const updated = value<UpdateResult>(
      await post(INBOX_ENDPOINT_UPDATE, {
        id,
        category: 'document',
        note: '身份证照',
        tags: ['证件', '私密'],
      }),
    ).entry

    expect(updated).toMatchObject({ category: 'document', note: '身份证照', tags: ['证件', '私密'] })
    expect(vault?.get(id)?.updatedAt).not.toBe(vault?.get(id)?.createdAt)
  })

  it('refuses an edit or a delete for a record that is gone', async () => {
    expect(codeOf(await post(INBOX_ENDPOINT_UPDATE, { id: 'nope', status: 'read' }))).toBe(
      'inbox/not-found',
    )
    expect(codeOf(await post(INBOX_ENDPOINT_DELETE, { id: 'nope' }))).toBe('inbox/not-found')
  })

  it('moves a record to the bin, restores it, and empties the bin for real', async () => {
    const id = await file('会被删掉的')

    await post(INBOX_ENDPOINT_DELETE, { id })
    const live = value<ListResult>(await post(INBOX_ENDPOINT_LIST, {}))
    expect(live.total).toBe(0)
    expect(live.deleted).toBe(1)
    expect(live.categories).toEqual([])
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { scope: 'bin' })).matched).toBe(1)

    await post(INBOX_ENDPOINT_RESTORE, { id })
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, {})).total).toBe(1)

    await post(INBOX_ENDPOINT_DELETE, { id })
    expect(value<PurgeResult>(await post(INBOX_ENDPOINT_PURGE, {})).removed).toBe(1)
    expect(vault?.get(id)).toBeUndefined()
    expect(value<ListResult>(await post(INBOX_ENDPOINT_LIST, { scope: 'bin' })).matched).toBe(0)
  })

  it('drops the attachment rows when the bin is emptied', async () => {
    await post(INBOX_ENDPOINT_CAPTURE, {
      images: [{ mediaType: 'image/png', data: PNG_BASE64, name: 'shot.png' }],
    })
    const image = vault?.list({ kinds: ['image'] })[0]
    const attachmentId = image?.attachmentIds[0] ?? ''

    await post(INBOX_ENDPOINT_DELETE, { id: image?.id ?? '' })
    await post(INBOX_ENDPOINT_PURGE, {})

    expect(vault?.getAttachment(attachmentId)).toBeUndefined()
    expect(vault?.findAttachmentByStoreId(`sha256:${createHash('sha256').update('not-really-a-png-but-canonical-base64').digest('hex')}`)).toBeUndefined()
  })

  it('serves attachment bytes only for images it can reach', async () => {
    await post(INBOX_ENDPOINT_CAPTURE, {
      images: [{ mediaType: 'image/png', data: PNG_BASE64, name: 'shot.png' }],
    })
    const image = vault?.list({ kinds: ['image'] })[0]
    const attachmentId = image?.attachmentIds[0] ?? ''

    expect((await getAttachment('nope')).status).toBe(404)
    // The stand-in store keeps no files, so the route reports "not on this machine".
    expect((await getAttachment(attachmentId)).status).toBe(404)
  })

  it('explains itself while the vault is closed', async () => {
    await vault?.close()
    vault = undefined

    expect(codeOf(await post(INBOX_ENDPOINT_CAPTURE, { text: 'anything' }))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_LIST, {}))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_DETAIL, { id: 'x' }))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_UPDATE, { id: 'x' }))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_DELETE, { id: 'x' }))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_RESTORE, { id: 'x' }))).toBe('inbox/vault-closed')
    expect(codeOf(await post(INBOX_ENDPOINT_PURGE, {}))).toBe('inbox/vault-closed')
  })
})
