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
 *   0. with `--create-profile`, create a missing profile first (off by default:
 *      a typo in a profile name should say so, not conjure a profile)
 *   1. `dsh plugin --profile <profile> add <package>` (pnpm is idempotent)
 *   2. copy the shipped `standard` preset into `<DSH_HOME>/.agent-presets/<id>`
 *      and append this plugin's row to its composition
 *   3. point the user-level default preset at it (backing the settings file up
 *      first, because that file is the user's, not ours)
 *
 * It never edits the plugin's own composition in place: the copy is the user's
 * to edit afterwards, and re-running only adds what is missing.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** What the plugin calls itself, and the row an agent preset needs. */
const PACKAGE_NAME = '@duoyu/dsh-inbox'
const PRESET_ROW = `
# dsh-inbox: the vault's conversation tools (inbox_search / inbox_get).
- id: dsh-inbox
  name: '${PACKAGE_NAME}'
`

export interface Options {
  profile: string
  preset: string
  source: string
  defaultPreset: boolean
  /** Create the profile when it is missing, instead of refusing. */
  createProfile: boolean
}

function usage(): string {
  return `dsh-inbox init —— 把 inbox 装进一个 dsh profile，并让助手看得见它的工具

用法：
  dsh-inbox init [选项]

选项：
  --profile <名字>   dsh profile，默认 inbox（不存在则报错并告诉你怎么建）
  --create-profile   profile 不存在时用 dsh 自带的 web 模板建一个（默认不开）
  --preset <id>      agent preset 的 id，默认 inbox
  --package <来源>   插件来源，默认 ${PACKAGE_NAME}（本地开发传仓库路径）
  --no-default       不把默认 preset 指过去（只装，不改 dsh 的默认选择）
  --help             这份说明

做三件事：① 把插件装进 profile；② 复制 standard preset 到
<DSH_HOME>/.agent-presets/<id> 并追加本插件；③ 把用户级默认 preset 指向它。
重复运行是安全的：已经做过的不会重复做。`
}

export function parse(argv: readonly string[]): Options | undefined {
  const options: Options = {
    profile: 'inbox',
    preset: '',
    source: PACKAGE_NAME,
    defaultPreset: true,
    createProfile: false,
  }
  // `init` is the only command there is; accept it explicitly (that is what the
  // README shows) and also accept no argument at all.
  const rest = argv[0] === 'init' ? argv.slice(1) : argv
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    const value = (): string => {
      const next = rest[index + 1]
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`${String(flag)} 需要一个值`)
      }
      index += 1
      return next
    }
    if (flag === '--help' || flag === '-h') return undefined
    else if (flag === '--profile') options.profile = value()
    else if (flag === '--preset') options.preset = value()
    else if (flag === '--package') options.source = value()
    else if (flag === '--no-default') options.defaultPreset = false
    else if (flag === '--create-profile') options.createProfile = true
    else throw new Error(`看不懂的选项：${String(flag)}`)
  }
  /*
    The preset id does *not* follow the profile name.

    `~/.dsh/.agent-presets` is shared by every profile, so installing into a
    second profile would otherwise create a second, identically-composed preset
    ("web", say) that shadows nothing and confuses everyone. One plugin, one
    preset; the profile only decides where the panel and the host half run.
  */
  if (options.preset.length === 0) options.preset = 'inbox'
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.preset)) {
    throw new Error(`preset id 只能用小写字母、数字和连字符：${options.preset}`)
  }
  return options
}

/** `<DSH_HOME>`, the directory dsh keeps profiles, settings and storages in. */
function dshHome(): string {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured.length > 0 ? configured : join(homedir(), '.dsh')
}

/**
 * Where the shipped `standard` preset lives.
 *
 * Resolved from the *profile's* perspective, because that is where dsh keeps the
 * packages it runs: the plugin itself may be linked in from anywhere, but the
 * preset it copies has to be the one this dsh installation ships.
 */
