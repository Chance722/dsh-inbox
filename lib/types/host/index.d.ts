import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Stable Cordis plugin name for the host half. */
export declare const name = "dsh-inbox";
/** Tool registry, command surface, and the storage domain form we persist through. */
export declare const inject: string[];
/**
 * What a profile may configure on our row.
 *
 * Both halves of this are settings the user changes *in the panel* — the list
 * density it opens with, and where the sync endpoint lives — so this schema is
 * not decoration: on dsh 0.2.x it is the only thing that makes those fields
 * writable at all. That service keeps no namespaces, so a setting's address is
 * the profile row of the plugin (`dsh-inbox`, see `cordis.patch.yml`), and it
 * refuses to write a field the plugin's own `Config` has not marked live
 * (`volatile()`), which `markLive` does and 0.1.x's schemastery simply ignores.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    protocol: z<"webdav" | "s3", "webdav" | "s3", "defined">;
    baseUrl: z<string, string, "defined">;
    directory: z<string, string, "defined">;
    adoptForeignRoots: z<boolean, boolean, "defined">;
    username: z<string, string, "defined">;
    endpoint: z<string, string, "defined">;
    bucket: z<string, string, "defined">;
    region: z<string, string, "defined">;
    signatureVersion: z<string, string, "defined">;
    accessKeyId: z<string, string, "defined">;
    userAgent: z<string, string, "defined">;
    webdavUserAgent: z<string, string, "defined">;
    listMode: z<"grid" | "compact", "grid" | "compact", "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    protocol: z<"webdav" | "s3", "webdav" | "s3", "defined">;
    baseUrl: z<string, string, "defined">;
    directory: z<string, string, "defined">;
    adoptForeignRoots: z<boolean, boolean, "defined">;
    username: z<string, string, "defined">;
    endpoint: z<string, string, "defined">;
    bucket: z<string, string, "defined">;
    region: z<string, string, "defined">;
    signatureVersion: z<string, string, "defined">;
    accessKeyId: z<string, string, "defined">;
    userAgent: z<string, string, "defined">;
    webdavUserAgent: z<string, string, "defined">;
    listMode: z<"grid" | "compact", "grid" | "compact", "defined">;
}>>, "plain">;
/**
 * Claim the vault and publish the tools.
 *
 * Loading is asynchronous while `apply` is not, so the handle arrives later:
 * every caller reads whatever is open at call time, and reports the failure
 * instead of pretending the vault is empty when it is not.
 *
 * The claim goes through `./vault/lease.js` because dsh loads this plugin twice
 * in one process (profile bundle + agent preset) while the storage domain
 * allows a single open per name — the second instance used to fail with
 * `domain 'dsh_inbox' is already open` and every tool it published answered
 * 「仓库没有打开」. The first instance owns the vault; the rest borrow it.
 *
 * @param ctx - host plugin context carrying the tool registry and storage.
 */
export declare function apply(ctx: Context): void;
