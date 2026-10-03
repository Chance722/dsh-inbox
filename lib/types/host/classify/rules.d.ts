/**
 * The deterministic half of classification.
 *
 * Rules decide what they can prove — a platform's media type, a credential by
 * shape, an ID document by aspect ratio — and say `unsure` about the rest
 * instead of guessing. That word is the seam a model pass can use later without
 * ever overriding something the *user* said.
 *
 * Nothing here reads bytes or calls anything: every input is text or numbers the
 * vault already holds, so the whole layer is a pure function and cheap to run at
 * paste time.
 */
import type { Category } from '../../shared/vocabulary.js';
/** One rule's verdict. */
export interface Classification {
    category: Category;
    /** Set when the rule recognised the host and can name it. */
    platform?: string;
    /** `unsure` means "a model could do better", never "this is wrong". */
    confidence: 'decided' | 'unsure';
    /** Which rule fired, in Chinese, for the record's tooltip and for debugging. */
    reason: string;
    /** Extra tags a rule wants to attach, e.g. a suspected ID document. */
    tags?: readonly string[];
}
/** True when the text carries something that must never be echoed. */
export declare function findSecret(text: string): string | undefined;
/** The platform a URL belongs to, or undefined when it is just "somewhere". */
export declare function platformOf(url: string): string | undefined;
/**
 * Classify a link by its host and path.
 *
 * @param url - the pasted URL.
 * @returns the verdict; `unsure` for a host no rule knows.
 */
export declare function classifyLink(url: string): Classification;
/**
 * Classify a pasted string.
 *
 * @param text - exactly what was pasted.
 * @returns a secret verdict, or `unsure` — plain text rarely proves its own kind.
 */
export declare function classifyText(text: string): Classification;
/**
 * Classify an image from the dimensions the store already recorded.
 *
 * A ratio is evidence, not proof, so a suspected ID document stays `image` and
 * gains a tag: only the user can promote it to the `document` category, which is
 * exactly what the product decision asks for. No bytes are read, and nothing is
 * uploaded to decide this.
 *
 * @param dimensions - stored width/height, when known.
 * @returns the verdict.
 */
export declare function classifyImage(input: {
    width?: number;
    height?: number;
    /** The media type, when the caller knows it — a dropped file is not a photo. */
    mime?: string;
}): Classification;
