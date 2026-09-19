/**
 * The WebDAV client and the one-way ingest, driven against a fake server.
 *
 * The fake is a fetch function, not a storage stub: the XML parsing, the
 * authentication header, the "already seen" filter and the ingest itself are all
 * the real code paths.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { Context } from '@deepseek-ai/cordis'
import { Context as CordisContext } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { authHeaders, joinUrl, parseListing, type FetchLike } from '../src/host/webdav/client.js'
import { pullRemote } from '../src/host/webdav/pull.js'
import { Vault } from '../src/host/vault/vault.js'

/** A content-addressed stand-in for the shipped attachment store. */
class FakeStore {
  readonly saved: string[] = []

  async saveImages(inputs: readonly { data: Uint8Array; mediaType: string; name?: string }[]) {
    return inputs.map((input) => {
      this.saved.push(input.name ?? 'image')
      return {
        attachmentId: `sha256:${input.data.byteLength}-${input.mediaType}`,
        mediaType: input.mediaType,
        bytes: input.data.byteLength,
        width: 1200,
        height: 800,
        ...(input.name === undefined ? {} : { name: input.name }),
      }
    })
  }

  async saveFile(input: { data: Uint8Array; name?: string }) {
    this.saved.push(input.name ?? 'file')
    return {
      attachmentId: `sha256:file-${input.data.byteLength}`,
      name: input.name ?? 'file',
      bytes: input.data.byteLength,
    }
  }
}

const LISTING = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/inbox/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/inbox/note.txt</d:href>
    <d:propstat><d:prop>
      <d:getlastmodified>Fri, 19 Sep 2026 06:00:00 GMT</d:getlastmodified>
      <d:getcontenttype>text/plain</d:getcontenttype>
      <d:resourcetype/>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/inbox/shot.png</d:href>
    <d:propstat><d:prop>
      <d:getlastmodified>Fri, 19 Sep 2026 06:05:00 GMT</d:getlastmodified>
      <d:getcontenttype>image/png</d:getcontenttype>
      <d:resourcetype/>
    </d:prop></d:propstat>
  </d:response>
</d:multistatus>`

interface FakeServer {
  fetch: FetchLike
  calls: string[]
  authSeen: (string | undefined)[]
}

function server(options: { listing?: string; listingFails?: boolean } = {}): FakeServer {
  const calls: string[] = []
  const authSeen: (string | undefined)[] = []
  const fetch: FetchLike = async (url, init) => {
    calls.push(`${init.method} ${url}`)
    authSeen.push(init.headers['authorization'])
    if (init.method === 'PROPFIND') {
      if (options.listingFails === true) {
        return { ok: false, status: 401, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }
      }
      return {
        ok: true,
        status: 207,
        text: async () => options.listing ?? LISTING,
        arrayBuffer: async () => new ArrayBuffer(0),
      }
    }
    // A fresh, exactly-sized buffer: `Buffer.from(s).buffer` is the pooled slab
    // and would hand the decoder eight kilobytes of somebody else's memory.
    const body = url.endsWith('.png')
      ? new Uint8Array([1, 2, 3, 4])
      : new TextEncoder().encode('https://mp.weixin.qq.com/s/abc')
    return {
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
      headers: { get: () => (url.endsWith('.png') ? 'image/png' : 'text/plain') },
    }
  }
  return { fetch, calls, authSeen }
}

let root: string
let ctx: Context
let vault: Vault
let store: FakeStore

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-inbox-webdav-'))
  ctx = new CordisContext()
  await ctx.plugin(Storage).await()
  await ctx.plugin(storageJson, { root }).await()
  await ctx.plugin(storageDomain, { backend: 'json' }).await()
  vault = await Vault.open(ctx)
  store = new FakeStore()
})

afterEach(async () => {
  await vault.close()
  await rm(root, { recursive: true, force: true })
})

describe('the WebDAV client', () => {
  it('reads files out of a listing and drops the folder entry', () => {
    const files = parseListing(LISTING, '/inbox')
    expect(files.map((file) => file.path)).toEqual(['/dav/inbox/note.txt', '/dav/inbox/shot.png'])
    expect(files[1]?.contentType).toBe('image/png')
    expect(files[0]?.lastModified).toContain('2026')
  })

  it('joins URLs without doubling the slash', () => {
    expect(joinUrl('https://data.cstcloud.cn/dav', '/inbox')).toBe('https://data.cstcloud.cn/dav/inbox')
    expect(joinUrl('https://data.cstcloud.cn/dav/', 'inbox')).toBe('https://data.cstcloud.cn/dav/inbox')
  })

  it('sends basic auth only when it has credentials', () => {
    expect(authHeaders()).toEqual({})
    expect(authHeaders({ username: 'u', password: 'p' }).authorization).toMatch(/^Basic /)
  })
})

describe('pulling', () => {
  it('files a text file as text and an image as an image', async () => {
    const fake = server()
    const result = await pullRemote(
      vault,
      { baseUrl: 'https://data.cstcloud.cn/dav' },
      { fetch: fake.fetch, attachments: store as unknown as AttachmentStore },
    )

    expect(result).toMatchObject({ status: 'ok', pulled: 2, failed: 0, skipped: 0 })
    const records = vault.list()
    expect(records.map((record) => record.kind).sort()).toEqual(['image', 'link'])
    expect(records.find((record) => record.kind === 'link')).toMatchObject({
      source: 'webdav',
      platform: 'wechat',
    })
    expect(vault.global.sync.lastPullAt).toBe(result.lastPullAt)
  })

  it('skips everything the last pull already saw', async () => {
    const fake = server()
    await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })

    const second = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    expect(second).toMatchObject({ status: 'ok', pulled: 0, skipped: 2 })
    expect(vault.size).toBe(2)
  })

  it('merges a re-pulled file instead of storing it twice', async () => {
    const fake = server()
    await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    await vault.setSync({}) // forget the cursor, as a fresh install would

    const again = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    expect(again.status).toBe('ok')
    expect(vault.size).toBe(2)
  })

  it('passes the credentials through, and reports an unconfigured vault', async () => {
    const fake = server()
    await pullRemote(
      vault,
      { baseUrl: 'https://data.cstcloud.cn/dav', username: 'me' },
      {
        fetch: fake.fetch,
        attachments: store as unknown as AttachmentStore,
        auth: { username: 'me', password: 'secret' },
      },
    )
    expect(fake.authSeen.every((header) => header?.startsWith('Basic '))).toBe(true)

    const blank = await pullRemote(vault, { baseUrl: '   ' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    expect(blank).toMatchObject({ status: 'unconfigured', pulled: 0 })
  })

  it('reports a broken server instead of throwing', async () => {
    const fake = server({ listingFails: true })
    const result = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    expect(result.status).toBe('failed')
    expect(result.reason).toContain('401')
  })
})
