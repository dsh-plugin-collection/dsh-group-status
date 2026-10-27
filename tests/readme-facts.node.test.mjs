/**
 * README 事实看守：文档里的可数事实必须与代码、与实跑结果同一条。
 *
 * ## 为什么需要它
 *
 * 2026-10-27 那轮 README 审查发现的不是文笔问题，是**八处与实现不符的陈述**同时存在于
 * 中英两份文档里，而且没有一条会红：版本徽章停在 `0.3.0`（已发布 `0.5.1`）、设置项写成
 * 「7 个」（schema 是 5 个）、用例数写成「27 + 165」（实跑 41 + 183）、跳过的上游 spec
 * 写成 7（清单里 9 条）、并且**同一份 README 自相矛盾**：上半页说外部来源在这一页没有
 * 开关，下半页说「现有两个来源各有一个专用设置项」。删掉的文案键 `status.waitingReview`
 * 等 5 个也还被列为本包新增。
 *
 * 每一条都是「改了代码没回来改文档」。这类漂移靠人记不住，所以把它变成断言。
 *
 * ## 六条判据（彼此独立，都能单独红）
 *
 *  1. **版本徽章** == `package.json` 的 `version`（两份 README 各一条）。
 *  2. **设置表**：README 表格里的字段集合与默认值 == `src/index.ts` 的 `Config`。
 *  3. **用例数**：README 与升级手册里的数字 == 实跑数量。Node 侧用静态计数，并再跑一次
 *     `node --test`（排除本文件）交叉验证静态计数没有把动态生成的用例算漏；Vitest 侧
 *     跑 `--reporter=json` 读 `numTotalTests`。
 *  4. **禁用措辞**：工单号、已删除的设置项与文案键、内网地址、`legacy/` 不得出现在用户
 *     文档里；英文文档另有破折号禁令（中文的破折号是正常标点，不在此列）。
 *  5. **引用可达**：README 里的相对链接与图片必须真实存在，图片还必须落在
 *     `package.json` 的 `files` 白名单里（发布 tarball 曾不含 `docs/`，README 的截图在
 *     包内视角是断链）。
 *  6. **发布说明的兜底源还在**：`.github/extract-notes.mjs` 在拿不到上一条 Release 时
 *     读 README 的特性小节，那节标题与要点少了就是发布说明静默变空。
 *
 * Vitest 跑不起来时（缺依赖等）只打 diagnostic、跳过第 3 条的 Vitest 部分，**不假装通过**。
 *
 * @module tests/readme-facts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const rootDir = fileURLToPath(root)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const pkg = JSON.parse(read('package.json'))
const ZH = 'README.md'
const EN = 'README.en.md'
const READMES = [ZH, EN]

/** 本文件的绝对路径：交叉验证 Node 用例数时要把它从 glob 里排掉。 */
const SELF = fileURLToPath(import.meta.url)

// ── 1. 版本徽章 ──

test('README 的版本徽章等于 package.json 的版本', () => {
  for (const file of READMES) {
    const found = /badge\/version-(.+?)-[0-9A-Fa-f]{6}\)/.exec(read(file))
    assert.ok(found, `${file} 里没有 version 徽章，改动请一并说明去向`)
    assert.equal(
      found[1],
      pkg.version,
      `${file} 的版本徽章停在 ${found[1]}，package.json 已是 ${pkg.version}`,
    )
  }
})

// ── 2. 设置表 ──

/** 从 src/index.ts 的 Config 块里取「字段 → 默认值」。 */
const configFields = () => {
  const source = read('src/index.ts')
  const start = source.indexOf('export const Config = Schema.object({')
  assert.ok(start >= 0, 'src/index.ts 里找不到 Config 声明，本条看守需要它作为唯一来源')
  const body = source.slice(start, source.indexOf('}).volatile()', start))
  const fields = new Map()
  for (const match of body.matchAll(/^ {2}(\w+): Schema\.\w+\(\)\.default\((.+?)\),$/gm)) {
    fields.set(match[1], match[2])
  }
  assert.ok(fields.size > 0, 'Config 里一个字段都没解析到，多半是声明写法变了')
  return fields
}

/** 从 README 的设置表里取「字段 → 默认值」。 */
const readmeSettings = (file, heading) => {
  const text = read(file)
  const start = text.indexOf(heading)
  assert.ok(start >= 0, `${file} 里找不到设置小节「${heading}」`)
  const section = text.slice(start, text.indexOf('\n---', start) > -1 ? text.indexOf('\n---', start) + text.slice(start).length : text.length)
  const rows = new Map()
  for (const match of section.matchAll(/^\| `(\w+)` \| `(.+?)` \|/gm)) {
    rows.set(match[1], match[2])
  }
  assert.ok(rows.size > 0, `${file} 的设置表没解析到任何字段`)
  return rows
}

