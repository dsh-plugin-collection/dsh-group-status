/**
 * Fork-owned coverage for **构建产物与源码的一致性**。
 *
 * 为什么需要这一份：`lib/` 随仓库提交（见 `docs/upgrading.md`），而安装方直接吃它。
 * 2026-10-16 发现入库的 `lib/types/index.js`（tsdown 的打包入口）比 `src/index.ts`
 * 少 6 个配置项，导致发布出去的 `lib/index.js` 里 `Config` 只有 1 个字段——
 * 设置界面因此只画得出 1 个开关。根因是 `lib/tsconfig.tsbuildinfo` 是**增量**状态：
 * `tsc` 认为源文件没变就跳过输出，产物于是停在旧版本，而 `tsc` 退出码仍是 0，
 * 没有任何一步会报错。全量重建（删掉 tsbuildinfo + lib/types）即可修复。
 *
 * 所以这里锁两件事：
 *   1. 产物的**存在性**——每个实现源文件都该有对应的 `lib/types` 产物；
 *   2. 产物的**内容新鲜度**——`Config` 的字段集合必须与 `src/index.ts` 逐一对齐。
 *
 * 第 2 条是这次真出事的地方，也是唯一能抓住「少字段」的门禁。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

/** 仓库根：本文件在 `tests/` 下。 */
const root = new URL('../', import.meta.url)

const read = (p) => readFileSync(new URL(p, root), 'utf8')

/** 从源码里取 `Config` 的字段名——只认 schema 定义行，不认注释与类型声明。 */
const configFieldsInSource = () => {
  const src = read('src/index.ts')
  const start = src.indexOf('export const Config')
  assert.ok(start >= 0, 'src/index.ts 里应当有 `export const Config`')
  // 截到该声明结束（下一个顶层 `export` 或文件尾），避免把别处的同名字段算进来。
  const rest = src.slice(start)
  const next = rest.indexOf('\nexport ', 1)
  const body = next >= 0 ? rest.slice(0, next) : rest
  const names = [...body.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1])
  return [...new Set(names)].sort()
}

test('Config：产物的字段集合与 src/index.ts 逐一对齐', () => {
  const fromSource = configFieldsInSource()
  assert.ok(fromSource.length > 1, `源码 Config 应当不止 1 个字段，实际 ${fromSource.length}`)

  const artifact = read('lib/types/index.js')
  const start = artifact.indexOf('const Config = Schema.object(')
  assert.ok(start >= 0, 'lib/types/index.js 里应当有 `const Config = Schema.object(`')
  const rest = artifact.slice(start)
  const end = rest.indexOf('}).volatile()')
  const body = end >= 0 ? rest.slice(0, end) : rest
  const fromArtifact = [...new Set([...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]))].sort()

  assert.deepEqual(
    fromArtifact,
    fromSource,
    'lib/types/index.js 的 Config 字段与 src/index.ts 不一致——产物陈旧，跑 `pnpm build` 并提交 lib/',
  )
})

test('发布产物 lib/index.js 里的 Config 带着全部字段', () => {
  // 这是安装方真正加载的文件；它与 lib/types/index.js 之间隔着一个 tsdown。
  for (const field of configFieldsInSource()) {
    assert.match(
      read('lib/index.js'),
      new RegExp(`\\b${field}\\s*:`),
      `lib/index.js 的 Config 缺字段 \`${field}\`——设置界面会少一个开关`,
    )
  }
})

test('包依赖与 DSH 0.2.1-rc.2 基线一致', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '~4.0.5')
  assert.equal(pkg.dependencies['@deepseek-ai/schemastery'], '~3.18.5')
  assert.equal(pkg.devDependencies['@deepseek-ai/cordis'], '~4.0.5')
  assert.equal(pkg.devDependencies['@deepseek-ai/schemastery'], '~3.18.5')

  for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh-')) {
      assert.equal(version, '0.2.1-rc.2', `${name} 未对齐 DSH 0.2.1-rc.2`)
    }
  }

  assert.ok(
    pkg.dsh?.client?.inject?.includes('@deepseek-ai/dsh-api-remote-access'),
    '客户端注入缺少 remote-access：上游 0.2.1 的 Workspace access hook 无法声明依赖',
  )
})

