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
  INBOX_ENDPOINT_CAPTURE,
  INBOX_ENDPOINT_RECENT,
  type InboxRpcResult,
  type RecentResult,
  type CaptureResult,
} from '../src/shared/capture.js'

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

/** Assert success and hand back the value. */
function value<T>(result: { status: number; body: InboxRpcResult<unknown> }): T {
  if (!result.body.ok) {
    throw new Error(`expected success, got ${result.body.error.code}: ${result.body.error.message}`)
  }
  return result.body.value as T
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

describe('the panel wire', () => {
  it('registers exactly the two endpoints under the inbox prefix', () => {
    expect([...routes.keys()].sort()).toEqual([
      `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_CAPTURE}`,
      `${INBOX_API_PREFIX}/${INBOX_ENDPOINT_RECENT}`,
    ])
    for (const route of routes.values()) {
      expect(route.methods).toEqual(['POST'])
      expect(route.requestBody).toBe('buffered')
    }
  })

  it('files pasted text and reports it back through the recent list', async () => {
    const captured = value<CaptureResult>(await post(INBOX_ENDPOINT_CAPTURE, { text: '一段灵感' }))
    expect(captured).toEqual({ stored: 1, merged: 0 })

    const recent = value<RecentResult>(await post(INBOX_ENDPOINT_RECENT, {}))
    expect(recent.total).toBe(1)
    expect(recent.unread).toBe(1)
    expect(recent.entries[0]).toMatchObject({ kind: 'text', preview: '一段灵感' })
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
    expect(vault?.getAttachment(attachmentId)?.filename).toBe('shot.png')
  })

  it('refuses non-canonical base64 as a business failure, not a crash', async () => {
    const result = await post(INBOX_ENDPOINT_CAPTURE, {
      images: [{ mediaType: 'image/png', data: 'not base64 !!' }],
    })
    expect(result.status).toBe(200)
    expect(result.body.ok).toBe(false)
    expect(result.body.ok === false && result.body.error.code).toBe('inbox/attachment-refused')
    expect(vault?.size).toBe(0)
  })

  it('answers a malformed body with HTTP 400', async () => {
    const result = await post(INBOX_ENDPOINT_CAPTURE, null, '{not json')
    expect(result.status).toBe(400)
    expect(result.body.ok).toBe(false)
  })

  it('rejects an oversized text paste at the schema boundary', async () => {
    const result = await post(INBOX_ENDPOINT_CAPTURE, { text: 'x'.repeat(200_001) })
    expect(result.status).toBe(200)
    expect(result.body.ok === false && result.body.error.code).toBe('inbox/bad-request')
  })

  it('explains itself while the vault is closed', async () => {
    await vault?.close()
    vault = undefined

    const captured = await post(INBOX_ENDPOINT_CAPTURE, { text: 'anything' })
    expect(captured.body.ok === false && captured.body.error.code).toBe('inbox/vault-closed')

    const recent = await post(INBOX_ENDPOINT_RECENT, {})
    expect(recent.body.ok === false && recent.body.error.code).toBe('inbox/vault-closed')
  })
})
