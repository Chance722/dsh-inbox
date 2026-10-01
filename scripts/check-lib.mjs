/**
 * Is the `lib/` committed to git the same thing as a build of `src/` right now?
 *
 * Why this exists: the built plugin is tracked in git, because a GitHub-URL
 * install never builds it. pnpm builds a git dependency only when the fetched
 * manifest carries a non-empty `prepare` (or a `prepublish`/`prepack`/`publish`
 * whose own `main` is missing), and the way out of that branch is to let every
 * user allow the build — per commit, because the allowlist key names the
 * archive URL. So this package deliberately has no `prepare` and ships its
 * artifacts instead; a GitHub-URL install unpacks them and works in seconds.
 * Mechanism and measurements: docs/help/dsh-plugin-platform.md.
 *
 * Tracking generated files has exactly one failure mode, and it is silent:
 * edit `src/`, forget `pnpm build`, commit, and every install from git serves
 * the previous build. This check turns that into a red test — it builds both
 * halves into a scratch directory and compares them with what is committed,
 * path by path and byte by byte.
 *
 * Usage: node scripts/check-lib.mjs
 *   0 = identical, 1 = drift (`pnpm build` and commit lib/), 2 = the build the
 *   check depends on failed (the child's own output is printed).
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shipped = join(root, 'lib')
const scratch = mkdtempSync(join(tmpdir(), 'dsh-inbox-libcheck-'))

function say(line) {
  process.stdout.write(`${line}\n`)
}

/** Run a node script with the repo as cwd; the child keeps its own output. */
function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' })
}

/** Every file under `dir`, as sorted relative paths with forward slashes. */
function files(dir) {
  const found = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else found.push(relative(dir, path).split('\\').join('/'))
    }
  }
  walk(dir)
  return found.sort()
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** Empty when the two directories hold the same files with the same bytes. */
function differences(fresh, committed) {
  const missing = fresh.filter((name) => !committed.includes(name))
  const extra = committed.filter((name) => !fresh.includes(name))
  const changed = fresh.filter(
    (name) => committed.includes(name) && digest(join(scratch, name)) !== digest(join(shipped, name)),
  )
  return [
    ...(missing.length > 0 ? [`missing from lib/: ${missing.join(', ')}`] : []),
    ...(extra.length > 0 ? [`no longer produced: ${extra.join(', ')}`] : []),
    ...(changed.length > 0 ? [`different bytes: ${changed.join(', ')}`] : []),
  ]
}

let code = 0
try {
  const bundled = run(join(root, 'scripts', 'build.mjs'), ['--out', scratch])
  const declared = bundled.status === 0
    ? run(join(root, 'node_modules', 'typescript', 'bin', 'tsc'), [
        '-p', join(root, 'tsconfig.build.json'), '--outDir', join(scratch, 'types'),
      ])
    : undefined

  if (bundled.status !== 0 || declared?.status !== 0) {
    say(bundled.stdout ?? '')
    say(bundled.stderr ?? '')
    say(declared?.stdout ?? '')
    say(declared?.stderr ?? '')
    say('check-lib: the build this check compares against did not succeed')
    code = 2
  } else {
    const found = differences(files(scratch), files(shipped))
    if (found.length > 0) {
      say('lib/ is not what `pnpm build` produces — run it and commit lib/ with the change:')
      for (const line of found) say(`  ${line}`)
      code = 1
    } else {
      say(`lib/ matches a fresh build of src/ (${files(scratch).length} files)`)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

process.exitCode = code
