/**
 * 守卫：本插件认的**待处理 kind 集合**，必须与锁定版本的宿主实现**完全一致**。
 *
 * ## 为什么需要这道守卫
 *
 * 官方的会话状态不是一个固定枚举，而是三个正交事实（`SessionStatus`）：
 * `running` / `pendingInteraction` / `completionUnread`。宿主自己的 workspace 投影把
 * 它们映成 `running` / `pendingInteraction` / `completed` 三个字段，而本仓库的
 * `src/client/tree.ts` 是那份投影的 **fork**（为了在分组聚合里加 facet 贡献）。
 *
 * `pendingInteraction.kind` 是**开放集合**：`SessionPendingInteractionMap` 靠声明合并
 * 扩展，任何宿主包都能贡献自己的 kind。宿主当前的 `visiblePendingKind` 认三个
 * （`approval` / `plan-review` / `question`），**并且同样把没认出来的 kind 悄悄丢掉**。
 *
 * 于是"宿主新增一种 kind"这件事有两面：
 *
 * - **我们不该自己多认几种**：宿主侧栏不画的，我们画了，徽标与宿主侧栏就成了两套事实。
 *   口径必须跟随宿主。
 * - **我们必须知道宿主改了**：否则宿主的侧栏多画了一个我们没画的点，而我们的徽标少算
 *   一个 —— 两边**都不报错**，只有用户会觉得"这俩对不上"。而这个仓库里
 *   `scripts/check-upstream.ts`（本该守这条）**已经坏了**：它比对的 `src/vendor/src`
 *   目录早就不存在了（vendored 的宿主源码直接摊在 `src/` 下，pristine 副本已删），
 *   宿主包发布版里也没有 `src/`（只有 `lib/`），所以那个脚本一跑就
 *   `ENOENT: scandir 'src/vendor/src'`。文档却还让人照着它 rebase。
 *
 * 这条用例把那条守卫生效：直接读**锁定版本**（`devDependencies` 里与其它宿主包同版本的
 * `@deepseek-ai/dsh-client-ui-workspace`）的**实现**，把它的 kind 集合与我们的比。
 * 宿主加 kind → 我们这边变红 → 照着提示改 `PENDING_INTERACTION_KINDS`。
 *
 * 另外两条断言守的是"我们从宿主读的那两个事实"还在不在：宿主若把
 * `completionUnread` / `pendingInteraction` 改名，我们的 fork 会**静默**地再也不画
 * 「已完成」绿点、再也不认任何待处理 —— 同样不报错，只能靠这道守卫发现。
 *
 * ## 为什么这里还要"两代产物形状"的样本
 *
 * 解析器读的是宿主**发布产物的文本**，而产物的文本形状会随代次换：`0.2.2-rc.1` 的
 * `lib/client.js` 里那段函数是多行带缩进、字面量用双引号；`0.2.2-rc.2` 把它压成单行零空白、
 * 字面量换成反引号（**语义没变**，kind 还是那三个）。只按其中一种形状写解析，换代那天就会
 * "解析不了" —— 这正是 rc.2 类型面真验挖出来的第二处真漂移（台账：`docs/upgrading.md`
 * 「0.2.2-rc.2 的逐符号核对」里"发布产物形态"那一行）。
 *
 * 所以下面除了对着**锁定版 bundle** 跑，还内嵌两代产物里那段函数的**原文最小样本**，要求几代
 * 形状都解析出**同一个 kind 集合**；所有反例（函数名消失、增/删 kind、case 改成常量引用、
 * default 不再丢弃）在每种形状上各跑一遍 —— 任何一种形状下安静放行都是这道守卫的失败。
 * 样本是**抄进来的字符串**，不去读 `/tmp` 下的临时对照包：这道闸必须离线自洽。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)

const { PENDING_INTERACTION_KINDS } = await import('../lib/types/client/tree.js')
const { compareHostContract, parseHostPendingKinds, readHostContract } = await import('../lib/types/host-contract.js')

/** 宿主包（devDependency，版本与仓库其它宿主包一致）的 client bundle。 */
const hostBundle = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-workspace/client'), 'utf8')

