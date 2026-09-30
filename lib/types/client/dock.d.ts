/**
 * The vault's second home: a tab in the right dock, next to the conversation.
 *
 * A tab type is registered in two stages — the type itself into
 * `ctx.sidebarRightTabs`, its body into the keyed `sidebar.right.pane.tab` seat
 * under the same `id` — and opened by kind through `ctx.sidebarRight.openTab`.
 * That is the documented third-party path (`ui-sidebar-documentpreview` is the
 * shipped proof), not a private door.
 *
 * The dock is a *convenience*, not a source of truth: it fetches the newest
 * records itself and shows them; every action still lives in the panel. It also
 * has to survive compositions with no right dock at all (a headless profile has
 * no browser), so `registerInboxDock` does nothing when the services are absent.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Type discriminator: what `openTab` names. */
export declare const DOCK_KIND = "inbox-vault";
/** Also the tab-type id and the key its body registers under. */
export declare const DOCK_TAB_ID = "@chance722/dsh-inbox";
/**
 * A caller that can reveal the tab — optionally focused on one record.
 *
 * It cannot be used from the inbox panel: the dock belongs to the *session*
 * surface, and showing the panel unmounts that surface — calling `openTab` from
 * there fails with `sidebarRight: no session surface is mounted` (measured).
 * Whoever opens it has to be standing in a conversation — which is exactly where
 * a conversation card is, so `card.tsx` is the caller that matters: click a
 * record the assistant mentioned and the dock opens on it.
 *
 * @param id - the record to focus; omitted opens the tab on its usual list.
 */
export declare let openVaultDock: ((id?: string) => void) | undefined;
/**
 * Which record the tab was opened on, and how many times it has been navigated.
 *
 * Pulled out of the component so the reading can be tested: the shape is the
 * platform's, not ours, and getting it wrong is silent — the dock falls back to
 * its list and 「打开 ↗」 looks like it does nothing.
 *
 * @param info - whatever the tab-information hook answered, untyped on purpose.
 * @returns the record id when the opener named one, plus the navigation revision.
 */
export declare function dockFocusOf(info: unknown): {
    id?: string;
    revision: number;
};
/**
 * Register the tab type and its body.
 *
 * @param ctx - the browser plugin context.
 */
export declare function registerInboxDock(ctx: Context): void;
