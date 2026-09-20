/**
 * Build-time substitutions.
 *
 * `scripts/build.mjs` passes these to esbuild as `define`, so the value comes
 * from `package.json` rather than from a second copy of the number in the
 * source. Declared here because a plain `tsc` run has no bundler to fill them
 * in — which is also why the readers guard with `typeof`.
 */

/** The package's `version`, e.g. `0.1.0`. */
declare const __DSH_INBOX_VERSION__: string
