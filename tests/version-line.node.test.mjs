/**
 * 版本线看守：开发依赖里的宿主包必须与**当前 DSH 运行时**同一条线，且被 `engines.dsh` 覆盖。
 *
 * ## 为什么这个仓库也需要它
 *
 * 本包不是 `link:` 开发挂载，运行时只声明 `schemastery` 一个真依赖、宿主包走 peer，所以
 * **落地版本偏斜的形态与 dsh-gitea-dispatch 不同**——但代价照样有，而且更隐蔽：
 *
 *  1. `devDependencies` 里那 20 多个 `@deepseek-ai/dsh-*` 是 `tsc` 与全部 Node/Vitest
 *     用例的**类型契约来源**。它们停在 0.2.0-rc.2 而宿主是 0.2.1-rc.2 时，类型检查仍然
 *     全绿——因为它校验的是旧契约，宿主真正换了签名的那天，红不会出现在这里，而是出现
 *     在运行时的静默行为差异上。
 *  2. 本包**没有** `engines.dsh`。宿主闸门此时退回逐条校验 peer，而本包只声明了
 *     `@deepseek-ai/cordis`——`~4.0.4` 同时覆盖 4.0.5，于是**任何** dsh 版本差异都
 *     挡不住。声明面等于没有。
 *
 * 2026-10-20 那天，姊妹仓库 dsh-gitea-dispatch 正是死在这条链上：宿主升 0.2.1-rc.2，
 * profile 里的 webhook 被闸门整行 disabled → 插件条目 pending → 广播/定时器/端点全部
 * 静默失效，界面无报错。那次是故障驱动修复的；这条测试把发现时间提前到升级当下。
 *
 * ## 四条判据（彼此独立，都能单独红）
 *
 *  1. **同一条线**：所有 `@deepseek-ai/dsh-*` 开发依赖必须是同一个精确版本。预发布语义下
 *     范围是假宽松（`^0.2.0-rc.2` 实测不含 `0.2.1-rc.2`）；只改一半，`tsc` 会在同一个
 *     工程里同时看到两代契约。
 *  2. **装的就是声明的**：`node_modules` 里解析到的版本必须等于声明——抓"改了
 *     package.json 没 install"（姊妹仓库本轮真发生过：改动被外部回滚，声明与安装树不同步）。
 *  3. **`engines.dsh` 存在且覆盖该线**：闸门有它就只看它、忽略 peer，这是声明面的唯一入口。
 *  4. **能拿到宿主版本时，用宿主自己的判据复验**：直接 import `dsh-app-boot` 的
 *     `evaluatePluginCompatibility`（不在本仓库重写一份会漂移的规则），并断言开发依赖
 *     线 == 宿主版本（**整号相等**，不是 major.minor —— 那次事故恰是同一条 0.2 线内的
 *     0.2.0 → 0.2.1）。
 *
 * ## 宿主版本从哪来
 *
 * `DSH_RUNTIME_VERSION`（CI 显式注入）→ `dsh --version`（本地有 CLI，实测 56ms）→ 拿不到。
 * 拿不到时只跑自洽的第 1–3 条并打 diagnostic，**不假装通过**；CI 若没有 dsh CLI，必须
 * 注入该变量，否则第 4 条不会执行。
 *
 * @module tests/version-line
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

/** 仓库根：本文件在 `tests/` 下。 */
const root = new URL('../', import.meta.url)

const read = (p) => readFileSync(new URL(p, root), 'utf8')
const pkg = JSON.parse(read('package.json'))

/** 宿主包（`@deepseek-ai/dsh` 及其子包）。cordis / schemastery 是独立库，不在此列。 */
const isHostPkg = (name) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')

/** 开发依赖里的宿主包 → 声明的版本串。 */
const hostDevDeps = () => {
  const dev = pkg.devDependencies ?? {}
  return Object.fromEntries(Object.entries(dev).filter(([name]) => isHostPkg(name)))
}

/** 精确版本（不含 `^`/`~`/`||` 等范围语法）。 */
const isExact = (range) => /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range)

/** `major.minor` 线。 */
const line = (version) => version.split('.').slice(0, 2).join('.')

/** 当前 DSH 运行时版本。 */
const runtimeVersion = () => {
  const env = process.env.DSH_RUNTIME_VERSION?.trim()
  if (env) return { version: env, source: 'DSH_RUNTIME_VERSION' }
  const out = spawnSync('dsh', ['--version'], { encoding: 'utf8', timeout: 20_000 })
  if (out.status === 0) {
    const found = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(out.stdout ?? '')
    if (found) return { version: found[1], source: 'dsh --version' }
  }
  return undefined
}

/** 从 PATH 上的 `dsh` 定位宿主安装目录（`…/node_modules/@deepseek-ai`）。 */
const hostPackagesDir = () => {
  const which = spawnSync('sh', ['-c', 'command -v dsh'], { encoding: 'utf8', timeout: 10_000 })
  if (which.status !== 0) return undefined
  const bin = (which.stdout ?? '').trim()
  if (bin === '') return undefined
  // `.bin/dsh` 是软链：realpath 落在 `…/node_modules/@deepseek-ai/dsh/lib/bin.js`。
  const resolved = spawnSync('readlink', ['-f', bin], { encoding: 'utf8', timeout: 10_000 })
  if (resolved.status !== 0) return undefined
  const real = (resolved.stdout ?? '').trim()
  const packageDir = dirname(dirname(real)) // …/@deepseek-ai/dsh
  if (packageDir.split('/').slice(-2).join('/') !== '@deepseek-ai/dsh') return undefined
  return dirname(packageDir) // …/@deepseek-ai
}

