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

import {
  authHeaders,
  deleteFile,
  joinUrl,
  parseListing,
  userAgentHeaders,
  writeFile,
  type FetchLike,
} from '../src/host/webdav/client.js'
import { pullRemote, pullS3 } from '../src/host/remote/pull.js'
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

/** The same six keys as the WebDAV listing above, in S3's shape. */
const S3_LISTING = `<?xml version="1.0"?>
<ListBucketResult>
  <Contents><Key>inbox/sync/items/a.json</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>120</Size></Contents>
  <Contents><Key>inbox/sync/items/a.txt</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>80</Size></Contents>
  <Contents><Key>inbox/sync/attachments/pic.png</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>4096</Size></Contents>
  <Contents><Key>inbox/sync/attachments/pic.meta.json</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>140</Size></Contents>
  <Contents><Key>inbox/archive/sync/items/b.json</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>120</Size></Contents>
  <Contents><Key>inbox/shot.png</Key><LastModified>2026-09-20T06:00:00.000Z</LastModified><Size>2048</Size></Contents>
</ListBucketResult>`

/** The bucket root: two folders, one of them ours. */
const S3_TOP_LEVEL = `<?xml version="1.0"?>
<ListBucketResult>
  <CommonPrefixes><Prefix>inbox/</Prefix></CommonPrefixes>
  <CommonPrefixes><Prefix>sync/</Prefix></CommonPrefixes>
</ListBucketResult>`

/** A record inside that leftover tree, so the warning can count it. */
const S3_LEGACY_ITEMS = `<?xml version="1.0"?>
<ListBucketResult>
  <Contents><Key>sync/items/9f1e-0000.json</Key><LastModified>2026-09-19T06:00:00.000Z</LastModified><Size>120</Size></Contents>
  <Contents><Key>sync/items/9f1e-0000.txt</Key><LastModified>2026-09-19T06:00:00.000Z</LastModified><Size>40</Size></Contents>
</ListBucketResult>`

interface FakeServer {
  fetch: FetchLike
  calls: string[]
  authSeen: (string | undefined)[]
  userAgentSeen: (string | undefined)[]
}

