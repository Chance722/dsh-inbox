/**
 * 在"本仓库"和"线上发布的包"之间切换一个 dsh profile 的插件来源。
 *
 * 为什么需要它：probe 装线上版体验、临时改代码又要立刻生效，这两件事的切换动作是
 * 一样的（`dsh plugin add` 换个参数），但有几个容易记错的细节：
 *
 *   · 链本地之前**必须先 build**——profile 是 junction 指回仓库，读的是 `lib/`，
 *     忘了构建就还在跑上一次的产物（这是最常踩的）；
 *   · profile 里的依赖长什么样能直接说明现在用的是哪一种（`link:` = 本仓库）；
 *   · 宿主半边在进程启动时装载，切完必须重启 dsh，客户端半边会热更新。
 *
 * 用法（在仓库根目录）：
 *   pnpm dev:status   看当前指向（默认 profile：web）
 *   pnpm dev:local    切到本仓库（会先 pnpm build）
 *   pnpm dev:npm      切回线上发布的版本
 *
 * 环境变量 `DSH_PROFILE` 可以换 profile（默认 `web`）。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, rmdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 公开包名：profile 里那一行依赖、以及 `dsh plugin add` 的参数都用它。 */
const PACKAGE = '@chance722/dsh-inbox'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = (process.argv[2] ?? 'status').toLowerCase()
const profile = process.env.DSH_PROFILE ?? 'web'
const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const profileDir = join(home, 'profiles', profile)

function latestVersion() {
  const result = spawnSync('npm', ['view', PACKAGE, 'version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const value = (result.stdout ?? '').trim()
  return /^\d+\.\d+\.\d+/.test(value) ? value : undefined
}

const latest = latestVersion()

/** 这个 profile 现在把插件指向哪里：`link:…` 是本仓库，版本号是线上包。 */
function dependency() {
  const manifest = join(profileDir, 'package.json')
  if (!existsSync(manifest)) return undefined
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).dependencies?.[PACKAGE]
  } catch {
    return undefined
  }
}

/** 跑一条命令，失败时把状态码交回给调用者（而不是抛栈）。 */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status === 0 && result.error === undefined
}

/**
 * 摘掉 `node_modules` 里指向本仓库的那个链接（只删链接，不动仓库）。
 *
 * 为什么必须做：profile 用的是 pnpm 的 **hoisted** 链接器，而"把 link 换成
 * registry 包"这件事 pnpm 做不干净——它会去**仓库的** `.pnpm` 里建符号链接，
 * 在 Windows 上直接 `EPERM`（实测 2026-09-21：连 `pnpm remove` 之后再 `add`
 * 都会撞上）。先把这个链接摘掉，`add` 才是从零装一个 registry 包。
 */
function dropLink() {
  const entry = join(profileDir, 'node_modules', ...PACKAGE.split('/'))
  try {
    if (lstatSync(entry).isSymbolicLink()) rmdirSync(entry)
  } catch {
    // 不存在、或不是链接：那正是我们想看到的状态，不用管。
  }
}

/**
 * `node_modules` 里**实际装的是哪一版**。
 *
 * 依赖行只写得出范围（`^0.2.4`），而"上次解析到的是 0.2.4"和"现在最新是 0.2.5"
 * 是两件事——2026-09-21 用户看 `dev:status` 报 `^0.2.4` 就以为装的是 0.2.5。
 * 链接本仓库时读的就是仓库自己的 package.json，所以两种状态都有版本可看。
 */
function installed() {
  try {
    const manifest = join(profileDir, 'node_modules', ...PACKAGE.split('/'), 'package.json')
    return JSON.parse(readFileSync(manifest, 'utf8')).version
  } catch {
    return undefined
  }
}

function describe() {
  const value = dependency()
  if (value === undefined) return `profile「${profile}」里没有装 ${PACKAGE}`
  if (value.startsWith('link:')) return `本仓库（${value.slice('link:'.length)}）`
  return `线上包（${value}）`
}

/** `describe()` 加上实际装到的版本。 */
function describeWithVersion() {
  const version = installed()
  return `${describe()}${version === undefined ? '' : `，装的是 v${version}`}`
}

if (mode === 'status') {
  process.stdout.write(`profile「${profile}」：${describeWithVersion()}\n`)
  process.exitCode = existsSync(join(profileDir, 'package.json')) ? 0 : 1
} else if (mode === 'local' || mode === 'npm') {
  if (!existsSync(join(profileDir, 'package.json'))) {
    process.stderr.write(
      `找不到 profile「${profile}」（${profileDir}）。\n` +
        `建一个：dsh --profile ${profile} --from-default-profile web --dump-config\n`,
    )
    process.exitCode = 1
  } else if (mode === 'local' && !run('pnpm', ['build'])) {
    // 本地这一侧没构建就等于没切换：profile 读的是 lib/。
    process.stderr.write('构建失败，先修好再切（profile 仍指向原来的来源）。\n')
    process.exitCode = 1
  } else {
    /*
      registry 那一侧要先"清干净再装"：
        remove（顺手把 bundles 里那行摘掉）→ 摘链接 → add `<包名>@latest`
      `@latest` 是必须的：只写包名时 pnpm 会把现有的 link 当成该名字的解析结果，
      回一句 "Already up to date" 然后什么都不做（实测）。
    */
    if (mode === 'npm' && !dropThenAdd()) {
      process.exitCode = 1
    } else if (mode === 'local' && !run('dsh', ['plugin', '--profile', profile, 'add', root])) {
      process.stderr.write(`切换失败。手动跑：dsh plugin --profile ${profile} add ${root}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write(
        `\nprofile「${profile}」现在用：${describeWithVersion()}\n` +
          `下一步：重启 dsh（宿主半边在启动时装载；只改 src/client 时页面会自己热更新）\n`,
      )
    }
  }
} else {
  process.stderr.write(`看不懂的模式「${mode}」：用 status / local / npm。\n`)
  process.exitCode = 2
}

/** registry 那一侧的完整切换：remove → 摘链接 → add latest。 */
function dropThenAdd() {
  // remove 失败不算错：本来就可能是"还没装过"的状态。
  run('dsh', ['plugin', '--profile', profile, 'remove', PACKAGE])
  dropLink()
  if (run('dsh', ['plugin', '--profile', profile, 'add', `${PACKAGE}@${latest ?? 'latest'}`])) return true
  process.stderr.write(
    `切换失败。手动跑：dsh plugin --profile ${profile} add ${PACKAGE}@${latest ?? 'latest'}\n`,
  )
  return false
}

/**
 * registry 上真正的 `latest`。
 *
 * 为什么不直接把 `@latest` 交给 pnpm：pnpm 的供应链策略里有"刚发布的版本先别装"
 * （minimumReleaseAge），而它遇到这种版本会**静默降级**成上一个允许的版本——
 * 实测 2026-09-21：0.2.5 已经发布，`add <包名>@latest` 却装回了 0.2.4，一句提示都没有。
 * 拿确切版本号去装，pnpm 会把该版本记进 `minimumReleaseAgeExclude`（profile 的
 * `pnpm-workspace.yaml`）然后照装。取不到就退回 `latest`，让 pnpm 自己决定。
 */
