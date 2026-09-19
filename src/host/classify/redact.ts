/**
 * Masking for anything that would otherwise leave the machine.
 *
 * The vault's rule is that credential text never reaches a model. Classification
 * only needs the *shape* of a message, so the shape is what we keep: labels stay
 * readable, values become a placeholder of the same rough length.
 *
 * Pure and byte-free — no key store, no provider, no side effects.
 */

/** Label + value pairs whose value must go. */
const ASSIGNMENT =
  /\b((?:secret|access)[-_]?(?:id|key)|api[-_]?key|apikey|password|passwd|pwd|token|bearer)\b(\s*[:=]\s*)("[^"]{4,}"|'[^']{4,}'|\S{4,})/gi

/** Standalone tokens whose shape alone identifies them. */
const TOKENS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bmongodb(\+srv)?:\/\/[^\s:@]+:[^\s:@]+@/gi,
]

/** A private key block, everything between the markers included. */
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g

/** Keep the value's rough length so the shape of the text still reads true. */
function mask(value: string): string {
  const length = Math.max(4, Math.min(24, value.length))
  return '•'.repeat(length)
}

/**
 * Replace credential values with a fixed-width placeholder.
 *
 * @param text - the text that might leave the machine.
 * @returns the same text with values masked; labels survive.
 */
export function redact(text: string): string {
  let out = text.replace(PRIVATE_KEY, '«私钥已脱敏»')
  out = out.replace(ASSIGNMENT, (_match, label: string, separator: string, value: string) =>
    `${label}${separator}${mask(value)}`,
  )
  for (const pattern of TOKENS) {
    out = out.replace(pattern, (match) => mask(match))
  }
  return out
}

/** Whether a redacted string still carries a recognisable credential shape. */
export function looksRedacted(text: string): boolean {
  return text.includes('•') || text.includes('«私钥已脱敏»')
}
