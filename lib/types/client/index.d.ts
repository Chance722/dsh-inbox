/**
 * The browser half: the sidebar entry, the capture box, the filter bar, the
 * list, and the detail pane.
 *
 * Everything the vault knows lives on the host side; this half only renders and
 * calls the Fetch routes declared in `src/shared/panel-wire.ts`.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name for the browser half. */
export declare const name = "dsh-inbox-client";
/**
 * `slots` is a hard dependency: without it Cordis runs `apply` before the slot
 * registry exists and every registration is silently skipped (M0's trap).
 */
export declare const inject: string[];
/**
 * Register the sidebar switch and the panel it selects.
 *
 * Both slots belong to other packages, so each registration waits for the
 * declaration through `slots.inject` instead of assuming an order.
 *
 * @param ctx - browser plugin context carrying the slot registry.
 */
export declare function apply(ctx: Context): void;
