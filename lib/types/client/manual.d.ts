/**
 * The three-minute manual.
 *
 * The panel has grown features faster than it has grown explanations — sync,
 * encryption, naming, the conversation tools — and a user who has to ask "what
 * does this button do" in chat has already lost. This is the answer that lives
 * in the product: one screen, scenarios in the order a person meets them, three
 * lines each at most.
 *
 * Deliberately not a reference manual: the help docs are that. This is the part
 * you read once.
 */
import React from 'react';
/**
 * The manual, as a dialog.
 *
 * @param props - how to close it.
 * @returns the dialog.
 */
export declare function ManualDialog({ onClose }: {
    onClose: () => void;
}): React.ReactElement;