/** 宿主认的三个 kind —— 每种产物形状与锁定版 bundle 都必须解析出这一份，顺序也要一致。 */
const HOST_KINDS = ['approval', 'plan-review', 'question']

/**
 * `0.2.2-rc.1` 产物里那一段的**原文**（多行 + 缩进 + 双引号字面量）：`visiblePendingKind`
 * 本体 + 紧随其后的两个函数。整段照抄自 `dsh-client-ui-workspace@0.2.2-rc.1` 的
 * `lib/client.js`，带后面那两个函数有两个理由：
 *
 * 1. 证明函数体在 `}\n}` 处收住、没往 bundle 后面吃（`runningChildCount` 里那对
 *    `((( … )))` 嵌套就是拿来试这条边界的）；
 * 2. 真 bundle 里调用点（`sessionNode` 那行）是**跟着名字一起存在**的 —— 少了它，
 *    "函数被改名"那条反例会从「名字还在、形状不对」塌成「名字没了」，两条判据就分不开了。
 */
const HOST_FN_RC1 = 'function visiblePendingKind(kind) {\n'
  + '\t\t\tswitch (kind) {\n'
  + '\t\t\t\tcase "approval":\n'
  + '\t\t\t\tcase "plan-review":\n'
  + '\t\t\t\tcase "question": return kind;\n'
  + '\t\t\t\tdefault: return;\n'
  + '\t\t\t}\n'
  + '\t\t}\n'
  + '\t\tfunction runningChildCount(list, parentId, statuses) {\n'
  + '\t\t\treturn list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count, child)'
  + ' => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0;\n'
  + '\t\t}\n'
  + '\t\tfunction sessionNode(s, list, statuses, pinned, archived) {\n'
  + '\t\t\tconst status = statuses.get(s.id);\n'
  + '\t\t\tconst pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);\n'

/**
 * `0.2.2-rc.2` 产物里**同一段**的原文（压单行、零空白、反引号字面量）—— 也是整段照抄：
 * 两个代次的语义一模一样，只有文本形状不同，这正是这道守卫要"两代通吃"的那件事。
 */
const HOST_FN_RC2 = 'function visiblePendingKind(kind){switch(kind){case`approval`:case`plan-review`:'
  + 'case`question`:return kind;default:return}}'
  + 'function runningChildCount(list,parentId,statuses){return list.projectionsBySession[parentId]'
  + '?.values.subagentCatalog?.reduce((count,child)=>count+((statuses.get(child.id)?.running'
  + '??list.byId[child.id]?.running)===true?1:0),0)??0}'
  + 'function sessionNode(s,list,statuses,pinned,archived){const status=statuses.get(s.id);'
  + 'const pendingInteraction=visiblePendingKind(status?.pendingInteraction?.kind);'

/** 单引号是 minifier 的另一种常见选择：case 的三种引号写法都得认。 */
const HOST_FN_SINGLE_QUOTED = HOST_FN_RC1
  .replace('case "approval":', 'case \'approval\':')
  .replace('case "plan-review":', 'case \'plan-review\':')
  .replace('case "question":', 'case \'question\':')

/** 要各跑一遍的产物形状：label + 文本。反例在每种形状上都必须给出同一个判据。 */
const SHAPES = [
  ['rc.1 多行 + 双引号', HOST_FN_RC1],
  ['rc.2 单行 + 反引号', HOST_FN_RC2],
  ['多行 + 单引号', HOST_FN_SINGLE_QUOTED],
]

/**
 * 认 kind 的锚点（供反例改造用）：`case` 与字面量之间可能零空白（rc.2 压行），引号两代换过，
 * 所以三种形状的反例都走同一条。group 1 = 引号本身，group 2 = kind 文本。
 * @param {string} kind 单个 kind，或 `a|b|c` 这样的选择支。
 */
const caseAnchor = (kind) => new RegExp(`case\\s*(["'\`])(${kind})\\1\\s*:`, 'g')

