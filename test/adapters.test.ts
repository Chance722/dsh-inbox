/**
 * The two adapters between our clients and the platform's `fetch`.
 *
 * They exist to reshape a response, and that is what made this file worth
 * writing: the S3 adapter silently dropped the request body, so every push
 * wrote 0-byte objects to a real bucket and reported success. A unit test that
 * hands the client a fake `fetch` cannot see an adapter's omission — only
 * stubbing the *global* fetch can.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { putObject, readObject, type S3Deps } from '../src/host/s3/client.js'
import { s3Fetch, webdavFetch } from '../src/host/webdav/run.js'

const CONFIG = {
  endpoint: 'https://s3.example.com',
  bucket: 'bucket',
  region: 'us-east-1',
}

function deps(): S3Deps {
  return {
    fetch: s3Fetch,
    accessKeyId: 'AKID',
    accessKeySecret: 'secret',
    now: new Date('2026-09-20T05:00:00.000Z'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the fetch adapters', () => {
  it('forwards the S3 request body to the platform fetch', async () => {
    const seen: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, init })
      return new Response('', { status: 200 })
    })
    const body = new TextEncoder().encode('{"record":"一大段内容"}')

    await putObject(CONFIG, 'inbox/sync/items/a.json', body, deps(), 'application/json')

    expect(seen).toHaveLength(1)
    expect(seen[0]?.init.method).toBe('PUT')
    expect(seen[0]?.init.body).toBeDefined()
    // The bytes, not just "a body": this is what the bucket was missing.
    expect(new Uint8Array(seen[0]?.init.body as Uint8Array)).toEqual(body)
  })

  it('forwards the WebDAV request body too', async () => {
    const seen: RequestInit[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      seen.push(init)
      return new Response('', { status: 201 })
    })

    await webdavFetch('https://dav.example.com/base/inbox/a.txt', {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    })

    expect(seen[0]?.body).toBe('hello')
  })

  it('reads back what it wrote, through the same adapter', async () => {
    // One in-memory "bucket": the round trip is the point, so a dropped body on
    // either side shows up as an empty read rather than as a passed assertion.
    const store = new Map<string, Uint8Array>()
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (init.method === 'PUT') {
        store.set(url, new Uint8Array(init.body as Uint8Array))
        return new Response('', { status: 200 })
      }
      const stored = store.get(url)
      if (stored === undefined) return new Response('missing', { status: 404 })
      // A fresh, exactly-sized ArrayBuffer: `Uint8Array<ArrayBufferLike>` is not
      // a `BodyInit`, and a pooled buffer would leak whatever else is in it.
      return new Response(stored.slice().buffer as ArrayBuffer, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const body = new TextEncoder().encode('附件或记录的真实字节')

    await putObject(CONFIG, 'inbox/sync/items/b.json', body, deps())
    const read = await readObject(CONFIG, 'inbox/sync/items/b.json', deps())

    expect(new TextDecoder().decode(read.bytes)).toBe('附件或记录的真实字节')
    expect(read.contentType).toBe('application/json')
  })
})
