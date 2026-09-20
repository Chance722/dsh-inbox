/**
 * The one place that turns settings into "somewhere to put and remove objects".
 *
 * Push writes, purge deletes, and both need the same three answers: which
 * protocol, which credentials, and where the vault's own tree begins. Building
 * that twice is how the two halves drift — the push root and the merge root
 * disagreeing by one slash would look exactly like "the other device never sent
 * anything", and a purge that deleted from a different prefix would leave
 * everything behind.
 */

import type { Context } from '@deepseek-ai/cordis'

import { deleteObject, putObject, type S3Config, type S3Deps } from '../s3/client.js'
import { deleteFile, writeFile, type WebdavDeps } from '../webdav/client.js'
import { syncRootFor } from '../../shared/panel-wire.js'
import {
  activeUserAgent,
  readPassword,
  readS3Secret,
  readSettings,
  type WebdavSettings,
} from '../webdav/config.js'
import { s3Fetch, webdavFetch } from '../webdav/run.js'

/** Everything the vault does to the remote. */
export interface RemoteWriter {
  write(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  remove(path: string): Promise<void>
}

/** Either a usable writer, or the reason there is none. */
export type RemoteWriterResult =
  | { status: 'ok'; writer: RemoteWriter; root: string }
  | { status: 'unconfigured'; reason: string }
  | { status: 'failed'; reason: string }

/**
 * Where the vault's own objects live inside the configured directory.
 *
 * @param settings - the remote settings.
 * @returns the path prefix, without a trailing slash.
 */
export function syncRoot(settings: WebdavSettings): string {
  /*
    One rule, shared with the ingest and the panel: `/`, empty and unset all mean
    the default directory. Reading `/` as "the bucket root" is what let two
    machines disagree about where `sync/` lives.
  */
  return syncRootFor(settings.directory)
}

/**
 * Build the writer for whatever this profile is configured with.
 *
 * @param ctx - host context carrying settings and credentials.
 * @returns the writer and the sync root, or why there is none.
 */
export async function remoteWriter(ctx: Context): Promise<RemoteWriterResult> {
  const settings = readSettings(ctx)
  try {
    if (settings.protocol === 's3') {
      if (settings.endpoint.trim().length === 0 || settings.bucket.trim().length === 0) {
        return { status: 'unconfigured', reason: '还没配置 S3 的 endpoint 或 bucket' }
      }
      const secret = await readS3Secret(ctx)
      if (secret === undefined) return { status: 'unconfigured', reason: '还没存 AccessKey Secret' }
      const config: S3Config = {
        endpoint: settings.endpoint,
        bucket: settings.bucket,
        region: settings.region,
        signatureVersion: settings.signatureVersion,
        userAgent: activeUserAgent(settings),
      }
      const deps: S3Deps = {
        fetch: s3Fetch,
        accessKeyId: settings.accessKeyId,
        accessKeySecret: secret,
      }
      return {
        status: 'ok',
        root: syncRoot(settings),
        writer: {
          write: (path, bytes, contentType) => putObject(config, path, bytes, deps, contentType),
          remove: (path) => deleteObject(config, path, deps),
        },
      }
    }

    if (settings.baseUrl.trim().length === 0) {
      return { status: 'unconfigured', reason: '还没配置远端地址' }
    }
    const password = await readPassword(ctx)
    const deps: WebdavDeps = {
      fetch: webdavFetch,
      ...(settings.username.length === 0 || password === undefined
        ? {}
        : { auth: { username: settings.username, password } }),
      userAgent: activeUserAgent(settings),
    }
    const base = settings.baseUrl
    return {
      status: 'ok',
      root: syncRoot(settings),
      writer: {
        write: (path, bytes, contentType) => writeFile(base, path, bytes, deps, contentType),
        remove: (path) => deleteFile(base, path, deps),
      },
    }
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  }
}