test('我们认的待处理 kind 与锁定版宿主完全一致', () => {
  const host = readHostContract(hostBundle)
  const ours = [...PENDING_INTERACTION_KINDS]

  assert.deepEqual(
    [...ours].sort(),
    [...host.kinds].sort(),
    `宿主认的 kind 集合是 [${host.kinds.join(', ')}]，我们认的是 [${ours.join(', ')}]。\n`
    + '宿主新增/删除 kind 时：把新的加进 src/client/tree.ts 的 PENDING_INTERACTION_KINDS，'
    + '并同步徽标的「待审批」聚合（badge-labels.ts 的 pending 分支）。\n'
    + '⚠️ 只在**宿主也认**的前提下才加：我们多认会让徽标与宿主侧栏变成两套事实。',
  )
})

test('我们从宿主读的那两个事实还在（改名会让 fork 静默失效）', () => {
  // completionUnread → 「已完成」绿点；pendingInteraction → 「待审批」黄点。
  for (const fact of ['completionUnread', 'pendingInteraction']) {
    assert.ok(
      hostBundle.includes(fact),
      `宿主 client.js 里找不到 \`${fact}\` —— 上游改了状态事实的名字或形状，`
      + 'src/client/tree.ts 这份 fork 要跟着改，否则徽标会静默少画一类状态。',
    )
  }
})

test('每种真产物形状都解析出同一个 kind 集合（rc.1 多行双引号 / rc.2 单行反引号）', () => {
  // 这一条守的是"换代只换文本形状、语义没变"这一整类假红：解析器只该认语义。
  // 顺序也一起比：case 表的顺序就是宿主自己的写法，解析不该打乱它。
  for (const [label, shape] of SHAPES) {
    assert.deepEqual(
      parseHostPendingKinds(shape),
      HOST_KINDS,
      `${label}：这份产物形状解析出的 kind 与宿主语义不一致`,
    )
  }
  assert.deepEqual(
    [...parseHostPendingKinds(hostBundle)].sort(),
    [...HOST_KINDS].sort(),
    '锁定版 bundle 与样本的 kind 集合不一致 —— 基线换了，先核对语义再改这份期望',
  )
})

test('解析不了必须**响**：与「宿主真的零 kind」不是一回事', () => {
  // 为什么单列这一条：`parseHostPendingKinds` 一旦默默返回空集合，上面那条「集合必须相等」
  // 的断言会退化成两种假象 —— 要么永远绿（空集也「相等」），要么报出一条「我们多认了 kind」
  // 的误导性漂移。所以每种「抠不出来」各自抛错，且消息点名破掉的是哪条模式。
  // 这几种错只落在 CI 面：`apply()` 的运行路径不 import 这个模块。

  // 1) 函数名整个没了（上游改名或删掉）—— 与产物形状无关，一条就够。
  assert.throws(
    () => readHostContract('export const unrelated = 1\n'),
    /VISIBLE_PENDING_KIND/,
    '宿主 bundle 里没有 visiblePendingKind 时必须抛错，不能返回空集合',
  )

  for (const [label, shape] of SHAPES) {
    // 2) 名字还在，但不再是 `function … { switch (…) {` 的形状（改名 / 三元 / 映射表）。
    const reshaped = shape.replace('function visiblePendingKind', 'function pickVisiblePendingKind')
    assert.notEqual(reshaped, shape, `${label}：这份反例没改成 —— 函数的名字/形状变了，先改守卫`)
    assert.throws(
      () => readHostContract(reshaped),
      /名字还在/,
      `${label}：形状变了也要抛错，并说清「名字还在、形状不对」—— 这才是读日志的人需要的那句话`,
    )

    // 3) switch 还在，但 case 不再是引号字面量（常量引用）—— 三种引号都认过之后，「有 case
    //    却一条都读不出」就只剩这一种写法；它仍然必须抛错，而不是交回一个空集合。
    const constantized = shape.replace(caseAnchor('approval|plan-review|question'), 'case KIND_$2:')
    assert.notEqual(constantized, shape, `${label}：这份反例没改成 —— case 的写法变了，先改守卫`)
    assert.throws(
      () => readHostContract(constantized),
      /3 处 `case`[\s\S]*引号字面量/,
      `${label}：有 case 却一条都认不出来时必须抛错，不能伪装成「宿主零 kind」`,
    )

    // 4) 整套读法的前提：default 把没认出来的 kind 丢掉。改成往外漏值（`default: return kind`），
    //    「case 表 == 宿主可见集合」当场不成立，逐符号比对会给出一个半真的「一致」—— 必须响。
    const leaking = shape.replace(/default\s*:\s*return\b/, 'default: return kind')
    assert.notEqual(leaking, shape, `${label}：这份反例没改成 —— default 的写法变了，先改守卫`)
    assert.throws(
      () => readHostContract(leaking),
      /default 分支不再丢弃/,
      `${label}：default 不再丢弃未知 kind 时也要抛错`,
    )

    // 5) 反面：switch 里一个 `case` 都没有（只有 default:）是**合法**状态 —— 宿主真的不认
    //    任何 kind。这里必须不抛错、返回空集合，由 compareHostContract 按「我们多认了」报漂移。
    const zeroKinds = label.startsWith('rc.2')
      ? 'function visiblePendingKind(kind){switch(kind){default:return}}'
      : 'function visiblePendingKind(kind) {\n\tswitch (kind) {\n\t\tdefault: return;\n\t}\n}\n'
    assert.deepEqual(
      readHostContract(zeroKinds).kinds,
      [],
      `${label}：零 case 的 switch 是合法的零 kind 宿主，不该被当成解析失败`,
    )
  }
})

