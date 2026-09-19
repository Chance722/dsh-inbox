/**
 * A connection self-test that tries every shape of request a list could take.
 *
 * Guessing at a gateway's quirks from a single 500 costs one round trip per
 * guess. Asking it five questions at once costs one, and the answer says which
 * shape it accepts — or, when none work, that the problem is not the shape.
 *
 * Read-only by construction: every probe is a GET, and none of them write.
 */

import {
  signer,
  signRequestUnsignedPayload,
  signRequestV4Minimal,
  type S3Config,
  type S3Deps,
} from './client.js'

/** One probe's outcome. */
export interface ProbeResult {
  /** What this probe asked for, in Chinese. */
  label: string
  url: string
  status: number
  /** A short excerpt of the answer: the code that explains a refusal. */
  detail: string
}

/** How much of a body to keep: enough for an S3 `<Code>` or a gateway message. */
const EXCERPT = 120

async function probe(
  config: S3Config,
  deps: S3Deps,
  label: string,
  key: string,
  query: Record<string, string>,
  signOverride?: typeof signRequestV4Minimal,
): Promise<ProbeResult> {
  const signed = (signOverride ?? signer(config))(config, deps, 'GET', key, query)
  try {
    const response = await deps.fetch(signed.url, { method: 'GET', headers: signed.headers })
    let detail = ''
    try {
      detail = (await response.text()).trim().slice(0, EXCERPT).replace(/\s+/g, ' ')
    } catch {
      detail = '(读不到响应体)'
    }
    return { label, url: signed.url, status: response.status, detail }
  } catch (error) {
    return {
      label,
      url: signed.url,
      status: 0,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Ask the gateway a handful of questions that differ only in shape.
 *
 * @param config - endpoint, bucket, region, signature version.
 * @param deps - credentials, fetch, clock.
 * @param prefix - the configured prefix, so its handling is under test too.
 * @returns one result per probe, in the order they were tried.
 */
export async function probeS3(
  config: S3Config,
  deps: S3Deps,
  prefix: string,
): Promise<ProbeResult[]> {
  return [
    // Version and region are what a v4 signature covers, and a gateway that
    // checks either will refuse a request whose scope disagrees with it. Trying
    // a few regions at once answers "which one does it want" in one click.
    await probe({ ...config, signatureVersion: 'v4', region: 'us-east-1' }, deps, 'v4 · us-east-1 · 无参数', '', {}),
    await probe(
      { ...config, signatureVersion: 'v4', region: 'us-east-1' },
      deps,
      'v4 精简（只签 host + date）',
      '',
      {},
      signRequestV4Minimal,
    ),
    await probe(
      { ...config, signatureVersion: 'v4', region: 'us-east-1' },
      deps,
      'v4 · UNSIGNED-PAYLOAD（SDK 的常规形态）',
      '',
      {},
      signRequestUnsignedPayload,
    ),
    await probe({ ...config, signatureVersion: 'v4', region: 'cn-north-1' }, deps, 'v4 · cn-north-1 · 无参数', '', {}),
    await probe({ ...config, signatureVersion: 'v4', region: 'cn-northwest-1' }, deps, 'v4 · cn-northwest-1 · 无参数', '', {}),
    await probe({ ...config, signatureVersion: 'v4', region: 'us-east-1' }, deps, 'v4 · us-east-1 · 带 prefix', '', { prefix }),
    await probe({ ...config, signatureVersion: 'v2' }, deps, 'v2 · 无参数', '', {}),
    await probe({ ...config, signatureVersion: 'v2' }, deps, 'v2 · 带 prefix', '', { prefix }),
  ]
}
