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
import { existsSync, readFileSync } from 'node:fs'
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

function describe() {
  const value = dependency()
  if (value === undefined) return `profile「${profile}」里没有装 ${PACKAGE}`
  if (value.startsWith('link:')) return `本仓库（${value.slice('link:'.length)}）`
  return `线上包（${value}）`
}

if (mode === 'status') {
  process.stdout.write(`profile「${profile}」：${describe()}\n`)
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
    const source = mode === 'local' ? root : PACKAGE
    if (!run('dsh', ['plugin', '--profile', profile, 'add', source])) {
      process.stderr.write(`切换失败。手动跑：dsh plugin --profile ${profile} add ${source}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write(
        `\nprofile「${profile}」现在用：${describe()}\n` +
          `下一步：重启 dsh（宿主半边在启动时装载；只改 src/client 时页面会自己热更新）\n`,
      )
    }
  }
} else {
  process.stderr.write(`看不懂的模式「${mode}」：用 status / local / npm。\n`)
  process.exitCode = 2
}