function shippedStandard(profileDir: string): string | undefined {
  const candidates: string[] = []
  try {
    const require = createRequire(join(profileDir, 'package.json'))
    candidates.push(dirname(require.resolve('@deepseek-ai/dsh-agent-presets/package.json')))
  } catch {
    // Fall through to the layouts below: resolution fails whenever the roster is
    // nested (the dsh package vendors its own dependencies) or hoisted
    // differently than expected.
  }
  candidates.push(
    join(profileDir, 'node_modules', '@deepseek-ai', 'dsh-agent-presets'),
    join(profileDir, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-agent-presets'),
  )
  for (const candidate of candidates) {
    const standard = join(candidate, 'presets', 'standard')
    if (existsSync(join(standard, 'agent.cordis.yml'))) return standard
  }
  return undefined
}

/**
 * Point the user-level default preset at this one.
 *
 * A line-based merge, not a YAML library: the settings file is the user's, it is
 * flat (one namespace per top-level key), and the alternative is dragging a YAML
 * parser into a CLI that runs once. A backup is written first — this file holds
 * settings for everything else the user has installed.
 */
function setDefaultPreset(settingsPath: string, id: string): string {
  const original = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : ''
  /** Write, but only if this actually changes something — and back up first. */
  const commit = (next: string, note: string): string => {
    if (next === original) return '默认 preset 已经是它，没改'
    if (original.length > 0) writeFileSync(`${settingsPath}.bak-${String(Date.now())}`, original, 'utf8')
    writeFileSync(settingsPath, next, 'utf8')
    return note
  }

  const lines = original.split(/\r?\n/)
  const head = lines.findIndex((line) => /^agent-presets:\s*$/.test(line))
  if (head === -1) {
    const block = `agent-presets:\n  default: ${id}\n`
    const body = original.length === 0 ? block : `${original.replace(/\s*$/, '')}\n${block}`
    mkdirSync(dirname(settingsPath), { recursive: true })
    return commit(body, original.length === 0 ? '新建了 settings.yaml' : `追加了 agent-presets.default: ${id}`)
  }
  // Inside the namespace: replace a `default:` line if there is one, else insert
  // one right after the header (the other keys stay exactly where they were).
  let end = lines.length
  for (let index = head + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.length > 0 && !/^\s/.test(line)) {
      end = index
      break
    }
  }
  const before = lines.slice(0, end)
  const after = lines.slice(end)
  const defaultAt = before.findIndex((line, index) => index > head && /^\s+default:/.test(line))
  if (defaultAt !== -1) before[defaultAt] = `  default: ${id}`
  else before.push(`  default: ${id}`)
  return commit([...before, ...after].join('\n'), `把 agent-presets.default 改成 ${id}`)
}

