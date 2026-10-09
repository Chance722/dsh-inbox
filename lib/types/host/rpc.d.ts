/**
 * The panel's wire: the browser half submits pasted content, pages the vault,
 * edits and deletes records, and streams attachment bytes back.
 *
 * Transport: exact Fetch routes on the shared `/api` channel. Connection
 * applies its Host/Origin trust fence **and** the signed browser cookie before
 * dispatching anything under `/api`, so the vault is exactly as reachable as
 * the rest of the GUI and no further. A bare `webServer` route would instead
 * answer any process on the machine and any page that can issue a simple
 * cross-origin POST — not somewhere to put a vault.
 *
 * Attachment bytes never enter the vault domain. They go through dsh's own
 * attachment store (content-addressed, normalized, never auto-deleted), and the
 * domain keeps the reference plus the metadata we can show without reading
 * bytes back.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Vault } from './vault/vault.js';
/**
 * Register the panel's endpoints.
 *
 * Both services are optional on purpose: a profile without `connection` (the
 * headless development profiles) still loads this plugin, it just has no panel
 * and therefore no endpoints to serve.
 *
 * Captures are serialised through one promise chain. Repeat detection is a
 * read-then-write pass over the domain, and the domain only serialises each
 * individual write — two overlapping submissions of the same link would
 * otherwise both miss the existing record and store it twice.
 *
 * @param ctx - host context; `apply` does not have to await anything.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export declare function registerInboxRpc(ctx: Context, vault: () => Vault | undefined): void;
