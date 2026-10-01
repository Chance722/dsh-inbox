#!/usr/bin/env node
/**
 * `dsh-inbox init` — the install that is not a paragraph of instructions.
 *
 * Installing this plugin by hand is three steps in three places, and the third
 * is the one everybody forgets: the panel works as soon as the plugin is in the
 * profile, but the *assistant* only sees `inbox_search` / `inbox_get` once the
 * plugin is also in the session's **agent preset**. A README that says "now copy
 * the standard preset into ~/.dsh/.agent-presets and append two lines" is a
 * README that half its readers will skim past — so this does it.
 *
 * What it does, in order, and it is safe to run twice:
 *   0. decide which profile to install into — `--profile` when it was named,
 *      otherwise the one this machine already starts (`web`, or the only one);
 *      with `--create-profile`, create a missing profile first (off by default:
 *      a typo in a profile name should say so, not conjure a profile)
 *   1. `dsh plugin --profile <profile> add <package>` (pnpm is idempotent)
 *   2. copy the shipped `standard` preset into `<DSH_HOME>/.agent-presets/<id>`
 *      and append this plugin's row to its composition
 *   3. point the user-level default preset at it (backing the settings file up
 *      first, because that file is the user's, not ours)
 *
 * Steps ② and ③ belong to the preset carrier dsh 0.1.x reads. From 0.2.0 the
 * carrier is a declaration row inside a bundle patch and nothing reads the
 * directory any more, so `init` skips both there and says why — the tools reach
 * the model from the profile row alone (measured on 0.2.0-rc.2, see
 * `presetMechanism` below and `docs/help/dsh-plugin-platform.md`).
 *
 * The copy is the user's to edit afterwards: re-running adds the row when it is
 * missing, and otherwise leaves the file alone — the one exception being that
 * row's package name, which is ours to keep pointing at the real package (see
 * `PRESET_ROW_PATTERN`).
 */
/** What one pass over a preset composition had to do to our row. */
export interface PresetRowOutcome {
    /** The text to write back; identical to the input when nothing changed. */
    body: string;
    change: 'added' | 'unchanged' | 'renamed';
    /** The package the row used to point at, when it was renamed. */
    from?: string;
}
/**
 * Make sure the composition carries our row — once, pointing at the real package.
 *
 * @param body - the preset's `agent.cordis.yml` text.
 * @returns the text to write, and what had to happen.
 */
export declare function ensurePresetRow(body: string): PresetRowOutcome;
export interface Options {
    /** Profile named with `--profile`; undefined asks the installer to pick one. */
    profile: string | undefined;
    preset: string;
    source: string;
    defaultPreset: boolean;
    /** Create the profile when it is missing, instead of refusing. */
    createProfile: boolean;
    /** Install pnpm when it is missing, instead of stopping to explain it. */
    installPnpm: boolean;
}
export declare function parse(argv: readonly string[]): Options | undefined;
/**
 * The profiles this machine has, in a stable order.
 *
 * A directory counts as a profile when it carries the `package.json` dsh writes
 * there; `profiles/node_modules` is a package store, not a profile. A missing
 * `profiles` directory is the fresh-machine case, not an error.
 *
 * @param home - `<DSH_HOME>`.
 * @returns profile names, sorted.
 */
export declare function listProfiles(home: string): string[];
/** What to do about the profile, and how to describe the choice. */
export type ProfileChoice = {
    kind: 'use';
    profile: string;
    label: string;
} | {
    kind: 'refuse';
    message: string;
};
/**
 * Pick the profile to install into when the user did not name one.
 *
 * `dsh web` is `dsh --profile web`, so the profile people already start is the
 * one the plugin belongs in — naming it by hand was a step the README had to
 * teach, and the reason a fresh machine needed a second command at all. Guessing
 * stops at the first ambiguity: several profiles and no `web` means asking, not
 * serving someone the wrong one.
 *
 * @param options - `--profile` (if given) and `--create-profile`.
 * @param existing - what {@link listProfiles} found.
 * @returns the profile to use, or the refusal to print.
 */