test('每个客户端注入包都声明为 peer，且范围覆盖 engines.dsh 的下界与 0.2.2 线入口', () => {
  const pkg = JSON.parse(read('package.json'))
  const peers = pkg.peerDependencies ?? {}
  const inject = pkg.dsh?.client?.inject ?? []

  // 为什么必须逐条声明：**≤0.2.0 的内核不读 engines.dsh**，只按 `@deepseek-ai/dsh*`
  // peer 的范围判兼容（0.2.1 起才由 engines.dsh 单独决定，且此时 peer 根本不参与判定）。
  // 只写 engines.dsh 的话，0.2.0 会把本插件判成"兼容"并装进去；而那一代没发布
  // dsh-api-remote-access，客户端 inject 的 remoteAccess 永远拿不到 → fiber 永久
  // pending → uiWorkspace 不再被提供 → ui-sidebar / ui-conversation / ui-chat 一起
  // 不激活。实测 0.2.0-rc.2 真 GUI 是整页 "Failed to load plugins"。
  const floor = /^>=\s*(\S+)/.exec(String(pkg.engines?.dsh ?? ''))?.[1]
  assert.ok(floor, 'engines.dsh 必须以下界开头，本用例靠它推导 peer 范围')
  assert.ok(inject.length > 0, 'dsh.client.inject 不能为空')

  // 0.2.2-rc.1 起内核 latest 换代，engines.dsh 已按 tuple 显式分条款（见 Issues #45），
  // peer 同样需要追加 `|| ^0.2.2-rc.1` 才能在旧内核（不读 engines.dsh）上放行 0.2.2 线。
  const expectedPeer = `^${floor} || ^0.2.2-rc.1`
  for (const name of inject) {
    assert.equal(peers[name], expectedPeer, `${name} 未声明为 peer，或其范围与 engines.dsh 下界 + 0.2.2 线入口不一致`)
  }
})

test('每个实现源文件都有对应的 lib/types 产物', () => {
  /** 递归收集 `src/` 下的实现文件（`.ts`/`.tsx`）。手写 `.d.ts` 不产 `.js`，跳过。 */
  const walk = (dir) => {
    const out = []
    for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const p = `${dir}${e.name}`
      if (e.isDirectory()) out.push(...walk(`${p}/`))
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
    }
    return out
  }

  const missing = []
  for (const src of walk('src/')) {
    const base = src.replace(/^src\//, '').replace(/\.tsx?$/, '')
    for (const ext of ['.js', '.d.ts']) {
      const artifact = `lib/types/${base}${ext}`
      if (!existsSync(new URL(artifact, root))) missing.push(artifact)
    }
  }

  assert.deepEqual(
    missing,
    [],
    '以下产物缺失——`tsc` 的增量缓存会静默跳过输出，跑全量构建：rm -rf lib/types node_modules/.cache/tsconfig.tsbuildinfo && pnpm build（缓存位置见 tsconfig.json 的 tsBuildInfoFile）',
  )
})

/**
 * 卡片预览与徽标必须说同一件事。
 *
 * 卡片里给每行画的预览点，用的是官方 `StateDot`，状态取自 `badge-field.ts` 的
 * `BADGE_FIELD_DOT_STATE`；折叠徽标画的那三枚点也必须取自**同一张表**。两处各写一套
 * 的话，早晚漂成"卡片预览与徽标说的不是一回事" —— 而那正是本仓库反复要消灭的那类失败
 * （#25① 修过点行与明细的顺序，#37 发现配置面里混着别人家的语义）。
 *
 * 这条锁的是**源码形状**：徽标那三枚点必须从共享表里取，不能又写死一遍字面量。
 */
test('徽标的三枚点与卡片预览共用 BADGE_FIELD_DOT_STATE', () => {
  const badge = read('src/client/rows/GroupBadge.tsx')
  const field = read('src/client/badge-field.ts')

  for (const key of ['showPendingInBadge', 'showRunningInBadge', 'showCompletedInBadge']) {
    assert.ok(
      field.includes(`${key}: '`),
      `badge-field.ts 的 BADGE_FIELD_DOT_STATE 里应当有 ${key}`,
    )
    assert.ok(
      badge.includes(`BADGE_FIELD_DOT_STATE.${key}`),
      `GroupBadge.tsx 画 ${key} 那一枚点时必须取 BADGE_FIELD_DOT_STATE.${key}，不能另写字面量`,
    )
  }

  // 徽标里不该再出现写死的状态字面量（三枚点各一处）。
  const hardCoded = badge.match(/state="(warning|ongoing|done)"/g) ?? []
  assert.equal(
    hardCoded.length,
    0,
    `GroupBadge.tsx 里还有写死的状态：${hardCoded.join(', ')} —— 状态要从共享表取`,
  )
})
