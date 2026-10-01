/**
 * The vault's domain declaration: identity, version, layout, and the zod
 * schemas every stored record must satisfy.
 *
 * Layout is `per-record` — one document per item — for two reasons that matter
 * to a personal vault: a write only rewrites the item it touched, and a single
 * damaged document cannot take the whole vault down with it.
 *
 * The default invalid-record behaviour is kept (the whole `open` rejects),
 * because these records are authoritative user data: silently skipping one
 * would hide a real problem. Additive schema changes should extend
 * `compatibleVersions` instead of loosening this.
 */
import { z } from 'zod';
export declare const itemSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        link: "link";
        text: "text";
        image: "image";
        file: "file";
    }>;
    category: z.ZodEnum<{
        image: "image";
        idea: "idea";
        article: "article";
        media: "media";
        document: "document";
        secret: "secret";
        other: "other";
    }>;
    categorySource: z.ZodOptional<z.ZodEnum<{
        rule: "rule";
        model: "model";
        user: "user";
    }>>;
    watchLater: z.ZodOptional<z.ZodBoolean>;
    source: z.ZodEnum<{
        panel: "panel";
        chat: "chat";
        webdav: "webdav";
        import: "import";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    linkTitle: z.ZodOptional<z.ZodString>;
    linkTitleError: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    secret: z.ZodOptional<z.ZodString>;
    secretDigest: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    deletedAt: z.ZodOptional<z.ZodString>;
    tags: z.ZodArray<z.ZodString>;
    attachmentIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const attachmentSchema: z.ZodObject<{
    id: z.ZodString;
    storeId: z.ZodString;
    mime: z.ZodString;
    bytes: z.ZodNumber;
    createdAt: z.ZodString;
    filename: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    sha256: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * One grave: the id the user emptied out of the recycle bin, and when.
 *
 * Emptying the bin is not "deleted" — it is *gone*, and a copy of the record
 * living somewhere else (another `sync/` tree in the same bucket, a device that
 * has not pulled the tombstone yet) must not be able to file it back in.
 * `updatedAt` cannot express that on its own: the merge compares the incoming
 * copy against the local one, and after a purge there is no local row at all,
 * so any copy won. That is measured, not theoretical — thirteen tombstones came
 * back into the bin on every restart (2026-09-21).
 *
 * It carries an id and a time and nothing else: no text, no note, no
 * attachment. What the row buys is the one comparison the merge needs — a copy
 * **at or before** this moment is dead, a copy strictly newer still wins, the
 * same way it does for a record that was never deleted.
 *
 * Nothing ever collects these, and that is deliberate rather than an oversight:
 * a grave that has been pruned is a hole reopened — the copy it was holding out
 * is exactly as old as it was, and the next pull takes it. One row per emptied
 * record, six fields of JSON, for as long as the vault lives.
 */
export declare const graveSchema: z.ZodObject<{
    id: z.ZodString;
    purgedAt: z.ZodString;
}, z.core.$strip>;
/**
 * How to recognise a master password, and nothing more.
 *
 * The salt and work factors are not secret — a KDF's parameters are the part a
 * password is stretched *with*, and knowing them is not the same as knowing the
 * password. The `verifier` is a sealed constant, so a wrong password fails the
 * same way a tampered envelope does. The password itself is never written
 * anywhere, and neither is the derived key — that lives in memory for as long as
 * the process does.
 *
 * These three fields are the only part of a vault that has to be *shared* for a
 * second machine to open a credential it pulled: without the salt, the same
 * password derives a different key. They travel with sync (`sync/master.json`,
 * see `../remote/push.ts` and `../remote/merge.ts`), never the password.
 */
export declare const masterSchema: z.ZodObject<{
    version: z.ZodNumber;
    salt: z.ZodString;
    kdf: z.ZodObject<{
        n: z.ZodNumber;
        r: z.ZodNumber;
        p: z.ZodNumber;
    }, z.core.$strip>;
    verifier: z.ZodString;
}, z.core.$strip>;
export type MasterParams = z.infer<typeof masterSchema>;
/**
 * One global slot per domain. Sync state lives here because it belongs to the
 * vault as a whole, not to any item; M6 fills it in.
 */
export declare const vaultGlobalSchema: z.ZodObject<{
    sync: z.ZodObject<{
        lastPullAt: z.ZodOptional<z.ZodString>;
        lastPushAt: z.ZodOptional<z.ZodString>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    master: z.ZodOptional<z.ZodObject<{
        version: z.ZodNumber;
        salt: z.ZodString;
        kdf: z.ZodObject<{
            n: z.ZodNumber;
            r: z.ZodNumber;
            p: z.ZodNumber;
        }, z.core.$strip>;
        verifier: z.ZodString;
    }, z.core.$strip>>;
    model: z.ZodOptional<z.ZodObject<{
        day: z.ZodString;
        calls: z.ZodNumber;
        tokens: z.ZodNumber;
        last: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Item = z.infer<typeof itemSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Grave = z.infer<typeof graveSchema>;
export type VaultGlobal = z.infer<typeof vaultGlobalSchema>;
/**
 * Domain name doubles as the backend unit name: `<DSH_HOME>/storages/dsh_inbox/…`.
 * `defineDomain` enforces `/^[a-z][a-z0-9_]*$/` at module load — no hyphens.
 */
export declare const vaultSpec: {
    name: string;
    /**
     * Version 2 added the optional `categorySource`; version 3 swaps
     * `status` for `watchLater` and drops the `待看` tag. Both older shapes still
     * validate — the removed `status` key is simply ignored, and `watchLater` is
     * optional — and `Vault.open` rewrites them once so the flag is real.
     *
     * Version 4 adds the optional `linkTitle` (the fetched page headline). It is
     * a pure addition, so every older record still validates unchanged.
     * Version 4 adds the optional `linkTitle` (the fetched page headline), version
     * 5 the optional `linkTitleError` that explains a miss. Both are pure
     * additions, so every older record still validates unchanged.
     *
     * Version 6 adds the optional `secret` / `secretDigest`: a credential's text
     * moves out of `text` and into a sealed envelope. Also a pure addition — a
     * version-5 record with plaintext simply gets migrated on the next unlock.
     *
     * Version 7 adds `sync.lastPushAt`: the cursor that keeps a push to "what
     * changed since last time" instead of re-uploading the vault on every pass.
     * A `global` field, so no record shape changes at all.
     *
     * Version 8 adds the `graves` table: one row per record the user emptied out
     * of the bin. A purge leaves no local row, so the merge had nothing to
     * outrank the cloud's copy with — with 「同时合并别的同步目录」 on, the older
     * tree in the same bucket filed all thirteen of them back into the bin on
     * every restart (measured 2026-09-21). A new table, so no record shape
     * changes; an older vault simply has no graves, and there is nothing to
     * protect until the next purge.
     *
     * Still version 8 after the master password's *parameters* started travelling
     * with sync (2026-10-01): that is one more object in the vault's sync tree
     * (`sync/master.json`), not a change to any stored shape — an older build
     * ignores a name it does not know, and a newer build over a version-8 vault
     * finds `global.master` exactly where it always was.
     */
    version: number;
    compatibleVersions: number[];
    layout: "per-record";
    global: {
        schema: z.ZodObject<{
            sync: z.ZodObject<{
                lastPullAt: z.ZodOptional<z.ZodString>;
                lastPushAt: z.ZodOptional<z.ZodString>;
                cursor: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            master: z.ZodOptional<z.ZodObject<{
                version: z.ZodNumber;
                salt: z.ZodString;
                kdf: z.ZodObject<{
                    n: z.ZodNumber;
                    r: z.ZodNumber;
                    p: z.ZodNumber;
                }, z.core.$strip>;
                verifier: z.ZodString;
            }, z.core.$strip>>;
            model: z.ZodOptional<z.ZodObject<{
                day: z.ZodString;
                calls: z.ZodNumber;
                tokens: z.ZodNumber;
                last: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        initial: {
            sync: {};
        };
    };
    tables: {
        items: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, {
            id: string;
            kind: "link" | "text" | "image" | "file";
            category: "image" | "idea" | "article" | "media" | "document" | "secret" | "other";
            source: "panel" | "chat" | "webdav" | "import";
            createdAt: string;
            updatedAt: string;
            tags: string[];
            attachmentIds: string[];
            categorySource?: "rule" | "model" | "user" | undefined;
            watchLater?: boolean | undefined;
            title?: string | undefined;
            linkTitle?: string | undefined;
            linkTitleError?: string | undefined;
            text?: string | undefined;
            secret?: string | undefined;
            secretDigest?: string | undefined;
            url?: string | undefined;
            platform?: string | undefined;
            note?: string | undefined;
            deletedAt?: string | undefined;
        }>;
        attachments: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, {
            id: string;
            storeId: string;
            mime: string;
            bytes: number;
            createdAt: string;
            filename?: string | undefined;
            width?: number | undefined;
            height?: number | undefined;
            sha256?: string | undefined;
        }>;
        graves: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, {
            id: string;
            purgedAt: string;
        }>;
    };
};
export type VaultSpec = typeof vaultSpec;