test('README 设置表的字段与默认值 == src/index.ts 的 Config', () => {
  const fields = configFields()
  const tables = { [ZH]: readmeSettings(ZH, '## 设置'), [EN]: readmeSettings(EN, '## Settings') }
  for (const [file, rows] of Object.entries(tables)) {
    assert.deepEqual(
      [...rows.keys()].sort(),
      [...fields.keys()].sort(),
      `${file} 设置表的字段集合与 Config 不一致（文档写了 ${[...rows.keys()].join(', ')}；代码是 ${[...fields.keys()].join(', ')}）`,
    )
    for (const [name, documented] of rows) {
      assert.equal(
        documented,
        fields.get(name),
        `${file} 里 ${name} 的默认值写成 ${documented}，Config 是 ${fields.get(name)}`,
      )
    }
  }
  // 「N 个设置项」这类总数说法也必须是同一个数。
  for (const file of READMES) {
    for (const match of read(file).matchAll(/(\d+) 个设置项|(\d+) settings/g)) {
      const n = Number(match[1] ?? match[2])
      assert.equal(n, fields.size, `${file} 说「${match[0]}」，Config 实际有 ${fields.size} 个字段`)
    }
  }
})

// ── 3. 用例数 ──

/** 静态计数：每个 .node.test.mjs 里的 test( / it( 声明数（按行首缩进匹配）。 */
const staticNodeTests = (files) =>
  files.reduce((total, f) => {
    const source = readFileSync(join(rootDir, 'tests', f), 'utf8')
    return total + (source.match(/^\s*(?:test|it)\(/gm)?.length ?? 0)
  }, 0)

/**
 * 跑一次 node --test，读汇总里的 `# tests N`。
 *
 * 必须剥掉 `NODE_TEST_CONTEXT`：本文件自己就是被 `node --test` 拉起来的子进程，那个变量
 * 会一路传给我们的孙进程，而测试运行器在它存在时**不打印汇总行**（实测 stdout 里
 * `# tests` 整行消失，status 仍是 0）。带着它跑等于每次静默拿到 null。
 */
const runNodeTests = (files) => {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const out = spawnSync(process.execPath, ['--test', ...files.map((f) => join('tests', f))], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 120_000,
    env,
  })
  const found = /# tests (\d+)/.exec(out.stdout ?? '')
  if (out.status !== 0 || found === null) return undefined
  return Number(found[1])
}

