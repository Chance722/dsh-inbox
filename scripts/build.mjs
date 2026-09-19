// Build both halves of the plugin.
//
// Host half  → lib/index.js     plain ESM, @deepseek-ai/* left to the profile.
// Browser half → lib/client.js  CJS factory wrapped in the loader call the dsh
//                               browser kernel expects:
//
//   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
//
// Official dsh client packages ship that wrapper from tsdown, whose
// configuration is not part of the published tarball; esbuild plus this wrapper
// reproduces the same shape (see docs/help/dsh-plugin-platform.md).

import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))

/** Everything the browser kernel or the profile supplies at runtime. */
const PLATFORM_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*']

/**
 * Host-side externals: the profile supplies the `@deepseek-ai/*` packages, and
 * zod stays a real dependency of this package (bundling a second copy into the
 * host half would waste ~100 KB and risk two zod instances disagreeing).
 */
const HOST_EXTERNALS = ['@deepseek-ai/*', 'node:*', 'zod']

await mkdir(resolve(root, 'lib'), { recursive: true })

// ── host half ───────────────────────────────────────────────────────────────
await build({
  entryPoints: [resolve(root, 'src/host/index.ts')],
  outfile: resolve(root, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: HOST_EXTERNALS,
  logLevel: 'warning',
})

// ── browser half ────────────────────────────────────────────────────────────
const client = await build({
  entryPoints: [resolve(root, 'src/client/index.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: PLATFORM_EXTERNALS,
  write: false,
  logLevel: 'warning',
})

const bundle = client.outputFiles[0].text
const wrapped = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  bundle.replace(/^/gm, '\t\t').trimEnd(),
  '\t\treturn module.exports;',
  '\t},',
  '});',
  '',
].join('\n')

await writeFile(resolve(root, 'lib/client.js'), wrapped, 'utf8')

console.log(`built lib/index.js and lib/client.js for ${pkg.name}`)
