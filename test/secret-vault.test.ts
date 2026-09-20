/**
 * Credentials at rest.
 *
 * The tests that matter here are the ones that read the *disk*: it is easy to
 * write a "sealed" field and still leave the plaintext somewhere (the old
 * `text` field, a preview, a log line), and only a file-level check catches it.
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { captureText } from '../src/host/capture.js'
import { DEFAULT_KDF, deriveKey, newSalt, open, seal } from '../src/host/crypto/secret-box.js'
import { Vault, VaultLockedError } from '../src/host/vault/vault.js'

/** The credential these tests paste. */
const CREDENTIAL = 'secretId=AKIDexample secretKey=abcdef123456'

describe('the secret box', () => {
  it('round-trips, and never twice the same bytes', () => {
    const key = deriveKey('hunter2', newSalt(), DEFAULT_KDF)
    const first = seal(key, '要保住的东西')
    const second = seal(key, '要保住的东西')

    expect(open(key, first)).toBe('要保住的东西')
    // Two seals of the same plaintext differ: the nonce is random, so a reader
    // cannot even tell that two records hold the same value.
    expect(first).not.toBe(second)
    expect(first.startsWith('v1:')).toBe(true)
  })

  it('refuses a wrong key, a tampered envelope and a foreign format', () => {
    const salt = newSalt()
    const key = deriveKey('right', salt, DEFAULT_KDF)
    const other = deriveKey('wrong', salt, DEFAULT_KDF)
    const envelope = seal(key, 'payload')

    expect(open(other, envelope)).toBeUndefined()
    // Flipping one ciphertext byte must fail the tag, not decrypt into garbage.
    const parts = envelope.split(':')
    const body = Buffer.from(parts[3] ?? '', 'base64')
    body[0] = (body[0] ?? 0) ^ 0xff
    expect(open(key, ['v1', parts[1], parts[2], body.toString('base64')].join(':'))).toBeUndefined()
    expect(open(key, 'v2:a:b:c')).toBeUndefined()
    expect(open(key, 'not an envelope')).toBeUndefined()
  })

  it('derives the same key from the same password, and normalises first', () => {
    const salt = newSalt()
    expect(deriveKey('  spaced  ', salt).equals(deriveKey('  spaced  ', salt))).toBe(true)
    // NFKC: a password typed on another keyboard must still open the vault.
    expect(deriveKey('ｐａｓｓ', salt).equals(deriveKey('pass', salt))).toBe(true)
    expect(deriveKey('a', salt).equals(deriveKey('b', salt))).toBe(false)
  })
})

describe('credentials in a real vault', () => {
  let root: string
  let ctx: Context
  let vault: Vault

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-inbox-secret-'))
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

  /** Every byte of the domain as it sits on disk. */
  async function onDisk(): Promise<string> {
    const dir = join(root, 'dsh_inbox')
    // Before anything is written the domain has no directory at all; that is a
    // legitimate "nothing on disk" answer, not a failure.
    const files = await readdir(dir, { recursive: true }).catch(() => [] as string[])
    const bodies = await Promise.all(
      files
        .filter((name) => name.endsWith('.json'))
        .map((name) => readFile(join(dir, name), 'utf8')),
    )
    return bodies.join('\n')
  }

  it('refuses to file a credential while it has no key to seal it with', async () => {
    await expect(captureText(vault, CREDENTIAL, 'panel')).rejects.toBeInstanceOf(VaultLockedError)
    // Nothing half-written: no record, and the plaintext is not on disk.
    expect(vault.list()).toHaveLength(0)
    expect(await onDisk()).not.toContain('abcdef123456')
  })

  it('seals a pasted credential, and the disk never sees the plaintext', async () => {
    await vault.setMasterPassword('主密码')
    const filed = await captureText(vault, CREDENTIAL, 'panel')

    const stored = vault.get(filed.item.id)
    expect(stored?.category).toBe('secret')
    expect(stored?.text).toBeUndefined()
    expect(stored?.secret?.startsWith('v1:')).toBe(true)
    expect(vault.secretText(stored!)).toBe(CREDENTIAL)

    const disk = await onDisk()
    expect(disk).not.toContain('AKIDexample')
    expect(disk).not.toContain('abcdef123456')
    // The digest is the one thing about the value that survives, and it is a
    // keyed hash: useless without the key.
    expect(stored?.secretDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(disk).toContain(stored?.secretDigest ?? 'no-digest')
  })

  it('still recognises a re-paste of the same credential', async () => {
    await vault.setMasterPassword('主密码')
    const first = await captureText(vault, CREDENTIAL, 'panel')
    const again = await captureText(vault, CREDENTIAL, 'panel', '腾讯云测试环境')

    expect(again.merged).toBe(true)
    expect(again.item.id).toBe(first.item.id)
    expect(vault.size).toBe(1)
    expect(vault.secretText(vault.get(first.item.id)!)).toBe(CREDENTIAL)
  })

  it('locks and unlocks, and a wrong password opens nothing', async () => {
    await vault.setMasterPassword('主密码')
    const filed = await captureText(vault, CREDENTIAL, 'panel')
    vault.lock()

    expect(vault.lockState).toEqual({ configured: true, unlocked: false })
    expect(vault.secretText(vault.get(filed.item.id)!)).toBeUndefined()
    expect(await vault.unlock('猜的')).toBe(false)
    expect(vault.secretText(vault.get(filed.item.id)!)).toBeUndefined()
    expect(await vault.unlock('主密码')).toBe(true)
    expect(vault.lockState.unlocked).toBe(true)
    expect(vault.secretText(vault.get(filed.item.id)!)).toBe(CREDENTIAL)
  })

  it('moves credentials that were already on disk in plain text', async () => {
    // A version-5 vault: a `secret` record whose body sits in `text`.
    const legacy = await vault.create({
      kind: 'text',
      category: 'secret',
      source: 'panel',
      text: CREDENTIAL,
    })
    expect(await onDisk()).toContain('abcdef123456')

    await vault.setMasterPassword('主密码')

    const migrated = vault.get(legacy.id)
    expect(migrated?.text).toBeUndefined()
    expect(migrated?.secret?.startsWith('v1:')).toBe(true)
    expect(vault.secretText(migrated!)).toBe(CREDENTIAL)
    expect(await onDisk()).not.toContain('abcdef123456')
  })

  it('re-seals everything when the master password is changed', async () => {
    await vault.setMasterPassword('旧密码')
    const filed = await captureText(vault, CREDENTIAL, 'panel')

    expect(vault.lockState.configured).toBe(true)
    // Changing it re-derives with a fresh salt and keeps the record readable.
    await vault.setMasterPassword('新密码')
    expect(vault.secretText(vault.get(filed.item.id)!)).toBe(CREDENTIAL)
    expect(await vault.unlock('旧密码')).toBe(false)

    vault.lock()
    expect(await vault.unlock('新密码')).toBe(true)
    expect(vault.secretText(vault.get(filed.item.id)!)).toBe(CREDENTIAL)
  })

  it('refuses to change the password while locked, rather than orphaning the ciphertext', async () => {
    await vault.setMasterPassword('旧密码')
    const filed = await captureText(vault, CREDENTIAL, 'panel')
    vault.lock()

    await expect(vault.setMasterPassword('新密码')).rejects.toThrow(/解锁/)
    // The record still opens with the password it was sealed with.
    expect(await vault.unlock('旧密码')).toBe(true)
    expect(vault.secretText(vault.get(filed.item.id)!)).toBe(CREDENTIAL)
  })
})