function main(argv: readonly string[]): number {
  let options: Options
  try {
    const parsed = parse(argv)
    if (parsed === undefined) {
      process.stdout.write(`${usage()}\n`)
      return 0
    }
    options = parsed
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n`)
    process.stderr.write(`${usage()}\n`)
    return 2
  }

  const home = dshHome()
  const profileDir = join(home, 'profiles', options.profile)
  if (!existsSync(join(profileDir, 'package.json'))) {
    /*
      A missing profile is the one thing that turns "one command" into two, and
      it is the normal state on a fresh machine. Creating it is dsh's own
      command, not a directory we invent, and it is behind a flag on purpose: a
      typo like `--profile web2` should be answered with "no such profile", not
      with a new profile nobody asked for.
    */
    const hint =
      `先建一个：dsh --profile ${options.profile} --from-default-profile web --dump-config\n` +
      `（或者重跑时加上 --create-profile，让这一步自己发生）\n`
    if (!options.createProfile) {
      process.stderr.write(`找不到 profile 「${options.profile}」（${profileDir}）。\n${hint}`)
      return 1
    }
    process.stdout.write(`⓪ profile 「${options.profile}」不存在，用 dsh 的 web 模板建一个…\n`)
    /*
      Capture rather than inherit: `dsh --dump-config` prints the whole composed
      tree, which buries the three lines that matter. It is only interesting
      when the profile could not be created, so that is when it gets printed.
    */
    const created = spawnSync(
      'dsh',
      ['--profile', options.profile, '--from-default-profile', 'web', '--dump-config'],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    )
    if (created.error !== undefined || created.status !== 0 || !existsSync(join(profileDir, 'package.json'))) {
      for (const stream of [created.stdout, created.stderr]) {
        if (typeof stream === 'string' && stream.trim().length > 0) process.stderr.write(`${stream.trimEnd()}\n`)
      }
      process.stderr.write(
        `建 profile 失败${created.error === undefined ? '' : `（${created.error.message}）`}。\n${hint}`,
      )
      return 1
    }
    process.stdout.write(`   建好了 ${profileDir}\n`)
  }

  process.stdout.write(`① 把 ${options.source} 装进 profile ${options.profile}…\n`)
  const added = spawnSync('dsh', ['plugin', '--profile', options.profile, 'add', options.source], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (added.error !== undefined || added.status !== 0) {
    process.stderr.write(
      `装插件失败${added.error === undefined ? '' : `（${added.error.message}）`}。\n` +
        `可以在你的终端里手动跑：dsh plugin --profile ${options.profile} add ${options.source}\n`,
    )
    return 1
  }

  const standard = shippedStandard(profileDir)
  if (standard === undefined) {
    process.stderr.write('找不到随 dsh 附带的 standard preset，无法创建 agent preset。\n')
    return 1
  }
  const presetDir = join(home, '.agent-presets', options.preset)
  if (existsSync(join(presetDir, 'agent.cordis.yml'))) {
    process.stdout.write(`② preset 「${options.preset}」已存在，只补上缺失的插件行\n`)
  } else {
    process.stdout.write(`② 从 standard 复制一份 preset 到 ${presetDir}\n`)
    mkdirSync(dirname(presetDir), { recursive: true })
    cpSync(standard, presetDir, { recursive: true })
    const manifest = join(presetDir, 'preset.yml')
    if (existsSync(manifest)) {
      const text = readFileSync(manifest, 'utf8')
      writeFileSync(
        manifest,
        text
          .replace(/^name:.*$/m, 'name: 收件箱（带 dsh-inbox）')
          .replace(
            /^description:.*$/m,
            'description: 标准模式 + dsh-inbox：助手可以直接查你的收件箱（叫它仓库 / inbox 也行）并把内容取回来。',
          ),
        'utf8',
      )
    }
  }
  const composition = join(presetDir, 'agent.cordis.yml')
  const body = readFileSync(composition, 'utf8')
  if (!body.includes(PACKAGE_NAME)) {
    writeFileSync(composition, `${body.replace(/\s*$/, '')}\n${PRESET_ROW}`, 'utf8')
    process.stdout.write(`   已把 ${PACKAGE_NAME} 追加进 preset 的组合\n`)
  } else {
    process.stdout.write('   preset 里已经有这个插件，跳过\n')
  }

  if (options.defaultPreset) {
    const changed = setDefaultPreset(join(home, 'settings.yaml'), options.preset)
    process.stdout.write(`③ 默认 preset：${changed}\n`)
  }

  process.stdout.write(
    `\n完成。接下来：\n` +
      `  · 重启 dsh（preset 在启动时扫描）\n` +
      `  · 新建一个会话，它就会带上收件箱工具；想让助手查仓库，直接问「我的收件箱里有哪些还没看的链接」\n` +
      `  · 面板（侧栏 Inbox）不需要 preset，装完就在\n`,
  )
  return 0
}

/*
  Run only when invoked as a program.

  Without this guard, importing the module to test `parse` would also run the
  installer — a test that edits `~/.dsh` is worse than no test at all.
*/
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
