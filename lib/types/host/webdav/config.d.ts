/**
 * Where the WebDAV settings live, and why they live there.
 *
 * URL, folder and username are *configuration*: they belong in dsh's settings
 * service, so a deployment can ship defaults and a user can change them from a
 * configuration surface. The password is a *secret*: it goes through the
 * credentials service, which keeps values out of configuration files entirely.
 *
 * Both services are optional. Without them the plugin keeps working from its own
 * composed values — a headless profile has no settings provider and must not
 * break — and the panel simply says what is missing.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { WebdavSettings, WebdavStatus } from '../../shared/panel-wire.js';
import { type SettingsSection } from '../settings.js';
import type { Vault } from '../vault/vault.js';
export type { WebdavSettings, WebdavStatus } from '../../shared/panel-wire.js';
/** Namespace this plugin owns in the 0.1.x settings service. */
export declare const SETTINGS_NAMESPACE = "dsh-inbox-webdav";
/** The credential key holding the password. */
export declare const PASSWORD_KEY = "DSH_INBOX_WEBDAV_PASSWORD";
/** The credential key holding the S3 secret access key. */
export declare const S3_SECRET_KEY = "DSH_INBOX_S3_SECRET";
/** The composed defaults, so a fresh install has a sane shape. */
export declare const DEFAULT_SETTINGS: WebdavSettings;
/**
 * The fields the sync endpoint is made of, in one place: the 0.1.x namespace
 * schema and the 0.2.x config row are both built from this map, and the row
 * needs only the names (see `../settings.js`).
 */
export declare const WEBDAV_FIELDS: {
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
};
/** The namespace's schema: every field optional, so a partial user layer is valid. */
export declare const WebdavSettingsSchema: z<Schemastery.ObjectS<NoInfer<{
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
}>>, "plain">;
/** Where the sync endpoint lives, under either settings service shape. */
export declare const WEBDAV_SECTION: SettingsSection;
/** Resolve the current settings, falling back to the composed defaults. */
export declare function readSettings(ctx: Context): WebdavSettings;
/**
 * Declare the namespace once, at plugin load.
 *
 * Registering lazily on the first save looked harmless and was not: before that
 * first save, `get()` answers undefined for an unregistered namespace, so the
 * panel loaded *defaults* instead of the stored overrides — and the next save
 * wrote those defaults back over the user's real values. Declaring up front is
 * the whole point of a settings namespace.
 *
 * @param ctx - host context.
 * @param base - composed defaults for this deployment.
 */
export declare function installWebdavSettings(ctx: Context, base?: WebdavSettings): void;
/** Read the password, or undefined when none is stored. */
export declare function readPassword(ctx: Context): Promise<string | undefined>;
/** Read the S3 secret access key, or undefined when none is stored. */
export declare function readS3Secret(ctx: Context): Promise<string | undefined>;
/** Everything the panel needs, without ever handing out the password. */
export declare function describeWebdav(ctx: Context): Promise<WebdavStatus>;
/** What a save may change. An absent password leaves the stored one alone. */
export interface WebdavPatch {
    protocol?: string;
    baseUrl?: string;
    directory?: string;
    /** Merge other sync trees in the same bucket, not just this directory's. */
    adoptForeignRoots?: boolean;
    username?: string;
    /** Empty string clears the stored password; undefined leaves it. */
    password?: string;
    endpoint?: string;
    bucket?: string;
    region?: string;
    signatureVersion?: string;
    accessKeyId?: string;
    /** Empty string clears the stored S3 secret; undefined leaves it. */
    accessKeySecret?: string;
    /**
     * The `User-Agent` to send for this patch's protocol; empty string means the
     * plugin's own identity. Lands in the protocol's own slot.
     */
    userAgent?: string;
}
/**
 * The client identity configured for whichever protocol is active.
 *
 * Two slots, one answer: the identity is bound to the credential, and each
 * protocol carries its own credential.
 *
 * @param settings - the resolved settings.
 * @returns the `User-Agent` to send, empty when the user configured nothing.
 */
export declare function activeUserAgent(settings: WebdavSettings): string;
/**
 * Accept what people actually type: a bare host is the normal case, and the
 * scheme is the part they should not have to remember. An explicit `http://`
 * survives, because a self-hosted endpoint on a LAN is a real setup.
 *
 * @param value - whatever was typed.
 * @returns the URL to store.
 */
export declare function normalizeUrl(value: string): string;
/**
 * Persist a configuration change.
 *
 * The password never lands in settings: it is written (or cleared) through the
 * credentials service, and a composition without one refuses the write instead
 * of quietly storing a secret somewhere else.
 *
 * @param ctx - host context.
 * @param vault - the open vault, used for the "settings unavailable" fallback.
 * @param base - composed defaults for the settings base layer.
 * @param patch - what to change.
 * @returns whether the write went through, and why not when it did not.
 */
export declare function saveWebdav(ctx: Context, vault: Vault | undefined, base: WebdavSettings, patch: WebdavPatch): Promise<{
    ok: boolean;
    reason?: string;
}>;