export declare function chooseProfile(options: Pick<Options, 'profile' | 'createProfile'>, existing: readonly string[]): ProfileChoice;
/**
 * Whether this module is the program being run.
 *
 * `import.meta.url` carries the **real** path — Node resolves symlinks — while
 * `process.argv[1]` keeps the path the caller typed. Comparing the URLs
 * directly therefore fails for a copy reached through a pnpm
 * `node_modules/@chance722/dsh-inbox/...` junction or any symlink, and the
 * failure is silent: the installer does nothing, prints nothing, exits 0.
 * Resolve both sides first; an unresolvable path is not us.
 *
 * @param moduleUrl - `import.meta.url` of this module.
 * @param entry - `process.argv[1]`, or undefined when node has no script.
 * @returns true when `entry` is this very file.
 */
export declare function isEntryPoint(moduleUrl: string, entry: string | undefined): boolean;
/**
 * Which carrier the running dsh reads user presets from.
 *
 * - `directory` — 0.1.x：`$DSH_HOME/.agent-presets/<id>/`，里面是 `preset.yml`
 *   （显示名/描述/顺序）和 `agent.cordis.yml`（组合）。
 * - `declaration` — 0.2.0 起：preset 是 bundle patch 里的一行声明，交给
 *   `@deepseek-ai/dsh-agent-preset-registry`；那个目录**没有任何代码再读它**，
 *   而且 `@deepseek-ai/dsh-agent-presets` 这个包在 0.2.0 上已经不存在了
 *   （2026-09-30 实测：npm 上最高 0.1.6-alpha.2，桌面端 `app.asar` 里连字符串都搜不到）。
 * - `unknown` — 问不出来（PATH 上没有 dsh、版本号看不懂）：按老行为走。不猜——
 *   猜错的代价要么是"该做的没做且不出声"，要么是"在一个根本不读那个目录的版本上
 *   白跑一趟然后以 1 退出"，后者至少是看得见的。
 */
export type PresetMechanism = 'directory' | 'declaration' | 'unknown';
/**
 * Read a dsh version as "which preset carrier is this".
 *
 * 只有 major.minor 参与判断：rc 号、alpha 号和构建元数据都不改变载体。
 *
 * @param version - `dsh --version` 的输出，或 undefined（没问出来）。
 * @returns the carrier to assume.
 */
export declare function presetMechanism(version: string | undefined): PresetMechanism;
/**
 * The commands that can create a missing profile, in the order to try them.
 *
 * A *shipped* template cannot be the target of `--from-default-profile`: dsh
 * refuses with `profile "web" is shipped and cannot be a custom profile target;
 * omit --from-default-profile to use it`. `init --profile web --create-profile`
 * on a machine that has never run dsh is exactly that case — and since choosing
 * `web` is what this installer now does by default, that would have been the
 * *first* thing a new user hit (measured 2026-09-20, on a fresh `%DSH_HOME%`,
 * before 0.2.0 shipped). The bare form is also the one that initializes a
 * shipped profile at all, so it is the fallback rather than the first choice.
 *
 * Both forms are tried instead of special-casing `web`: `headless` is shipped
 * too, and a future template should not need this file to change.
 *
 * @param profile - the profile to create.
 * @returns argv lists for `dsh`, most specific first.
 */
export declare function profileCreationAttempts(profile: string): readonly (readonly string[])[];
/**
 * The commands that can put pnpm on PATH, in the order to try them.
 *
 * `npm i -g pnpm` first because whoever ran `npx` has npm by definition and
 * knows where its global shims land. `corepack enable pnpm` is the fallback:
 * no download, but it needs a Node that still ships corepack (Node ≥ 25 does
 * not), so it cannot be the first choice.
 *
 * @returns argv lists, most likely to work first.
 */
export declare function pnpmInstallAttempts(): readonly (readonly string[])[];
/**
 * What to say when there is no pnpm to hand.
 *
 * Exported because the wording is the whole value here: the point is that the
 * reader can act on it without knowing which part of the chain wanted pnpm.
 *
 * @param profile - the profile that was about to receive the plugin.
 * @param source - the package (or path) that was about to be installed.
 * @returns the message, ending in the command to run by hand.
 */
export declare function missingPnpmMessage(profile: string, source: string): string;
