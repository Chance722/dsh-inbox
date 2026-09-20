/**
 * The box a credential's text is kept in.
 *
 * Nothing here decides *when* to seal — that is the vault's job (`vault.ts`) —
 * this module is only the arithmetic: derive a key from a password, seal a
 * string, open it again, and say clearly when the envelope is not ours.
 *
 * Deliberate choices:
 * - **scrypt**, not a plain hash: a master password is a person's password, and
 *   the cost of guessing it has to be paid per attempt.
 * - **AES-256-GCM**, not CBC: a credential whose bytes were altered should fail
 *   to open, loudly, rather than decrypt into plausible garbage.
 * - the envelope names its own version, so a later format can be read *and*
 *   told apart from this one.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/** Work factors, recorded beside the salt so a future change can still open old boxes. */
export interface KdfParams {
  n: number
  r: number
  p: number
}

/**
 * 2^15 · r8 · p1: ~100ms and ~33MB on the development machine — slow enough to
 * be a speed bump for a guesser, fast enough that unlocking does not feel broken.
 */
export const DEFAULT_KDF: KdfParams = { n: 32768, r: 8, p: 1 }

/** Bytes in a derived key (`aes-256-gcm` wants exactly this). */
const KEY_BYTES = 32
/** Bytes in a GCM nonce. Random per seal; the same key never reuses one twice. */
const IV_BYTES = 12
/** Bytes in a GCM tag. */
const TAG_BYTES = 16
/** Envelope version this module writes, and the only one it reads. */
const PREFIX = 'v1'
/** scrypt refuses to allocate past `maxmem`; the default is smaller than N·r needs. */
const MAX_MEM = 96 * 1024 * 1024

/** A fresh salt, one per master password. */
export function newSalt(): Buffer {
  return randomBytes(16)
}

/**
 * Derive the sealing key from a master password.
 *
 * The password is normalised first: the same characters typed on another
 * keyboard (or pasted from a password manager) must derive the same key.
 *
 * @param password - what the user typed.
 * @param salt - the salt stored beside the KDF parameters.
 * @param kdf - the recorded work factors.
 * @returns the 32-byte key.
 */
export function deriveKey(password: string, salt: Buffer, kdf: KdfParams = DEFAULT_KDF): Buffer {
  return scryptSync(password.normalize('NFKC'), salt, KEY_BYTES, {
    N: kdf.n,
    r: kdf.r,
    p: kdf.p,
    maxmem: MAX_MEM,
  })
}

/**
 * Seal one string.
 *
 * @param key - a key from {@link deriveKey}.
 * @param plaintext - what must not be readable on disk.
 * @returns the envelope to store: `v1:iv:tag:ciphertext`, all base64.
 */
export function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    PREFIX,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    body.toString('base64'),
  ].join(':')
}

/**
 * Open one envelope.
 *
 * Every way of failing — a wrong password, a truncated field, a tampered byte —
 * comes back as `undefined`. Callers cannot tell them apart, and should not:
 * the only useful question is "can this be read with the key I have".
 *
 * @param key - a key from {@link deriveKey}.
 * @param envelope - what {@link seal} returned.
 * @returns the plaintext, or undefined when this key cannot open it.
 */
export function open(key: Buffer, envelope: string): string | undefined {
  const parts = envelope.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return undefined
  try {
    const iv = Buffer.from(parts[1] ?? '', 'base64')
    const tag = Buffer.from(parts[2] ?? '', 'base64')
    const body = Buffer.from(parts[3] ?? '', 'base64')
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return undefined
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    return undefined
  }
}
