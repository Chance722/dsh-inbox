/**
 * The self-test: one sentence out of the rows, and one honest row out of a
 * WebDAV folder.
 *
 * The verdict is what a person reads; the rows are what they read when the
 * verdict is bad. Both are pinned here because the failure modes they describe
 * (same status, four different causes) are exactly the ones that wasted an
 * afternoon in M6.
 */

import { describe, expect, it } from 'vitest'

import { probeVerdict, type ProbeRow } from '../src/shared/panel-wire.js'
import { probeWebdav } from '../src/host/webdav/probe.js'
import type { FetchLike } from '../src/host/webdav/client.js'

function row(status: number, label = 'v4 · us-east-1 · 无参数', detail = ''): ProbeRow {
  return { label, url: 'https://example.com/bucket', status, detail }
}

describe('probeVerdict', () => {
  it('says yes, and names the shape that worked', () => {
    const verdict = probeVerdict([row(403), row(200, 'v4 精简（只签 host + date）')])
    expect(verdict.ok).toBe(true)
    expect(verdict.title).toBe('通道可用（可用形状：v4 精简）')
  })

  it('counts a listing answer as success', () => {
    // WebDAV's PROPFIND answers 207; a range read answers 206.
    expect(probeVerdict([row(207)]).ok).toBe(true)
    expect(probeVerdict([row(206)]).ok).toBe(true)
  })

  it('reads a wall of 401 as "the gateway does not recognise us"', () => {
    const verdict = probeVerdict([row(401), row(401), row(401)])
    expect(verdict.ok).toBe(false)
    expect(verdict.title).toContain('认证被拒')
    expect(verdict.hint).toContain('客户端标识')
  })

  it('separates 403, 404 and a dead connection', () => {
    expect(probeVerdict([row(403)]).title).toContain('权限被拒')
    expect(probeVerdict([row(404)]).title).toContain('路径不存在')
    const offline = probeVerdict([row(0, 'v2 · 无参数', 'fetch failed: ENOTFOUND')])
    expect(offline.title).toBe('连不上')
    expect(offline.hint).toContain('ENOTFOUND')
  })

  it('admits uncertainty rather than guessing', () => {
    const mixed = probeVerdict([row(500), row(400)])
    expect(mixed.ok).toBe(false)
    expect(mixed.title).toContain('500 / 400')
    expect(probeVerdict([]).title).toBe('没有可用的自检结果')
  })
})

describe('probeWebdav', () => {
  const answer = (status: number, body = ''): FetchLike =>
    async () => ({ ok: status < 400, status, text: async () => body, arrayBuffer: async () => new ArrayBuffer(0) })

  it('asks the configured folder with the configured credentials and identity', async () => {
    const seen: { url: string; init: { method: string; headers: Record<string, string> } }[] = []
    const fetch: FetchLike = async (url, init) => {
      seen.push({ url, init })
      return { ok: true, status: 207, text: async () => '<xml/>', arrayBuffer: async () => new ArrayBuffer(0) }
    }

    const rows = await probeWebdav(
      { fetch, auth: { username: 'u', password: 'p' }, userAgent: 'dsh-inbox/测试' },
      'https://dav.example.com/base/',
      '/inbox',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe(207)
    expect(seen[0]?.url).toBe('https://dav.example.com/base/inbox')
    expect(seen[0]?.init.method).toBe('PROPFIND')
    expect(seen[0]?.init.headers['user-agent']).toBe('dsh-inbox/测试')
    expect(seen[0]?.init.headers.authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    )
  })

  it('reports a refusal and a dead host as rows, never as a throw', async () => {
    const refused = await probeWebdav({ fetch: answer(401, 'unauthorized') }, 'https://dav.example.com', '/inbox')
    expect(refused[0]?.status).toBe(401)
    expect(probeVerdict(refused).title).toContain('认证被拒')

    const dead = await probeWebdav(
      {
        fetch: async () => {
          throw new Error('getaddrinfo ENOTFOUND dav.example.com')
        },
      },
      'https://dav.example.com',
      '/inbox',
    )
    expect(dead[0]?.status).toBe(0)
    expect(probeVerdict(dead).title).toBe('连不上')
  })
})
