/**
 * Masking for anything that would otherwise leave the machine.
 *
 * The vault's rule is that credential text never reaches a model. Classification
 * only needs the *shape* of a message, so the shape is what we keep: labels stay
 * readable, values become a placeholder of the same rough length.
 *
 * Pure and byte-free — no key store, no provider, no side effects.
 */
/**
 * Replace credential values with a fixed-width placeholder.
 *
 * @param text - the text that might leave the machine.
 * @returns the same text with values masked; labels survive.
 */
export declare function redact(text: string): string;
/** Whether a redacted string still carries a recognisable credential shape. */
export declare function looksRedacted(text: string): boolean;
