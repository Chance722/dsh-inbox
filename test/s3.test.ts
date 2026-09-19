/**
 * The S3 client: signing, listing and reading.
 *
 * The signing test pins the *canonical request* text, which is the part a human
 * can verify by reading it, plus the determinism of the whole chain. A full
 * AWS conformance vector would be better; the real server is what settles it,
 * and that is what the acceptance run does.
 */

import { describe, expect, it } from 'vitest'

import {
  amzDate,
  listPrefix,
  parseListing,
  readObject,
  rfc1123,
  signRequestV2,
  signRequest,
  signer,
  type S3Deps,
  type S3FetchLike,
} from '../src/host/s3/client.js'

const CONFIG = {
  endpoint: 'https://data.cstcloud.cn',
  bucket: 'my-bucket',
  region: 'us-east-1',
}

function deps(fetchImpl?: S3FetchLike): S3Deps {
  return {
    accessKeyId: 'AKIDEXAMPLE',
    accessKeySecret: 'secret-key',
    now: new Date('2026-09-19T06:30:00.000Z'),
    fetch:
      fetchImpl ??
      (async () => ({ ok: true, status: 200, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) })),
  }
}

describe('signing', () => {
  it('formats the date the way SigV4 requires', () => {
    expect(amzDate(new Date('2026-09-19T06:30:00.000Z'))).toBe('20260919T063000Z')
  })

  it('builds the canonical request a reader can check by eye', () => {
    const signed = signRequest(CONFIG, deps(), 'GET', '', {
      prefix: 'inbox/',
      'list-type': '2',
    })
    // Query parameters are sorted by name; `inbox/` is encoded but not escaped
    // as a path, because it is a value.
    expect(signed.canonicalRequest.split('\n')[0]).toBe('GET')
    expect(signed.canonicalRequest.split('\n')[1]).toBe('/my-bucket')
    expect(signed.canonicalRequest.split('\n')[2]).toBe('list-type=2&prefix=inbox%2F')
    expect(signed.canonicalRequest).toContain('host:data.cstcloud.cn\n')
    expect(signed.canonicalRequest).toContain('x-amz-date:20260919T063000Z\n')
    expect(signed.canonicalRequest.split('\n').at(-2)).toBe(
      'host;x-amz-content-sha256;x-amz-date',
    )
    // An empty body: the SHA-256 of nothing, well known and easy to spot.
    expect(signed.canonicalRequest.split('\n').at(-1)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('puts the bucket and key in the path, path-style', () => {
    const signed = signRequest(CONFIG, deps(), 'GET', 'inbox/shot 1.png')
    expect(signed.url).toBe('https://data.cstcloud.cn/my-bucket/inbox/shot%201.png')
  })

  it('authorizes with the credential scope and a stable signature', () => {
    const first = signRequest(CONFIG, deps(), 'GET', 'inbox/a.txt')
    const second = signRequest(CONFIG, deps(), 'GET', 'inbox/a.txt')
    expect(first.headers.authorization).toContain('Credential=AKIDEXAMPLE/20260919/us-east-1/s3/aws4_request')
    expect(first.headers.authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date')
    expect(first.signature).toBe(second.signature)
    expect(first.signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes the signature when the secret, the day or the region changes', () => {
    const base = signRequest(CONFIG, deps(), 'GET', 'inbox/a.txt').signature
    const otherSecret = signRequest(
      CONFIG,
      { ...deps(), accessKeySecret: 'another' },
      'GET',
      'inbox/a.txt',
    ).signature
    const otherDay = signRequest(
      CONFIG,
      { ...deps(), now: new Date('2026-09-20T06:30:00.000Z') },
      'GET',
      'inbox/a.txt',
    ).signature
    const otherRegion = signRequest({ ...CONFIG, region: 'cn-north-1' }, deps(), 'GET', 'inbox/a.txt')
      .signature

    for (const other of [otherSecret, otherDay, otherRegion]) expect(other).not.toBe(base)
  })
})

describe('signing with v2', () => {
  it('signs the date and the canonical resource, in RFC 1123', () => {
    const signed = signRequestV2(CONFIG, deps(), 'GET', '')
    expect(rfc1123(new Date('2026-09-19T06:30:00.000Z'))).toBe('Sat, 19 Sep 2026 06:30:00 GMT')
    // Method, empty MD5, empty content type, date, canonical resource.
    expect(signed.stringToSign).toBe(
      [
        'GET',
        '',
        '',
        'Sat, 19 Sep 2026 06:30:00 GMT',
        '/my-bucket',
      ].join('\n'),
    )
    expect(signed.headers.authorization).toMatch(/^AWS AKIDEXAMPLE:/)
    expect(signed.headers.date).toBe('Sat, 19 Sep 2026 06:30:00 GMT')
  })

  it('keeps ordinary query parameters out of the signed resource', () => {
    // `prefix` and `list-type` are not sub-resources, so they stay in the URL
    // and out of the signature; `acl` would be signed.
    const listed = signRequestV2(CONFIG, deps(), 'GET', '', { prefix: 'inbox/', 'list-type': '2' })
    expect(listed.stringToSign.endsWith('/my-bucket')).toBe(true)
    expect(listed.url).toBe('https://data.cstcloud.cn/my-bucket?list-type=2&prefix=inbox%2F')
    expect(signRequestV2(CONFIG, deps(), 'GET', '', { acl: '' }).stringToSign.endsWith('/my-bucket?acl')).toBe(true)
  })

  it('accepts a scheme-less endpoint, because the config layer adds https', () => {
    const signed = signRequestV2({ ...CONFIG, endpoint: 'https://s3.cstcloud.cn' }, deps(), 'GET', 'a.txt')
    expect(signed.url).toBe('https://s3.cstcloud.cn/my-bucket/a.txt')
  })

  it('routes through the signer the configuration asks for', () => {
    expect(signer({ ...CONFIG, signatureVersion: 'v2' })).toBe(signRequestV2)
    expect(signer({ ...CONFIG, signatureVersion: 'v4' })).toBe(signRequest)
    expect(signer(CONFIG)).toBe(signRequest)
  })
})

describe('listing', () => {
  const LISTING = `<?xml version="1.0"?>
<ListBucketResult>
  <Contents><Key>inbox/a.txt</Key><LastModified>2026-09-19T06:00:00.000Z</LastModified><Size>42</Size></Contents>
  <Contents><Key>inbox/b&amp;c.png</Key><LastModified>2026-09-19T06:05:00.000Z</LastModified><Size>4096</Size></Contents>
</ListBucketResult>`

  it('reads keys, dates and sizes, unescaping the entities', () => {
    expect(parseListing(LISTING)).toEqual([
      { key: 'inbox/a.txt', lastModified: '2026-09-19T06:00:00.000Z', bytes: 42 },
      { key: 'inbox/b&c.png', lastModified: '2026-09-19T06:05:00.000Z', bytes: 4096 },
    ])
  })

  it('asks for the prefix with a signed, path-style request', async () => {
    const seen: { url: string; auth: string }[] = []
    const result = await listPrefix(CONFIG, 'inbox/', deps(async (url, init) => {
      seen.push({ url, auth: init.headers.authorization ?? '' })
      return { ok: true, status: 200, text: async () => LISTING, arrayBuffer: async () => new ArrayBuffer(0) }
    }))

    expect(result).toHaveLength(2)
    expect(seen[0]?.url).toBe('https://data.cstcloud.cn/my-bucket?list-type=2&prefix=inbox%2F')
    expect(seen[0]?.auth).toContain('AWS4-HMAC-SHA256')
  })

  it('reports a refused listing instead of throwing something opaque', async () => {
    await expect(
      listPrefix(
        CONFIG,
        'inbox/',
        deps(async () => ({
          ok: false,
          status: 401,
          text: async () =>
            '<Error><Code>SignatureDoesNotMatch</Code><Message>check your secret</Message></Error>',
          arrayBuffer: async () => new ArrayBuffer(0),
          headers: { get: (name) => (name === 'www-authenticate' ? 'AWS4-HMAC-SHA256' : null) },
        })),
      ),
    ).rejects.toThrow(/HTTP 401.*SignatureDoesNotMatch.*WWW-Authenticate/)
  })

  it('reads one object with its content type', async () => {
    const body = new TextEncoder().encode('hello')
    const result = await readObject(CONFIG, 'inbox/a.txt', deps(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
      headers: { get: () => 'text/plain; charset=utf-8' },
    })))
    expect(new TextDecoder().decode(result.bytes)).toBe('hello')
    expect(result.contentType).toBe('text/plain')
  })
})