/** 宿主自己的闸门函数（拿不到就返回 undefined，绝不伪造一份）。 */
const loadHostGate = async () => {
  const dir = hostPackagesDir()
  if (dir === undefined) return undefined
  try {
    const mod = await import(pathToFileURL(join(dir, 'dsh-app-boot', 'lib', 'index.js')).href)
    return typeof mod.evaluatePluginCompatibility === 'function' ? mod : undefined
  } catch {
    return undefined
  }
}

test('宿主包开发依赖必须是同一个精确版本（范围是假宽松）', () => {
  const dev = hostDevDeps()
  assert.ok(Object.keys(dev).length > 0, 'devDependencies 里应当有 @deepseek-ai/dsh-* 宿主包')

  const notExact = Object.entries(dev).filter(([, range]) => !isExact(range))
  assert.deepEqual(
    notExact,
    [],
    `宿主包必须钉精确版本（预发布语义下范围装不到下一代）：${JSON.stringify(notExact)}`,
  )

  const lines = new Set(Object.values(dev).map(line))
  assert.equal(
    lines.size,
    1,
    `宿主包版本线必须一致，实际出现 ${[...lines].join(' / ')} —— 只改一半会让 tsc 在同一工程里同时看到两代契约`,
  )
})

test('node_modules 里实际解析到的必须是开发依赖声明的那一条', () => {
  const dev = hostDevDeps()
  const mismatched = []
  for (const [name, range] of Object.entries(dev)) {
    const manifest = join(fileURLToPath(root), 'node_modules', name, 'package.json')
    let installed
    try {
      installed = JSON.parse(readFileSync(manifest, 'utf8')).version
    } catch {
      mismatched.push(`${name}: 未安装（声明 ${range}）`)
      continue
    }
    if (installed !== range) mismatched.push(`${name}: 声明 ${range}，实际 ${installed}`)
  }
  assert.deepEqual(
    mismatched,
    [],
    '开发依赖与安装树不同步——改完 package.json 必须重新 install，否则 tsc 与用例仍在旧契约上跑',
  )
})

test('engines.dsh 必须存在，并覆盖开发依赖那条线', () => {
  const declared = pkg.engines?.dsh
  assert.equal(typeof declared, 'string', 'engines.dsh 缺失：宿主闸门会退回逐条校验 peer，而本包只声明了 cordis——dsh 版本差异根本挡不住')
  // 0.2.2-rc.1 起 engines.dsh 按 tuple 显式分条款（Issues #45），形如
  // `>=0.2.1-rc.2 <0.2.2-0 || >=0.2.2-alpha.2 <0.2.3-0`；每条 clause 的上界带 -0 才锁得住
  // 下一 minor 的预发布。允许多条 `||` 分隔的 clause，但至少一条。
  const clause = />=0\.\d+\.\d+(?:-[0-9A-Za-z.-]+)? <0\.\d+\.\d+-0/
  const clauses = declared.split('||').map((s) => s.trim())
  assert.ok(
    clauses.length >= 1 && clauses.every((c) => clause.test(c)),
    `engines.dsh 每条 clause 形状应为 ">=<版本><-pre> <<next minor>.0-0"（上界带 -0 才锁得住预发布），实际 ${declared}`,
  )

  const dev = hostDevDeps()
  const devLine = line(Object.values(dev)[0])
  assert.ok(
    declared.includes(`>=${devLine}`),
    `engines.dsh(${declared}) 的下界必须落在开发依赖那条线 ${devLine} 上，否则"声明兼容"与"实际校验的契约"是两回事`,
  )
})

test('宿主版本可得时：开发依赖线必须等于宿主线，且通过宿主自己的闸门', async (t) => {
  const runtime = runtimeVersion()
  if (runtime === undefined) {
    t.diagnostic(
      '拿不到宿主版本（DSH_RUNTIME_VERSION 未注入且 PATH 上没有 dsh）——只做了自洽检查；' +
        'CI 应注入该变量，否则这条不会执行',
    )
    return
  }
  t.diagnostic(`宿主版本：${runtime.version}（来源：${runtime.source}）`)

  const dev = hostDevDeps()
  const declaredVersion = Object.values(dev)[0]
  assert.equal(
    declaredVersion,
    runtime.version,
    `开发依赖停在 ${declaredVersion}，而宿主是 ${runtime.version} —— 闸门按预发布语义照样放行（同一条 ${line(runtime.version)} 线），` +
      '但 tsc 与全部用例校验的是旧一代契约，宿主真正换签名时这里不会红。宿主一换代，这行必须跟着改并重新 install。',
  )

  const gate = await loadHostGate()
  if (gate === undefined) {
    t.diagnostic('找不到宿主 dsh-app-boot（不是 PATH 上的 dsh 安装）——跳过权威闸门复验')
    return
  }
  const issue = gate.evaluatePluginCompatibility(pkg, {}, runtime.version)
  assert.equal(
    issue,
    undefined,
    `宿主闸门判定不兼容：${JSON.stringify(issue?.requirements)}——这类插件会被整行 disabled，症状是条目 pending 而非报错`,
  )
})
