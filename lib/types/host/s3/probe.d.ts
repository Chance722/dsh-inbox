/**
 * A connection self-test that tries every shape of request a list could take.
 *
 * Guessing at a gateway's quirks from a single 500 costs one round trip per
 * guess. Asking it five questions at once costs one, and the answer says which
 * shape it accepts — or, when none work, that the problem is not the shape.
 *
 * Read-only by construction: every probe is a GET, and none of them write.
 */
import { type S3Config, type S3Deps } from './client.js';
/** One probe's outcome. */
export interface ProbeResult {
    /** What this probe asked for, in Chinese. */
    label: string;
    url: string;
    status: number;
    /** A short excerpt of the answer: the code that explains a refusal. */
    detail: string;
}
/**
 * Ask the gateway a handful of questions that differ only in shape.
 *
 * @param config - endpoint, bucket, region, signature version.
 * @param deps - credentials, fetch, clock.
 * @param prefix - the configured prefix, so its handling is under test too.
 * @returns one result per probe, in the order they were tried.
 */
export declare function probeS3(config: S3Config, deps: S3Deps, prefix: string): Promise<ProbeResult[]>;