test('守卫不是摆设：宿主增 / 删一种 kind 时，这个比较必须失配', () => {
  // 拿每种产物形状各做一份"改造过的副本"当反例：宿主若真的动了 kind，比较必须红。
  // 没有这一条，上面那条断言可能因为解析写错而**永远绿**（空集合也会"相等"的假象）。
  for (const [label, shape] of SHAPES) {
    // 增：在 approval 后面并排多塞一个 kind（用同一种引号，别的什么都不动）。
    const added = shape.replace(caseAnchor('approval'), 'case $1approval$1:case $1brand-new-kind$1:')
    assert.notEqual(added, shape, `${label}：这份反例没改成 —— case 的写法变了，先改守卫`)
    const addedHost = readHostContract(added)
    assert.ok(addedHost.kinds.includes('brand-new-kind'), `${label}：解析器应当把新 kind 读出来`)
    assert.ok(
      compareHostContract([...PENDING_INTERACTION_KINDS], addedHost).some(drift => drift.kind === 'kind-set'),
      `${label}：宿主多了一种 kind，我们却没认 —— 比较必须红`,
    )

    // 删：把 question 那条 case 整条抹掉（宿主删 kind 的镜像反例，同样不能悄悄绿）。
    const removed = shape.replace(caseAnchor('question'), '')
    assert.notEqual(removed, shape, `${label}：这份反例没改成 —— case 的写法变了，先改守卫`)
    const removedHost = readHostContract(removed)
    assert.ok(!removedHost.kinds.includes('question'), `${label}：删掉的那条 kind 不该还被读出来`)
    assert.ok(
      compareHostContract([...PENDING_INTERACTION_KINDS], removedHost).some(drift => drift.kind === 'kind-set'),
      `${label}：宿主少了一种 kind，我们却还在认 —— 比较必须红`,
    )
  }
})

test('锁定版 bundle 上的反例同样必须失配（样本与真产物不能脱节）', () => {
  // 上面几条用的是内嵌样本；这一条把同样的改造打在**真 bundle** 上，防的是"样本改得动、
  // 真产物改不动"（bundle 里同一段 case 字面量出现多处，锚点选错就什么都没改，而这条反例
  // 会静默变成一条没有改造过的副本）。
  const doctored = hostBundle.replace(
    caseAnchor('approval'),
    'case $1approval$1:case $1brand-new-kind$1:',
  )
  assert.notEqual(doctored, hostBundle, '这份反例没改成 —— 宿主的 bundle 形状变了，先改守卫')

  const host = readHostContract(doctored)
  assert.ok(host.kinds.includes('brand-new-kind'), '解析器应当把新 kind 读出来')

  const drifts = compareHostContract([...PENDING_INTERACTION_KINDS], host)
  assert.ok(
    drifts.some(drift => drift.kind === 'kind-set'),
    '宿主多了一种 kind，我们却没认 —— 上面那条断言应该红，这条是它的反例',
  )
})