function server(
  options: {
    listing?: string
    listingFails?: boolean
    /** A refusal with a body, the way a real gateway explains itself. */
    refused?: { status: number; body: string }
  } = {},
): FakeServer {
  const calls: string[] = []
  const authSeen: (string | undefined)[] = []
  const userAgentSeen: (string | undefined)[] = []
  const refused = options.refused
  const fetch: FetchLike = async (url, init) => {
    calls.push(`${init.method} ${url}`)
    authSeen.push(init.headers['authorization'])
    userAgentSeen.push(init.headers['user-agent'])
    if (init.method === 'PROPFIND') {
      if (refused !== undefined) {
        return {
          ok: false,
          status: refused.status,
          text: async () => refused.body,
          arrayBuffer: async () => new ArrayBuffer(0),
        }
      }
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
  return { fetch, calls, authSeen, userAgentSeen }
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

  it('lists a folder when the configured directory is the root', () => {
    // Regression, caught against the real gateway: `endsWith('')` is true for
    // every path, so `/` used to filter out the entire listing.
    const root = LISTING.replace(/\/dav\/inbox\//g, '/dav/')
    const files = parseListing(root, '/')
    expect(files.map((file) => file.path)).toEqual(['/dav/note.txt', '/dav/shot.png'])
    // And a folder named `/inbox` still drops only its own entry.
    expect(parseListing(LISTING, '/inbox').length).toBe(2)
  })

  it('joins URLs without doubling the slash', () => {
    expect(joinUrl('https://data.cstcloud.cn/dav', '/inbox')).toBe('https://data.cstcloud.cn/dav/inbox')
    expect(joinUrl('https://data.cstcloud.cn/dav/', 'inbox')).toBe('https://data.cstcloud.cn/dav/inbox')
  })

  it('sends basic auth only when it has credentials', () => {
    expect(authHeaders()).toEqual({})
    expect(authHeaders({ username: 'u', password: 'p' }).authorization).toMatch(/^Basic /)
  })

  it('names itself in the user agent, by default and on request', () => {
    const bare = { fetch: async () => ({ ok: true, status: 200, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }) }
    expect(userAgentHeaders(bare)).toEqual({ 'user-agent': 'dsh-inbox' })
    expect(userAgentHeaders({ ...bare, userAgent: '  Obsidian/1.8.7 ' })).toEqual({
      'user-agent': 'Obsidian/1.8.7',
    })
  })
})

describe('pulling', () => {
  /**
   * A listing built from hrefs, all dated the same so nothing is "older".
   *
   * Collections are included for the folders we name, because a real WebDAV
   * listing carries them and the parser is the code under test.
   */
  function listingOf(paths: readonly string[]): string {
    const entries = paths
      .map(
        (path) => `  <d:response>
    <d:href>/dav/${path}</d:href>
    <d:propstat><d:prop>
      <d:getlastmodified>Sat, 20 Sep 2026 06:00:00 GMT</d:getlastmodified>
      <d:resourcetype/>
    </d:prop></d:propstat>
  </d:response>`,
      )
      .join('\n')
    return `<?xml version="1.0"?>\n<d:multistatus xmlns:d="DAV:">\n${entries}\n</d:multistatus>`
  }

  it('counts the cloud in records, and knows which objects are its own', async () => {
    // The reader asked "远端 78 项，可我并没有那么多东西" (2026-09-21): one record
    // is `items/<id>.json` + `.txt`, a picture adds `attachments/<id>.png` plus
    // its `.meta.json`, so the object count is several times the record count.
    const fake = server({
      listing: listingOf([
        'inbox/sync/items/a.json',
        'inbox/sync/items/a.txt',
        'inbox/sync/attachments/pic.png',
        'inbox/sync/attachments/pic.meta.json',
        // Another machine that was pointed at a *nested* directory: its tree is
        // inside ours, so it is exactly the case the warning exists for.
        'inbox/archive/sync/items/b.json',
        'inbox/shot.png',
      ]),
    })

    const result = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })

    expect(result).toMatchObject({
      listed: 6,
      pulled: 1,
      skipped: 5,
      skippedSync: 4,
      skippedForeign: 1,
      foreignSyncRoots: ['archive/sync'],
      remoteRecords: 1,
      remoteAttachments: 1,
      syncRoot: 'inbox/sync',
    })
  })

  it('scopes an S3 pull to the configured directory and claims its own tree', async () => {
    /*
      The bug this pins (measured in a real bucket on 2026-09-21): the S3 pull
      was handed the *directory* and used it as "our own sync root" too, so with
      `/` it listed the whole bucket and every own object — `inbox/sync/…` —
      answered to a prefix that was not ours. The panel then reported
      「自己的同步对象 0 项」 and warned that another machine used a different
      directory, when the only other prefix was the leftovers of an older build.
    */
    /**
     * The bucket answers differently per request, because the pull now asks
     * three different questions: what folders exist at the top level, what is
     * under our directory, and whether some *other* folder holds a sync tree.
     */
    const urls: string[] = []
    const listing = (body: string) => async (url: string) => {
      urls.push(url)
      return { ok: true, status: 200, text: async () => body, arrayBuffer: async () => new ArrayBuffer(0) }
    }
    const result = await pullS3(
      vault,
      { endpoint: 'https://data.cstcloud.cn', bucket: 'my-bucket' },
      '/',
      {
        fetch: async (url) => {
          if (url.includes('delimiter=%2F')) return listing(S3_TOP_LEVEL)(url)
          if (url.includes('prefix=inbox%2F')) return listing(S3_LISTING)(url)
          // The legacy layout: an older build read the directory as the bucket
          // root and wrote `sync/items/…` at the top level.
          if (url.includes('prefix=sync%2Fitems%2F')) return listing(S3_LEGACY_ITEMS)(url)
          return listing('<ListBucketResult></ListBucketResult>')(url)
        },
        accessKeyId: 'AKIDEXAMPLE',
        accessKeySecret: 'secret-key',
        attachments: store as unknown as AttachmentStore,
      },
    )

    // `/` is the default directory, so the listing asks for `inbox/` — not the
    // whole bucket, which is how the stray root-level `sync/` got noticed.
    expect(urls.some((url) => url.includes('prefix=inbox%2F'))).toBe(true)
    // …and the bucket root is still visited once, with a delimiter, so a sync
    // tree *outside* the configured directory can be reported rather than
    // silently ignored (that listing cannot see it).
    expect(urls.some((url) => url.includes('delimiter=%2F'))).toBe(true)
    expect(result).toMatchObject({
      listed: 6,
      pulled: 1,
      skipped: 5,
      skippedSync: 4,
      skippedForeign: 1,
      // Two places hold records we are not reading: one nested inside our own
      // directory (found by the listing) and the leftover top-level `sync/`
      // (found by the probe).
      // The probe's finds come first (those are the invisible ones), then what
      // the listing turned up inside our own directory.
      foreignSyncRoots: ['sync', 'archive/sync'],
      foreignRecords: 2,
      remoteRecords: 1,
      remoteAttachments: 1,
      syncRoot: 'inbox/sync',
    })
  })

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
    // …and it says *why* they were skipped: this is the cursor talking, not the
    // upload queue. Without the split, "跳过 77" says nothing actionable.
    expect(second).toMatchObject({
      status: 'ok',
      pulled: 0,
      skipped: 2,
      skippedSync: 0,
      skippedOlder: 2,
    })
    expect(vault.size).toBe(2)
  })

  it('never eats the vault\u2019s own upload queue', async () => {
    // `sync/` is where the push writes. A remote listing is recursive, so
    // without the guard the next pull would file the vault's own records as
    // pasted text — and then again on the pull after that.
    const fake = server({
      listing: LISTING.replace(
        '<d:href>/dav/inbox/shot.png</d:href>',
        '<d:href>/dav/inbox/sync/items/9f1e.json</d:href>',
      ),
    })

    const result = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })

    expect(result).toMatchObject({ pulled: 1, skipped: 1, skippedSync: 1, skippedOlder: 0 })
    expect(vault.list().map((item) => item.kind)).toEqual(['link'])
  })

  it('reads `/` as the default directory, not as the bucket root', async () => {
    // The bug behind "synced from another machine and nothing arrived": `/` used
    // to mean the bucket root for the writer (`sync/`) while the ingest already
    // meant `/inbox`, so two machines wrote to two different sync roots.
    const fake = server({
      listing: LISTING.replace(
        '<d:href>/dav/inbox/shot.png</d:href>',
        '<d:href>/dav/inbox/sync/items/9f1e.json</d:href>',
      ),
    })
    const result = await pullRemote(
      vault,
      { baseUrl: 'https://data.cstcloud.cn/dav', directory: '/' },
      { fetch: fake.fetch, attachments: store as unknown as AttachmentStore },
    )
    expect(result).toMatchObject({ skippedSync: 1, skippedForeign: 0, syncRoot: 'inbox/sync' })
  })

  it('reports a sync area that belongs to another machine', async () => {
    // `…/sync/` is skipped either way — it is never filed as files — but a
    // *foreign* one means the two machines disagree about the directory, and
    // that has to be visible: it looks exactly like "nothing new" otherwise.
    const fake = server({
      listing: LISTING.replace(
        '<d:href>/dav/inbox/shot.png</d:href>',
        '<d:href>/dav/inbox/sync/items/9f1e.json</d:href>',
      ),
    })
    const result = await pullRemote(
      vault,
      { baseUrl: 'https://data.cstcloud.cn/dav', directory: '/custom' },
      { fetch: fake.fetch, attachments: store as unknown as AttachmentStore },
    )
    expect(result).toMatchObject({
      skippedForeign: 1,
      skippedSync: 0,
      foreignSyncRoots: ['inbox/sync'],
      syncRoot: 'custom/sync',
    })
  })

  it('names what failed instead of only counting it', async () => {
    // A listing whose file cannot be read: the pull must survive it, and the
    // panel must have something to show that is not just "failed: 1".
    const fake = server({ listing: LISTING })
    const broken: FetchLike = async (url, init) =>
      url.endsWith('.png')
        ? { ok: false, status: 500, text: async () => 'broken', arrayBuffer: async () => new ArrayBuffer(0) }
        : fake.fetch(url, init)

    const result = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: broken,
      attachments: store as unknown as AttachmentStore,
    })

    expect(result.failed).toBe(1)
    expect(result.reason).toContain('shot.png')
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

  it('carries both the gateway body and the identity hint into a refusal', async () => {
    // The real 数据胶囊 answer, which names the cause and says nothing about
    // paths or passwords.
    const fake = server({ refused: { status: 403, body: 'Client type mismatch.' } })
    const result = await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
    })
    expect(result.status).toBe('failed')
    expect(result.reason).toContain('Client type mismatch')
    expect(result.reason).toContain('客户端标识')
  })

  it('presents the configured identity on every request it makes', async () => {
    const fake = server()
    await pullRemote(vault, { baseUrl: 'https://data.cstcloud.cn/dav' }, {
      fetch: fake.fetch,
      attachments: store as unknown as AttachmentStore,
      userAgent: 'Obsidian/1.8.7',
    })
    expect(fake.userAgentSeen.length).toBeGreaterThan(0)
    expect(fake.userAgentSeen.every((seen) => seen === 'Obsidian/1.8.7')).toBe(true)
  })
})

