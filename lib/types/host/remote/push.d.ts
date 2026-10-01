/**
 * Sending the vault to the remote.
 *
 * The rules this implements are the ones the user decided on 2026-09-20:
 * **only credential bodies travel encrypted** (they are ciphertext on disk
 * already), everything else goes up as it is; a conflict is settled by writing
 * what is newer; and the layout is `sync/items/<id>.json` plus
 * `sync/attachments/<id>` under the configured directory — one file per object,
 * so "increment" is "whatever got touched since last time".
 *
 * Deliberately *not* here yet: deleting remote objects for records the user
 * emptied out of the bin, and merging what other devices pushed. Those are the
 * next two steps; this one only ever adds and overwrites.
 */
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { Context } from '@deepseek-ai/cordis';
import type { PushResult } from '../../shared/panel-wire.js';
import type { Attachment, Item } from '../vault/spec.js';
import type { Vault } from '../vault/vault.js';
/** What one write to the remote looks like, whichever protocol is configured. */
type Writer = (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
/**
 * The suffix one attachment should carry.
 *
 * The file's *own* name wins when it has one: a `报税表.xlsx` knows what it is
 * far better than any table here does, and guessing from the media type would
 * hand back `bin` for every format nobody thought to list. The table is the
 * fallback, and `bin` the last resort — a name that says "unknown" rather than a
 * name that lies.
 *
 * @param filename - the name the file arrived with, when there is one.
 * @param mime - its media type.
 * @returns the extension without the dot.
 */
export declare function extensionOf(filename: string | undefined, mime: string): string;
/**
 * The object name one attachment gets on the remote.
 *
 * `<our id>.<extension>`: the id keeps it unique and idempotent, the extension
 * keeps it *readable* — a cloud drive with a folder full of extension-less files
 * cannot preview a photo, cannot open it, and cannot tell you which one is which.
 * The user asked exactly that question ("我的图片呢？都是 json 文件？"), and a bare
 * id was the whole reason.
 *
 * @param attachmentId - our row id for the attachment.
 * @param record - the attachment row, for its own name and media type.
 * @returns the file name to PUT.
 */
export declare function attachmentObjectName(attachmentId: string, record: Pick<Attachment, 'mime' | 'filename'>): string;
/**
 * The record as a text file a person can open in the cloud drive.
 *
 * The JSON beside it is the source of truth — this is a **view**, regenerated on
 * every push and never read back. It exists because a bucket full of
 * `{"format":"dsh-inbox-item/1",…}` is a bucket you cannot *use*: you cannot read
 * the article you saved, you cannot see which photo belongs to which record, and
 * you cannot tell a note from a link without a JSON viewer.
 *
 * A credential's body is the one thing it never contains: it is ciphertext on
 * this machine and it stays ciphertext on the remote, so the text file says so
 * instead of pretending the record is empty.
 *
 * @param item - the record.
 * @param attachmentNames - the remote names of its attachments, in order.
 * @returns the file's text.
 */
export declare function renderItemText(item: Item, attachmentNames: readonly string[]): string;
/**
 * Push everything that changed since the last push.
 *
 * @param ctx - host context carrying settings and credentials.
 * @param vault - the open vault.
 * @param attachments - where attachment bytes live.
 * @returns what happened, including the reasons a caller can show.
 */
export declare function pushRemote(ctx: Context, vault: Vault, attachments: AttachmentStore | undefined, 
/** `all` ignores the cursor and sends everything again — the repair button. */
options?: {
    all?: boolean;
}): Promise<PushResult>;
/**
 * The push itself, with the transport injected.
 *
 * Split out the same way the pull is (`pullOnce` behind `pullRemote`), and for
 * the same reason: the interesting rules — what counts as "changed", what
 * happens when one write of twenty fails, that an attachment is uploaded once
 * however many records point at it — are worth testing without a server.
 *
 * @param vault - the open vault.
 * @param attachments - where attachment bytes live.
 * @param writer - one write to the remote.
 * @param basePath - the sync root inside the configured directory.
 * @param options - `all` re-sends records the cursor thinks are already up.
 * @param remover - optional: clears the pre-extension attachment name (see the
 *   call site), something only a real remote can answer.
 * @returns what happened.
 */
export declare function pushOnce(vault: Vault, attachments: AttachmentStore, writer: Writer, basePath: string, options?: {
    all?: boolean;
}, remover?: (path: string) => Promise<void>): Promise<PushResult>;
export {};
