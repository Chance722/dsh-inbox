/**
 * The conversation cards for `inbox_search` and `inbox_get`.
 *
 * Cards are derived from the raw tool-call block (the model-facing result), not
 * from any host-side presentation intent — so what the reader sees is exactly
 * what the model saw, with two local touches: URLs become links, and
 * `[attachment:<id>]` markers become thumbnails fetched from the panel's own
 * attachment route. The second one is deliberate: the picture is rendered here,
 * on this machine, and never became part of the conversation.
 */
import React from 'react';
import { type InboxRpcResult } from '../shared/panel-wire.js';
/**
 * `id: <uuid>` — how the tool results name a record.
 *
 * Exported because it is the whole of the "click a record and go look at it"
 * feature on this side: the button is only as reliable as finding the id in the
 * text the model was shown.
 */
export declare const RECORD_ID: RegExp;
/** Every record id in one tool result, in the order they appear. */
export declare function recordIdsIn(text: string): string[];
/** The slice of the tool-call block a card needs. */
interface CardBlock {
    text?: unknown;
    content?: unknown;
    isError?: unknown;
}
/** Owner props this card uses; the rest of the share is not needed here. */
export interface ToolCardProps {
    toolName: string;
    block: CardBlock;
}
/**
 * The card both tools share: a titled, monospace-ish rendering of the result
 * with links and thumbnails.
 *
 * @param props - the tool call identity and its settled block.
 * @returns the card element.
 */
export declare function InboxToolCard({ toolName, block }: ToolCardProps): React.ReactElement;
/** Register both cards on the keyed tool view slot. */
export declare function registerToolCards(slots: {
    inject: (name: string, run: () => unknown) => unknown;
    register: (options: {
        name: string;
        key: string;
    }, component: unknown) => unknown;
}): void;
/** The panel answers with this envelope; kept here for the shared shape. */
export type PanelAnswer = InboxRpcResult<unknown>;
export {};
