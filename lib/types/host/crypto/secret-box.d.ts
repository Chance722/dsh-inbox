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
/** Work factors, recorded beside the salt so a future change can still open old boxes. */
export interface KdfParams {
    n: number;
    r: number;
    p: number;
}
/**
 * 2^15 · r8 · p1: ~100ms and ~33MB on the development machine — slow enough to
 * be a speed bump for a guesser, fast enough that unlocking does not feel broken.
 */
export declare const DEFAULT_KDF: KdfParams;
/** A fresh salt, one per master password. */
export declare function newSalt(): Buffer;
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
export declare function deriveKey(password: string, salt: Buffer, kdf?: KdfParams): Buffer;
/**
 * Seal one string.
 *
 * @param key - a key from {@link deriveKey}.
 * @param plaintext - what must not be readable on disk.
 * @returns the envelope to store: `v1:iv:tag:ciphertext`, all base64.
 */
export declare function seal(key: Buffer, plaintext: string): string;
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
export declare function open(key: Buffer, envelope: string): string | undefined;