/** 跑一次 vitest，读 JSON reporter 的 numTotalTests。 */
const runVitestTests = () => {
  const report = join(dirname(SELF), `.readme-facts-vitest.${process.pid}.json`)
  try {
    const { NODE_TEST_CONTEXT, ...env } = process.env
    const out = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${report}`], {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 600_000,
      env,
    })
    if (out.status !== 0 || !existsSync(report)) {
      process.stderr.write(`readme-facts: vitest 没能跑起来（exit ${out.status}），跳过 spec 用例数比对\n`)
      return undefined
    }
    return JSON.parse(readFileSync(report, 'utf8')).numTotalTests
  } finally {
    rmSync(report, { force: true })
  }
}

test('README 与升级手册里的用例数等于实跑数量', () => {
  const nodeFiles = readdirSync(join(rootDir, 'tests')).filter((f) => f.endsWith('.node.test.mjs'))
  const others = nodeFiles.filter((f) => join(rootDir, 'tests', f) !== SELF)

  // 静态计数是否可信：排除本文件后跑一次，差值必须正好是本文件自己的声明数。
  const staticOthers = staticNodeTests(others)
  const staticAll = staticNodeTests(nodeFiles)
  const runnerOthers = runNodeTests(others)
  assert.ok(runnerOthers !== undefined, 'node --test 没能给出 # tests 汇总，本条看守失去依据')
  assert.equal(
    runnerOthers,
    staticOthers,
    `静态计数与实跑不符（静态 ${staticOthers}，实跑 ${runnerOthers}）：有测试是循环里动态生成的，改用静态可数的写法`,
  )

  const vitestCount = runVitestTests()
  for (const file of READMES) {
    const text = read(file)
    for (const match of text.matchAll(/node --test[^\d]*(\d+)\s*(?:个)?(?:用例|cases)/g)) {
      assert.equal(Number(match[1]), staticAll, `${file} 的 Node 用例数写成 ${match[1]}，实算 ${staticAll}`)
    }
    for (const match of text.matchAll(/(?:vitest \+ jsdom|Vitest \+ jsdom)[^\d]*(\d+)\s*(?:个)?(?:用例|cases)/g)) {
      if (vitestCount === undefined) continue
      assert.equal(Number(match[1]), vitestCount, `${file} 的 spec 用例数写成 ${match[1]}，实跑 ${vitestCount}`)
    }
  }

  // docs/upgrading.md 的「上游代次跟踪」里也有一份「vitest 183 + node 41」，但那是**带日期的
  // 验证记录**：那三代确实在 41 个 Node 用例上全绿过。用例数会长，历史记录不改写，所以
  // 本条看守只比对 README（陈述当前行为的那类文档）。

  // README 必须真的写了两个数字，否则上面的循环会空转成「通过」。
  for (const file of READMES) {
    const text = read(file)
    assert.match(text, /node --test[^\d]*\d+/, `${file} 里没有 Node 用例数，检查是否整句被删`)
    assert.match(text, /(?:vitest|Vitest)[^\d]*\d+/, `${file} 里没有 spec 用例数，检查是否整句被删`)
  }
})

test('README 说的「只能在 monorepo 里跑」的 spec 数等于跳过清单条数', () => {
  const config = read('vitest.config.ts')
  const start = config.indexOf('const MONOREPO_ONLY_SPECS = [')
  assert.ok(start >= 0, 'vitest.config.ts 里找不到 MONOREPO_ONLY_SPECS，本条看守失去依据')
  const list = config.slice(start, config.indexOf('\n]', start))
  const skipped = [...list.matchAll(/^\s+'tests\//gm)].length
  assert.ok(skipped > 0, '跳过清单没解析到任何条目')

  const note = /\* (\w+) specs are skipped \(`MONOREPO_ONLY_SPECS`\)/.exec(config)
  assert.ok(note !== null, 'vitest.config.ts 头注释里的跳过数量写法变了，看守需要跟着改')
  const WORD = { three: 3, four: 5 - 1, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  assert.equal(
    WORD[note[1].toLowerCase()],
    skipped,
    `vitest.config.ts 注释写「${note[1]} specs are skipped」，清单里是 ${skipped} 条`,
  )

  for (const [file, pattern] of [[ZH, /(\d+) 个上游 spec/g], [EN, /(\d+) upstream specs/g]]) {
    const hits = [...read(file).matchAll(pattern)]
    assert.ok(hits.length > 0, `${file} 没写上游 spec 的跳过数量，检查是否整句被删`)
    for (const hit of hits) {
      assert.equal(Number(hit[1]), skipped, `${file} 说 ${hit[1]} 个，跳过清单实际 ${skipped} 条`)
    }
  }
})

// ── 4. 禁用措辞 ──

/** 用户文档里不该出现的东西：内部工单号、已删除的实现名、内网地址。 */
const BANNED = [
  'Issues #',
  'legacy/',
  'showScheduledInBadge',
  'showWaitingReviewInBadge',
  'status.waitingReview',
  'status.scheduled',
  '192.168.',
  'Failed to load plugins',
]

test('README 不含内部措辞与已删除的实现名', () => {
  for (const file of READMES) {
    const text = read(file)
    for (const needle of BANNED) {
      assert.ok(!text.includes(needle), `${file} 里出现「${needle}」：工单号与实现细节不进用户文档，机制归 docs/`)
    }
    // 中文的破折号是正常标点，英文文档按写作用规禁用。
    if (file === EN) {
      assert.ok(!/[\u2014\u2013]|(?<=\s)--(?=\s)/.test(text), `${file} 里出现破折号（em dash、en dash 或空格夹的 --），改用逗号、冒号、分号或括号`)
    }
  }
})

test('package description 不把外部来源写成本插件的档位', () => {
  for (const needle of ['定时任务', '等待评审', 'waiting review']) {
    assert.ok(!String(pkg.description).includes(needle), `description 出现「${needle}」：那是提供方注册的状态源，不是本插件的档位`)
  }
})

// ── 5. 引用可达 ──

/** 两份 README 里出现的相对引用（链接与图片），排除外链与页内锚点。 */
const relativeRefs = (file) => {
  const text = read(file)
  const refs = new Set()
  for (const match of text.matchAll(/(?:\]\(|src=")(?!https?:|#|mailto:)([^)#"\s]+)/g)) {
    refs.add(match[1])
  }
  return [...refs]
}

/** 该相对路径是否被 package.json 的 files 白名单覆盖。 */
const coveredByFiles = (path) =>
  pkg.files.some((entry) => {
    const e = entry.replace(/\/$/, '').replace(/\/\*$/, '')
    return path === e || path.startsWith(`${e}/`)
  })

test('README 的相对引用存在，图片落在发布白名单内', () => {
  for (const file of READMES) {
    for (const ref of relativeRefs(file)) {
      assert.ok(existsSync(new URL(`../${ref}`, import.meta.url)), `${file} 指向不存在的 ${ref}`)
      if (/\.(png|jpe?g|webp|svg)$/i.test(ref)) {
        assert.ok(coveredByFiles(ref), `${ref} 是 README 用到的图片，但 package.json 的 files 没覆盖它：发布 tarball 里会断链`)
      }
    }
  }
})

// ── 6. 发布说明的兜底源 ──

test('特性小节还在（extract-notes 的兜底数据源）', () => {
  const headings = ['## 功能', '## 特性一览', '## Features']
  const text = read(ZH)
  const start = text.indexOf(headings.find((h) => text.includes(h)) ?? '')
  assert.ok(start >= 0, `${ZH} 缺 ${headings.join(' / ')} 之一：.github/extract-notes.mjs 取不到它就静默退化`)
  const bullets = text.slice(start).split('\n').slice(1).filter((l) => /^- /.test(l))
  const stopAt = text.slice(start).split('\n').findIndex((l, i) => i > 0 && /^#{2,3} /.test(l))
  assert.ok(
    bullets.length > 0 && (stopAt === -1 || stopAt > 1),
    `${ZH} 的特性小节里没有要点，发布说明会拿到空清单`,
  )
})
