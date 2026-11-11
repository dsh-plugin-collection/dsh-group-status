/**
 * 发布面看守：`package.json#files` 白名单与真实 tarball 清单必须说同一件事。
 *
 * ## 为什么需要它
 *
 * `exports` 与 `main` 声明的是「安装方能不能解析到入口」，`files` 决定的是「这个文件在不在包里」。
 * 两份清单各说各话时，npm 不报错、`tsc` 不报错、本地 `npm test` 也全绿，出事只发生在装包的人身上：
 *
 *  - **0.5.3 的真实事故**：`"files": ["lib", …]` 把整个 `lib/` 兜进包，于是 tsc 的增量缓存
 *    `lib/tsconfig.tsbuildinfo`（160 kB，`.gitignore` 里明明有 `*.tsbuildinfo`）、tsdown 的打包
 *    输入 `lib/types` 下的 `.js`（305 kB）与它们的 map 一起发了出去：529.7 kB / 182 个文件，
 *    其中运行时真正会用到的不到六分之一。**`.gitignore` 对 `files` 白名单没有任何作用**：
 *    白名单是正向枚举，目录条目会连同目录里的缓存一起收走。
 *  - **同一族的另一半**：`exports["./src/*"]` 指向的 `src/` 从来没进过包，消费者解析必然
 *    失败；`lib/types` 下 `.d.ts.map` 的 `sources` 是 `../../../src/…`，同样是死链。
 *    `docs/` 也曾整目录不在 `files` 里，README 的截图在包内视角是断链（那条已由
 *    `tests/readme-facts.node.test.mjs` 守着）。
 *
 * 这些都是「改一行 package.json 就静默生效」的约定，所以把它们变成断言。
 *
 * ## 判据从哪来（分两类，失败时的含义不同）
 *
 *  1. **静态 + 路径语义**：用本文件里那份与 npm 对齐的匹配器，判断某个仓库内路径会不会进包。
 *     不依赖 npm，任何机器上都成立。
 *  2. **实测**：`npm pack --dry-run --json` 的真实清单。它才代表「这台机器上真的发什么」。
 *
 * 第 2 类拿不到时（CI 的 `release-invariants` job 刻意不装依赖、`npm` 不在 PATH、打包非零退出），
 * 打印 diagnostic 并**跳过**，不假装通过；而第 1 类里那几条「规范」断言不因此失去依据。
 *
 * ## `files` 里的 `!` 是怎么生效的（读的 npm-packlist 源码，不是直觉）
 *
 * npm 把 `files` 编译成一套 minimatch 规则：先塞一条 `*`（什么都排除），每个 include 条目变成
 * `!条目`（负规则，重新包含），每个 `!条目` 原样成为正规则（排除）。规则**按数组顺序叠加、
 * 后命中者覆盖先命中者**，与 `node_modules` 里 `.gitignore` 的层级语义不是一回事，别混用。
 * 另有两点实测如此、直觉容易错：
 *  - 命中一个**目录**的规则（`lib/types`、`lib/*`）会把整棵子树放行；`*` 只管它自己那一层目录名；
 *  - 无通配且指向**文件**的条目走 strict 通道，无条件包含，连 `*` 都压得过。
 *
 * 逐条实测见 `tests/package-files.node.test.mjs` 的「静态推导与 npm 实测一致」那条：它拿真实
 * `npm pack` 的输出对账，所以推导漂了会红。典型的错法（2026-11-11 在 /tmp 探针包里撞过）是
 * 把「取反」当成一票否决，或把 `lib/types` 当成「只放行该目录下的东西、不递归」。
 *
 * ## 用例清单（静态可数；`readme-facts` 会拿 `# tests` 汇总与静态计数比对，所以不许循环生成 test）
 *
 *  - exports 的每个目标都在 files 白名单内（含 `types` 条件、`!` 取反、`*` 通配三种陷阱）
 *  - 每个 exports 目标文件真实存在（白名单覆盖了不存在的路径等于没覆盖）
 *  - 每条 `!` 条目都真的落在某个 include 的覆盖范围内（写错前缀的取反等于没写）
 *  - tarball 实测清单里没有构建中间产物、增量缓存与机器垃圾
 *  - 静态推导与 npm 实测一致（npm 语义换代、白名单形状漂移都会在这里红）
 *  - 发布面里的 .map 都指向包内可解析的源
 *  - tarball 与 lib/、src/ 里不得出现构建机绝对路径
 *  - tsconfig 的 tsBuildInfoFile 不会落回 lib/、也不会是仓库根下的裸文件名
 *  - tarball 的 version 与仓库 package.json 一致（防止 pack 读到别处）
 *
 * ## 明确不重复的两条
 *
 *  - **README 图片是否被白名单覆盖**：`tests/readme-facts.node.test.mjs` 的「README 的相对引用存在，
 *    图片落在发布白名单内」已经覆盖，它顺带校验引用存在性。这里再写一遍只会得到两条需要同步
 *    维护、却以不同措辞红在同一处的用例。
 *  - **体积与文件数**：不设任何上限。529.7 kB → 333.3 kB 这类数字随构建浮动（gzip 实现、依赖
 *    升级、源码增行都会动它），写死就是给下一次正常改动挖坑。该锁的是**类别**（哪些文件不该
 *    出现），不是字节数；`lib/client.js` 的 gzip 预算已由 `.github/workflows/ci.yml` 的
 *    `release-invariants` 管着。
 *
 * @module tests/package-files
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const rootDir = fileURLToPath(root)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

/** `tsconfig.json` 是 JSONC（tsc 允许注释与尾逗号），按字符串状态机剥掉注释再解析。 */
const parseJsonc = (text) => {
  let out = ''
  let quote = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quote) {
      out += c
      if (c === '\\') out += text[(i += 1)] ?? ''
      else if (c === '"') quote = false
      continue
    }
    if (c === '"') {
      quote = true
      out += c
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 1
    } else if (c !== '\r') {
      out += c
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

const pkg = JSON.parse(read('package.json'))
const tsconfig = parseJsonc(read('tsconfig.json'))

// ── files 白名单的匹配语义 ──

/**
 * 一条 `files` 条目编译出来的 minimatch 规则，对齐 `npm-packlist` 的 `processPackage`：
 * 剥 `./` 前缀；`*` 不跨 `/`；`**` 跨目录且**可以匹配零个**（`lib/**` 加 `/x.js` 命中 `lib/x.js`）。
 */
const toRegex = (pattern) => {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/?/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
  return new RegExp(`^${body}$`)
}

/**
 * 一条条目是否命中这片相对路径。
 *  - 指向文件的条目（strict）：只认精确路径；
 *  - 其它条目：命中它自己、或命中它的某一级祖先目录都算（`lib/types` 放行整棵子树，
 *    `lib/*` 命中 `lib/types` 这一级目录，于是 `lib/types/deep/x.js` 也放行——npm 实测如此）。
 */
const ruleHits = (rule, path) => {
  if (rule.strict) return rule.pattern === path
  const segments = path.split('/')
  for (let i = 1; i <= segments.length; i += 1) {
    if (rule.regex.test(segments.slice(0, i).join('/'))) return true
  }
  return false
}

/**
 * `files` 编译成按数组顺序叠加的规则表。`kindOf(pattern)` 给出条目在磁盘上的形态：
 * `file`（走 strict）、`dir`、`absent`（路径还不存在——按目录看待，那正是「路径配错」的形态，
 * 不能因为目录不存在就当成永远不命中）。
 */
const compileRules = (files, kindOf) =>
  files.map((raw) => {
    const negate = raw.startsWith('!')
    const pattern = (negate ? raw.slice(1) : raw)
      .replace(/^(\.?\/)+/, '')
      .replace(/\/+$/, '')
      .replace(/\/\*$/, '/**')
    const kind = negate ? 'absent' : kindOf(pattern)
    return {
      pattern,
      negate,
      strict: kind === 'file',
      regex: toRegex(pattern),
    }
  })

/**
 * 这片路径最终会不会进包：起点是排除（npm 先塞的那条 `*`），然后逐条叠加，
 * **后命中者覆盖先命中者**。`!` 条目排在 include 之后就只摘掉它自己命中的那部分。
 */
const walkSays = (rules, path) => {
  let included = false
  for (const rule of rules) {
    if (ruleHits(rule, path)) included = !rule.negate
  }
  return included
}

/** 仓库 `files` 下某路径的去留；`undefined` 表示推导不出，交给实测清单对账。 */
const packlistSays = (path) => {
  // npm 无条件附带 `package.json` 与 README/README.*（strict 规则，连 `*` 都压得过）。
  if (/^(package\.json|readme(\.[^/]*)?)$/i.test(path)) return true
  const files = pkg.files ?? []
  // include 里有「非尾段通配」（`lib/*/x.js`）时，被它放行的前缀下有什么静态说不准。
  if (files.some((e) => !e.startsWith('!') && /\*/.test(e.replace(/\/?\*+$/, '')))) return undefined

  const kindOf = (pattern) => {
    if (pattern === '') return 'absent'
    const url = new URL(pattern, root)
    if (!existsSync(url)) return 'absent'
    return statSync(url).isDirectory() ? 'dir' : 'file'
  }
  return walkSays(compileRules(files, kindOf), path)
}

// ── tarball 实测清单 ──

/**
 * 跑一次真实打包，返回清单（仓库相对路径）。拿不到就返回 `{ why }`，由调用方打 diagnostic 并跳过。
 *
 * 为什么钉 `--dry-run --json`：`--dry-run` 不落盘；不钉 `--json` 的话输出格式随 npm 版本在
 * 「人类可读」与「JSON」之间摇摆，解析会静默拿到空清单。`--ignore-scripts` 是因为本仓库的
 * `prepublishOnly` 会触发全量构建——看守只读，不许改写工作树。
 *
 * 必须剥掉 `NODE_TEST_CONTEXT`：本文件自己就是被 `node --test` 拉起的子进程，那个变量会一路传给
 * 孙进程，而测试运行器在它存在时的行为与本文件不一致。保持与 `readme-facts` 相同的调用习惯。
 */
const packList = () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const out = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 180_000,
    env,
  })
  if (out.error) return { why: `npm 调用失败：${out.error.code ?? out.error.message}` }
  if (out.status !== 0) return { why: `npm pack 退出码 ${out.status}：${(out.stderr ?? '').slice(0, 300)}` }
  let report
  try {
    report = JSON.parse(out.stdout)
  } catch {
    return { why: `npm pack 的 --json 输出解析失败：${(out.stdout ?? '').slice(0, 200)}` }
  }
  const first = report?.[0]
  if (!first?.files || !Array.isArray(first.files)) return { why: 'npm pack --json 里没有 files 清单' }
  return { files: first.files.map((f) => f.path).sort(), version: first.version }
}

