/**
 * The `/inbox` command: file what the user just typed or attached, without
 * turning it into a model message.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Vault } from './vault/vault.js';
/**
 * Register `/inbox` against the interactive command surface.
 *
 * `recordInput: false` is load-bearing, not tidiness: by default a command's
 * raw input is written to the session log, and the vault is exactly where
 * credentials are supposed to go — the payload must live in the vault and
 * nowhere else (see the credentials rule in AGENTS.md).
 *
 * @param ctx - host context; the commands service must be mounted.
 * @param vault - reads the currently open vault, which may not be open yet.
 */
export declare function registerInboxCommand(ctx: Context, vault: () => Vault | undefined): void;