describe('writing one file', () => {
  it('PUTs to the joined path with auth, identity and the bytes', async () => {
    const seen: { url: string; init: { method: string; headers: Record<string, string>; body?: string } }[] = []
    const fetch: FetchLike = async (url, init) => {
      seen.push({ url, init: init as { method: string; headers: Record<string, string>; body?: string } })
      return { ok: true, status: 201, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }
    }

    await writeFile(
      'https://dav.example.com/base/',
      '/inbox/sync/items/a.json',
      new TextEncoder().encode('{"id":"a"}'),
      { fetch, auth: { username: 'u', password: 'p' }, userAgent: 'dsh-inbox/测试' },
      'application/json',
    )

    expect(seen[0]?.url).toBe('https://dav.example.com/base/inbox/sync/items/a.json')
    expect(seen[0]?.init.method).toBe('PUT')
    expect(seen[0]?.init.body).toBe('{"id":"a"}')
    expect(seen[0]?.init.headers['content-type']).toBe('application/json')
    expect(seen[0]?.init.headers.authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    )
    expect(seen[0]?.init.headers['user-agent']).toBe('dsh-inbox/测试')
  })

  it('reports a refusal with the server\u2019s own words', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 403,
      text: async () => 'Forbidden: read-only share',
      arrayBuffer: async () => new ArrayBuffer(0),
    })

    await expect(
      writeFile('https://dav.example.com', 'inbox/sync/items/a.json', new Uint8Array(), { fetch }),
    ).rejects.toThrow(/403.*read-only share/s)
  })

  it('deletes with the same headers, and treats 404 as done', async () => {
    const seen: { url: string; init: { method: string; headers: Record<string, string> } }[] = []
    const answer = (status: number): FetchLike => async (url, init) => {
      seen.push({ url, init })
      return { ok: status < 400, status, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }
    }

    await deleteFile('https://dav.example.com/base', 'inbox/sync/items/a.json', {
      fetch: answer(204),
      auth: { username: 'u', password: 'p' },
      userAgent: 'dsh-inbox/测试',
    })
    expect(seen[0]?.init.method).toBe('DELETE')
    expect(seen[0]?.url).toBe('https://dav.example.com/base/inbox/sync/items/a.json')
    expect(seen[0]?.init.headers.authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    )

    await expect(
      deleteFile('https://dav.example.com', 'gone', { fetch: answer(404) }),
    ).resolves.toBeUndefined()
    await expect(
      deleteFile('https://dav.example.com', 'locked', { fetch: answer(423) }),
    ).rejects.toThrow(/423/)
  })
})