/** 实测清单只算一次：同一个文件里几条用例共用。 */
const PACK = packList()

/** 拿不到实测清单时的统一话术：说清为什么**不**当成通过，以及 CI 里该去哪找依据。 */
const packSkipNote = (t) => {
  t.diagnostic(`package-files: 拿不到 npm 实测清单（${PACK.why}），本条跳过——静态可推导的结论仍由前几条用例看守`)
}

// ── exports 展开 ──

/** 递归展开 exports（`"."`、子路径、条件对象、字符串、数组），得到 `[{ where, target }]`。 */
const exportTargets = () => {
  const out = []
  const walk = (value, where) => {
    if (typeof value === 'string') return out.push({ where, target: value })
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        // 条件的 key 以 `.` 开头才是子路径；`types` / `default` / `import` 是条件。
        walk(v, key.startsWith('.') ? `${where} → ${key}` : `${where} (${key})`)
      }
    }
  }
  walk(pkg.exports ?? {}, 'exports')
  return out
}

const rel = (target) => target.replace(/^\.\//, '')

/** `readdirSync` 的薄封装：目录不存在时返回空列表（`lib/` 未构建的机器）。 */
const readdirSyncSafe = (dir) => {
  try {
    return readdirSync(new URL(dir, root)).filter((n) => n !== 'node_modules')
  } catch {
    return []
  }
}

// ── 1. exports 目标被白名单覆盖 ──

test('exports 的每个目标都被 files 白名单覆盖，且没被取反条目排除', () => {
  // 为什么需要：exports 指向一个不在包里的文件时，本地一切正常（文件就在仓库里），
  // 安装方 install 之后才 404。取反条目命中出口目标也归这一条——那是
  // `"files": ["lib", "!lib/**"]` 这种改动后本地全绿、安装方拿到空包的形态。
  //
  // 判据：对 exports 里每个**字面**目标（`.` 与 `./client` 的 types/default 共四个），
  // 按 npm 的叠加语义推导「会进包」。带 `*` 的（历史上有过 `"./src/*"`）**一律判红**：
  // 通配出口能解析到哪些文件取决于消费方的路径，静态推不准；本包对外只有 `.` 与 `./client`
  // 两个真入口，真要加通配出口，请先把它换成逐条字面路径再来改这条用例，别放宽判据。
  const targets = exportTargets()
  assert.ok(targets.length > 0, 'package.json 里没有 exports，本条看守失去依据')

  const wildcard = targets.filter((t) => t.target.includes('*'))
  assert.deepEqual(
    wildcard.map((t) => `${t.where} = ${t.target}`),
    [],
    'exports 里有通配目标：白名单是否覆盖它无法静态推导。改用字面路径（如 "./package.json"），'
      + '或先确认该子路径真的会被消费者按通配解析，再扩充本条看守',
  )

  for (const { where, target } of targets) {
    const path = rel(target)
    assert.ok(
      !path.startsWith('..') && !path.startsWith('/'),
      `${where} 的目标 ${target} 指向包外：npm 只发布仓库内相对路径，消费者永远解析不到`,
    )
    assert.equal(
      packlistSays(path),
      true,
      `${where} 的目标 ${path} 不被 files 白名单覆盖（或被某条 ! 取反排除）：安装方解析该子路径会失败。`
        + '把它的目录或文件加进 package.json#files，并确认没有更靠后的取反条目把它摘掉',
    )
  }
})

test('exports 的每个目标文件在仓库里真实存在', () => {
  // 判据：白名单覆盖一个不存在的路径等于没覆盖。与上一条正交——`files` 里写 `lib/types`
  // 但构建只产出了部分文件时，`. /client` 的 types 入口会指向空气，而这种错只在消费者侧报。
  //
  // 需要先 `npm run types`（`npm run test:node` 会先跑它）；没有 lib/ 时这里会红，
  // 那是对的信号：exports 声明了产物，产物就该在仓库里（约定：产物随源码提交）。
  for (const { where, target } of exportTargets()) {
    if (target.includes('*')) continue
    const path = rel(target)
    assert.ok(
      existsSync(new URL(path, root)),
      `${where} 的目标 ${path} 不存在：跑 pnpm build 后提交 lib/，或修正 exports 指向`,
    )
  }
})

// ── 2. files 条目本身 ──

test('files 的每条取反条目都落在某个 include 的覆盖范围内', () => {
  // 为什么需要：`!lib/types/**` 只有在 `lib/types`（或更宽的 `lib`）被 include 时才有作用。
  // include 那一半被误删、取反条目留在原地时，npm 会把它**当成 include 条目**读（`!` 只是前缀），
  // 于是被排除的中间产物反而进了包——发布面以一种很难懂的方式变大，而且本地全绿。
  //
  // 判据：每条 `!` 条目的最长静态前缀，必须被某条 include 的覆盖范围包住。留一条冗余但
  // 无害的取反**不判红**（删掉它，将来有人加回更细的 include 时可能忘了恢复），
  // 判的是「前缀根本没人认领」这种错位。
  const includes = (pkg.files ?? []).filter((e) => !e.startsWith('!'))
  const excludes = (pkg.files ?? []).filter((e) => e.startsWith('!'))
  assert.ok(includes.length > 0, 'files 里没有任何 include 条目，发布面只剩 npm 自动附带的那几个文件')

  for (const entry of excludes) {
    const pattern = entry.slice(1)
    // 第一个通配符之前的部分就是它的静态前缀；取它所在的目录作为"这片子树归谁管"。
    const prefix = pattern.split('*')[0].replace(/\/[^/]*$/, '')
    const owned = includes.some((inc) => {
      const bare = inc.replace(/\/+$/, '')
      return prefix === bare || prefix === '' || prefix.startsWith(`${bare}/`)
    })
    assert.ok(
      owned,
      `files 里的 ${entry} 没有任何 include 覆盖它所在的位置：include 那一半大概被删了。`
        + '补回对应的 include（例如 lib/types），否则 npm 会把这行当成 include，反向把中间产物放进包',
    )
  }
})

// ── 3. 实测 tarball 里不得出现中间产物 ──

test('发布清单里没有构建中间产物、增量缓存与机器相关文件', (t) => {
  // 判据全部对准 **npm pack --dry-run --json 的真实清单**，不是本文件的推导：
  //
  //  - 无 `*.tsbuildinfo`：tsc 增量缓存。`.gitignore` 有 `*.tsbuildinfo` 也挡不住包，
  //    因为它是被 `files` 的目录条目收走的。同一份源码在两台机器上缓存内容不同，发出去还等于
  //    泄漏构建机状态。
  //  - 无 `lib/types` 下的 `.js` 与 map：只是 tsdown 的打包输入，运行时与类型都读不到；
  //    `.d.ts.map` 的 `sources` 指向未发布的 `src/`，发布面里是死链。注意 `lib/client.js.map`
  //    是**刻意**发布的（浏览器栈还原），不在这些模式里。
  //  - 无 `.DS_Store` / `Thumbs.db` / `__MACOSX/` / `*.log`：本地垃圾被目录条目顺带收走的典型。
  const BANNED = [
    [/\.tsbuildinfo$/, 'tsc 增量缓存：把 tsBuildInfoFile 挪出 lib/（见 tsconfig.json），别只靠 .gitignore'],
    [/^lib\/types\/.+\.js$/, 'tsdown 的打包输入，运行时与 types 都不读它'],
    [/^lib\/types\/.+\.js\.map$/, '同上，sources 同样指向未发布的 src/'],
    [/^lib\/types\/.+\.d\.ts\.map$/, 'd.ts 的 sourcemap，sources 指向未发布的 src/，发布面里是死链'],
    [/\.(log|DS_Store)$/, '本地垃圾文件，被目录条目顺带收走了'],
    [/(^|\/)Thumbs\.db$/, '本地垃圾文件'],
    [/(^|\/)__MACOSX\//, '本地垃圾目录'],
  ]

  if (!PACK.files) return packSkipNote(t)

  // 空清单也算失败：`--json` 输出变了或 npm 换了行为时，别让「一条都没匹配」伪装成全绿。
  assert.ok(PACK.files.length > 0, 'npm pack 实测清单是空的，本条看守失去依据')

  const hits = []
  for (const path of PACK.files) {
    for (const [pattern, why] of BANNED) {
      if (pattern.test(path)) hits.push(`${path}（${why}）`)
    }
  }
  assert.deepEqual(
    hits,
    [],
    '以下文件进了发布包：构建中间产物与机器相关文件不该发给安装方。'
      + '用 files 白名单里靠后的取反条目挡住它们，或干脆别让 include 覆盖到它们',
  )

  // 反向自证：包里确实有 `.d.ts`。白名单哪天被写成「什么都挡」，types 入口就断了。
  assert.ok(
    PACK.files.some((p) => p.endsWith('.d.ts')),
    '发布清单里一个 .d.ts 都没有：exports 的 types 入口会失效。检查 lib/types 是否被误排除',
  )
})

test('静态推导与 npm 实测一致：取反条目在这台 npm 上确实生效', (t) => {
  // 判据：本文件的匹配器与 npm 对同一份白名单的理解必须一致。不一致只有两种解释——
  // 白名单形状变了（某条目录条目把不该发的收进来、或取反失效），或 npm 的 `!` 语义换代了。
  //
  // 为什么必须对账而不是只信推导：`files` 的语义在不同 npm 版本上行为不同，而发布用的是
  // 发布机上的 npm。只懂推导的看守会在「本地绿、发布红」这个最贵的形态上失效。
  if (!PACK.files) return packSkipNote(t)

  const mismatch = []
  // 清单里出现的每一条，推导都应当说「会进包」。
  for (const path of PACK.files) {
    if (packlistSays(path) === false) mismatch.push(`${path}：推导说它不该在包里，实测发了`)
  }
  // 反方向只对仓库里真实存在、且推导说「会被排除」的文件查——那是最该被取反接住的中间产物。
  // 不把 `src/` 这类本来就不 include 的目录算进来（它们不去问推导）。
  const excludedButPacked = (dir) => {
    for (const name of readdirSyncSafe(dir)) {
      const path = `${dir}${name}`
      const st = statSync(new URL(path, root))
      if (st.isDirectory()) excludedButPacked(`${path}/`)
      else if (packlistSays(path) === false && PACK.files.includes(path)) mismatch.push(`${path}：推导说会被排除，实测发了`)
    }
  }
  excludedButPacked('lib/types/')

  assert.deepEqual(
    mismatch,
    [],
    '本文件的 files 匹配器与 npm 实际打包结果不一致。先确认 package.json#files 的形状有没有变，'
      + '再确认 npm 的 `!` 语义是否换代（本文件头部记了逐条实测的语义）',
  )
})

// ── 4. map 的源必须可解析 ──

test('发布面里的 .map 都指向包内可解析的源', (t) => {
  // 判据：`.d.ts.map` 的每条 `sources` 出去，按 tsc 的映射规则（`.ts` → `.d.ts`）在包里要能找到。
  // `lib/client.js.map` 的源被 tsdown 重写成 `../src/…`（浏览器栈还原要靠它，那个路径在 GitHub
  // 上可读），本用例不去够它；这里盯的是 `lib/types` 侧——那里的 `.d.ts.map` 曾以
  // `../../../src/…` 指向一个不发布的目录，在包内视角就是 404。
  if (!PACK.files) return packSkipNote(t)

  const inPack = new Set(PACK.files)
  const dead = []
  for (const path of PACK.files.filter((p) => p.endsWith('.d.ts.map'))) {
    const map = JSON.parse(readFileSync(join(rootDir, path), 'utf8'))
    for (const source of map.sources ?? []) {
      const resolved = join(dirname(path), source).replaceAll('\\', '/')
      if (resolved.startsWith('..')) continue // 故意指向包外（client.js.map 走这条路）
      const candidates = [resolved, resolved.replace(/\.ts$/, '.d.ts')]
      if (!candidates.some((c) => inPack.has(c))) dead.push(`${path} → ${source}`)
    }
  }
  assert.deepEqual(
    dead,
    [],
    '以下 sourcemap 的源不在包里：点进去是死链。要么别发这些 .map（files 里加取反），'
      + '要么让 tsc 把 sources 指向包内路径',
  )
})

// ── 5. 绝对路径 ──

test('发布面与 lib/、src/ 里不得出现构建机绝对路径', () => {
  // 为什么需要：`/home/<user>/` 一类路径进包等于把构建机目录结构发出去；它们同时是
  // **产物不可复现**的同义词（同一 commit 换个目录构建就得到不同字节，`artifact-drift` 那条
  // 跨目录比对会因此红）。CI 已有一条 grep 守着 lib/，但它跑在 `check` 与 `artifact-drift` 里、
  // 且只看 lib/；这里连**已发布的**文件一起查。
  //
  // 范围为什么另外包含 src/：注释里举的 `/home/...` 例子不会进产物，但 src 里出现**可执行**的
  // 绝对路径迟早会被构建搬进产物；全仓扫的成本只是读几十个文本文件，误报也只可能来自注释，
  // 真出现就改写成 `~/…` 或省略用户名。
  //
  // 拿不到实测清单时这条**判红而不是跳过**：它与别的用例不同，前半段就是「发布面是否可确认」，
  // 打包失败时不能假装通过。
  const ABSOLUTE = /(?:\/home|\/Users|\/root|\/private\/var\/folders)\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\\\?Users\\\\?/
  const hits = []
  const scan = (path) => {
    const text = read(path)
    const line = text.split('\n').findIndex((l) => ABSOLUTE.test(l))
    if (line >= 0) hits.push(`${path}:${line + 1}`)
  }

  assert.ok(
    PACK.files,
    `拿不到 npm 实测清单（${PACK.why}），无法确认发布面：打包失败时这条不该通过，先修好 npm pack`,
  )
  for (const path of PACK.files) {
    if (/\.(m?js|cjs|tsx?|json|map|css|md|ya?ml)$/.test(path)) scan(path)
  }

  // src/ 与 lib/ 全量扫（与有没有实测清单无关：它们是源头）。
  const walk = (dir) => {
    for (const name of readdirSyncSafe(dir)) {
      const path = `${dir}${name}`
      const st = statSync(new URL(path, root))
      if (st.isDirectory()) walk(`${path}/`)
      else if (/\.(m?js|cjs|tsx?|json|map|css)$/.test(name)) scan(path)
    }
  }
  walk('src/')
  walk('lib/')

  assert.deepEqual(
    hits,
    [],
    '以下文件含构建机绝对路径：产物里不该有机器相关路径（换目录构建就不可复现）。'
      + '在 build/tools/ 里把它改成仓库相对路径；注释里举的例子改成 `~/…` 或省略用户名',
  )
})

// ── 6. tsBuildInfoFile 不得落回 lib/ ──

test('tsconfig 的 tsBuildInfoFile 不会落回 lib/，也不是仓库根下的裸文件名', () => {
  // 为什么需要：0.5.3 的核心事故就是 tsc 把增量缓存写在 `lib/` 里，再被 `"files": ["lib"]`
  // 一起打包。现在有两道锁——`files` 不再整目录收 `lib/`（上面几条管着），以及缓存本身挪出了
  // `lib/`。这条守第二道：它比白名单更难被"顺便"改回去。
  //
  // 三种形态判红：
  //  - 未设 `tsBuildInfoFile`：默认落在 `outDir`（`lib/types`）下，同样会被目录条目收走；
  //  - 解析后落在 `lib/` 下（或 `outDir` 之下）：白名单一放宽就复发；
  //  - 是仓库根下的裸文件名：`files` 不含它，但会变成 untracked，CI 的「不许留下改动」检查会红。
  //
  // `node_modules/.cache/…` 为什么合法：它**在仓库内**（换机器仍是同一相对位置，缓存里不会
  // 出现构建机绝对路径），同时被 `.gitignore` 的 `node_modules` 忽略、`files` 白名单也不含它，
  // 于是既不会进 git 也不会进包。相对路径按 **tsconfig 所在目录**解析（这里是仓库根），不是按 cwd。
  //
  // 不扫 `lib/` 里的残留缓存：那是机器状态而不是源码事实——干净 checkout 没有，任何本地构建过
  // 0.5.3 的开发机都有一份，同一份代码会按机器给出相反结论。残留不影响发布这一点，已由
  // 「发布清单里没有构造中间产物」那条的实测清单保证。
  const cache = tsconfig.compilerOptions?.tsBuildInfoFile
  assert.ok(
    cache,
    'tsconfig.json 没有设 tsBuildInfoFile：tsc 会把缓存写进 outDir（lib/types），被目录条目收进包',
  )

  const normalized = normalize(join(rootDir, String(cache))).replace(/^([A-Za-z]):/, (m) => m.toLowerCase())
  const repoRoot = normalize(rootDir).replace(/^([A-Za-z]):/, (m) => m.toLowerCase())
  const prefix = repoRoot.endsWith('/') ? repoRoot : `${repoRoot}/`
  assert.ok(
    normalized.startsWith(prefix),
    `tsBuildInfoFile 解析到仓库外（${cache} → ${normalized}）：缓存会带构建机路径，换机器不可复现。`
      + '写成 node_modules/.cache/ 之类的仓库内相对路径',
  )

  const inRepo = normalized.slice(prefix.length)
  assert.ok(
    !inRepo.split('/').includes('lib'),
    `tsBuildInfoFile 又落回 lib/ 了（${cache} → ${inRepo}）：白名单一放宽它就重新进包。`
      + '挪到 node_modules/.cache 之类发布面之外的位置',
  )
  assert.ok(
    inRepo.includes('/'),
    `tsBuildInfoFile 是仓库根下的裸文件名（${cache} → ${inRepo}）：会变成 untracked，CI 的「不许留下改动」检查会红。放进 node_modules/.cache/ 之类的目录`,
  )
})

// ── 7. 导入面自检 ──

test('发布清单与 version 字段对得上（防止 pack 读到别处的 package.json）', (t) => {
  // 判据：`npm pack` 读的是**当前工作目录**的 package.json。本文件在 worktree 里跑、或将来有人
  // 把测试挪进子目录时，很容易打包到别处去，得到一份"看起来正常"的清单。版本号是最省事的
  // 对账锚点。
  //
  // 不比对文件数或体积：那两个随构建浮动。
  if (!PACK.files) return packSkipNote(t)
  assert.equal(
    PACK.version,
    pkg.version,
    'npm pack 打出来的版本与仓库里 package.json 的不一致：打包可能发生在别的目录，本条及同组的实测结论都不作数',
  )
})

// ── 8. README 指向非发布文档的链接 ──

/**
 * README 里指向**仓库内但不进包**的文件的引用，必须是绝对地址且真的存在。
 *
 * 判据分两条，缺一不可：
 *  1. **不能再是相对链接**：`docs/` 整目录已退出 tarball（`files` 只留 `docs/media`），包内视角
 *     的相对链接是死链。这条在改成绝对之后**没有任何别的看守覆盖**——`readme-facts` 的
 *     `relativeRefs()` 正则带 `(?!https?:)`，绝对链接根本进不了集合，而 `coveredByFiles()` 只对
 *     图片断言。于是那一轮改造顺手把 `docs/upgrading.md`、`docs/facet-protocol.md` 从唯一一条
 *     存在性断言里摘了出去：文件被删、被改名，现在都不会红。这条补回的正是这个洞。
 *  2. **绝对链接必须指向真实存在的文件**：写对地址不等于指向对文件，`blob/main/` 后面的路径
 *     同样会随着重命名一起漂。
 *
 * 只查非图片引用：图片（`docs/media/*`）仍在包内，readme-facts 的 `coveredByFiles()` 管着它们。
 */
test('README 的非图片引用若指向包外文件，必须是绝对地址且文件真实存在', () => {
  const BLOB = 'https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/'
  const broken = []

  for (const file of ['README.md', 'README.en.md']) {
    const text = read(file)

    // 相对引用：去重后逐条挑出「非图片、且第一段是仓库内会漂的目录」的那些。
    // `../` 开头的是包外相对路径，同样视为违规（包内解析不到）。
    const refs = new Set()
    for (const match of text.matchAll(/(?:\]\(|src=")(?!https?:|#|mailto:)([^)#"\s]+)/g)) refs.add(match[1])
    for (const ref of refs) {
      if (/\.(png|jpe?g|webp|svg)$/i.test(ref)) continue // 图片：仍在包内，readme-facts 管
      if (ref.startsWith('../')) broken.push(`${file}: ${ref}（包外相对路径）`)
      else if (/^(docs|src|scripts|build|tests)\//.test(ref)) {
        broken.push(`${file}: ${ref}（应写成 ${BLOB}${ref.replace(/^\.\//, '')}）`)
      }
    }

    // 绝对引用：`blob/main/` 之后的路径必须在工作树里真实存在。
    for (const match of text.matchAll(new RegExp(`${BLOB.replaceAll('/', '\\/')}([^)\\s#]+)`, 'g'))) {
      const rel = decodeURIComponent(match[1])
      if (!existsSync(new URL(rel, root))) broken.push(`${file}: ${BLOB}${rel}（指向的文件不存在）`)
    }
  }

  assert.deepEqual(
    broken,
    [],
    'README 里指向仓库内非发布文件的引用不合格。`docs/` 与 `src/` 都不在发布包里（files 白名单），'
      + '包内视角的相对链接是死链 —— 改成指向本仓库 main 分支的绝对地址，并确认路径真实存在'
      + '（readme-facts 的 relativeRefs() 会跳过绝对链接，这条是那些文档唯一的存在性看守）',
  )

  // 反向自证：两份 README 里至少各有一条指向 docs/ 的绝对链接，否则上面的循环空转成"通过"。
  for (const file of ['README.md', 'README.en.md']) {
    assert.ok(
      [...read(file).matchAll(new RegExp(`${BLOB.replaceAll('/', '\\/')}docs/`, 'g'))].length > 0,
      `${file} 里一条指向 docs/ 的绝对链接都没有：要么文档被删了要点，要么链接又退回相对地址——本条看守失去依据`,
    )
  }
})
