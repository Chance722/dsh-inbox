/**
 * Capture rules: what a pasted thing is, how to spot a repeat, and how to file
 * it. Everything here is deterministic; classification proper (which category a
 * link or an image belongs to) is M5's job.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Source } from '../shared/vocabulary.js';
import { platformOf, type Classification } from './classify/rules.js';
import type { Attachment, Item } from './vault/spec.js';
import type { Vault } from './vault/vault.js';
/**
 * Decide what a pasted string is.
 *
 * A single bare `http(s)` URL is a link; anything else is text. A sentence that
 * merely contains a URL stays text: the vault must not reinterpret prose.
 *
 * @param raw - exactly what was pasted.
 * @returns the kind, plus url and (when recognised) platform for links.
 */
export declare function sniff(raw: string): {
    kind: 'link' | 'text';
    url?: string;
    platform?: string;
};
/**
 * Normalise a link for repeat detection: drop the fragment and the parameters
 * that only record where a share came from, and unify the host case.
 *
 * Deliberately conservative — real identity lives in paths (`/s/<id>`,
 * `/video/BV…`) and in the parameters we keep.
 */
export declare function normalizeLink(raw: string): string;
/** The outcome of a capture: what was stored, and whether it merged. */
export interface CaptureOutcome {
    item: Item;
    /** True when an existing record absorbed this capture. */
    merged: boolean;
    /**
     * True when the record it absorbed into was sitting in the recycle bin and
     * has just been taken back out (see `absorb`).
     */
    restored: boolean;
    /** What the rules concluded, so a caller can decide whether to ask a model. */
    verdict: Classification;
}
/**
 * File a pasted string.
 *
 * Repeats merge into the existing record: the vault answers "what have I
 * stored", not "how many times did I paste".
 *
 * @param vault - the open vault.
 * @param raw - the pasted string.
 * @param source - which entry point produced it.
 * @param note - optional description the user supplied.
 * @returns the stored (or merged) record, and whether it merged.
 */
export declare function captureText(vault: Vault, raw: string, source: Source, note?: string): Promise<CaptureOutcome>;
/** Re-exported so callers do not reach into the rules module for this. */
export { platformOf };
/**
 * Attachment reference as it arrives from the composer's durable blocks.
 * `id` is the *store's* id, not ours.
 */
export type CapturedAttachment = Pick<Attachment, 'mime' | 'bytes'> & {
    id: string;
} & Partial<Pick<Attachment, 'filename' | 'width' | 'height' | 'sha256'>>;
/**
 * File one durable attachment the composer handed over.
 *
 * The bytes stay in dsh's own attachment store (content-addressed, never
 * auto-deleted); the vault keeps the reference plus what we can show without
 * reading the bytes back.
 *
 * @param vault - the open vault.
 * @param attachment - the block's attachment reference.
 * @param source - which entry point produced it.
 * @param note - optional description the user supplied.
 * @returns the stored (or merged) record, and whether it merged.
 */
export declare function captureImage(vault: Vault, attachment: CapturedAttachment, source: Source, note?: string): Promise<CaptureOutcome>;
/** What one capture submission carried: free text and/or durable attachments. */
export interface CapturePayload {
    text?: string;
    attachments?: readonly CapturedAttachment[];
}
/** Roll-up of one capture submission. */
export interface CaptureSummary {
    stored: number;
    /** Records that absorbed this capture. */
    merged: number;
    /**
     * Of those, the ones that were in the recycle bin and came back out.
     *
     * Counted separately because it is the difference between "you already had
     * this" and "you had deleted this, so I put it back" — the panel says the
     * second one in its own words.
     */
    restored: number;
}
/** What a caller may want to do once something is safely stored. */
export interface CaptureOptions {
    /** When present, records no rule could judge are handed to the model. */
    ctx?: Context;
}
/**
 * File one submission from any entry point.
 *
 * Order is attachments first, then text, so a note that arrived with the
 * submission can still be attached to the item it belongs to.
 *
 * @param vault - the open vault.
 * @param payload - the submitted text and attachments.
 * @param source - which entry point produced them.
 * @returns how many records were stored and how many merged.
 */
export declare function capture(vault: Vault, payload: CapturePayload, source: Source, options?: CaptureOptions): Promise<CaptureSummary>;
