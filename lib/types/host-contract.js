/**
 * 宿主契约的**解析与比对** —— 一份实现，两个调用方：
 *
 * - `scripts/check-upstream.ts`（tsx，跑给人看的那道闸，联网时还能查 npm 最新发布版）；
 * - `tests/host-pending-kinds.node.test.mjs`（`npm test` 里的离线那道闸，CI 会跑）。
 *
 * ## 我们到底依赖宿主的什么
 *
 * 本仓库的 `src/client/tree.ts` 是宿主 `@deepseek-ai/dsh-client-ui-workspace` 投影的
 * **fork**（为了在分组聚合里加 facet 贡献）。那份 fork 里真正会**静默坏掉**的地方只有
 * 一处：`pendingInteraction.kind`。
 *
 * - 它是**开放集合**：`SessionPendingInteractionMap` 靠声明合并扩展，任何宿主包都能贡献
 *   自己的 kind。宿主当前的 `visiblePendingKind` 认三个（`approval` / `plan-review` /
 *   `question`），并把没认出来的 kind **悄悄丢掉**。
 * - 宿主新增一种 kind 时，**宿主侧栏与我们的徽标会一起不显示它**（两边口径一致，不是我们
 *   的错），但我们要**知道**这件事好跟上；没跟上，两边一起不显示，用户只会觉得"这俩对不上"。
 * - 反过来**不要自己多认**：宿主不画的我们画了，徽标与宿主侧栏就成了两套事实。
 *
 * 另有两个状态事实：宿主若把 `completionUnread`（「已完成」绿点）或 `pendingInteraction`
 * （「待审批」黄点）改名，我们的 fork 会**静默地**再也不画那一类状态 —— 同样不报错。
 *
 * @module dsh-group-status/host-contract
 */
/** 我们从宿主读的两个状态事实：它们改名了，这份 fork 就会静默失效。 */
export const HOST_STATUS_FACTS = ['completionUnread', 'pendingInteraction'];
/**
 * 宿主实现里那个函数的形状（我们这份 fork 是照它抄的，所以两边可比）。
 *
 * **两代产物形状都要命中**（0.2.2-rc.2 的类型面真验挖出来的第一处形态漂移）：
 *
 * - rc.1 的 `lib/client.js` 是多行带缩进的：
 *   `function visiblePendingKind(kind) {\n\tswitch (kind) {\n\t\tcase "approval":\n…\n\t\tdefault: return;\n\t}\n}`
 * - rc.2 的产物压成单行、零空白：`function visiblePendingKind(kind){switch(kind){…default:return}}`
 *
 * 所以闭合用 `}\s*}` 非贪婪：switch 的收尾 `}` 后面紧跟函数自己的 `}`，两代都成立。
 * **别改回 `([\s\S]*?)\n\s*}`** —— 那个「必须换行」正是 rc.2 单行产物整条不匹配、
 * `tests/host-pending-kinds.node.test.mjs` 三例真红的原因（台账：docs/upgrading.md
 * 「0.2.2-rc.2 的逐符号核对」表里"发布产物形态"那一行）。
 *
 * 已知边界：非贪婪停在哪一处 `}\s*}`，就吃进多深的嵌套。宿主若把某个 `case` 写成块体
 * （`case "a": { … }`）并在 default **之后**还排 kind，截到的函数体会缺后半段 —— 少读到的
 * kind 让集合比对**变红**（不是静默绿），照样有人来看。
 */
const VISIBLE_PENDING_KIND = /function visiblePendingKind\s*\([^)]*\)\s*\{\s*switch\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\}/;
/**
 * 函数体里 kind 的写法：三种引号字面量都认。
 *
 * 宿主产物在两代里换过字面量样式 —— rc.1 是 `case "approval":`（双引号 + 缩进），
 * rc.2 压单行后是 `` case`approval`: ``（反引号、`case` 与字面量之间零空白）。单引号是
 * minifier 的另一个常见选择，一并认下来；`` ` ``在字符类里是普通字符，不需要转义。
 * 引号字符本身进 group 1（靠 `\1` 保证左右配对），kind 文本进 group 2。
 */
const PENDING_KIND_CASE = /case\s*(["'`])([^"'`]+)\1/g;
/**
 * default 分支里的「带值 return」—— 也就是没认出来的 kind 被**露出来**了。
 *
 * 这一条是上面整套读法的前提：我们把 case 标签的集合当成宿主可见的 kind 集合，只在没认出来
 * 的 kind 被 default **丢掉**时才成立。两代产物里"丢弃"的写法都不匹配这条（rc.1 是
 * `default: return;`，rc.2 压单行后是 `default:return` 顶到函数收尾，`break;` 也算丢弃，
 * `return undefined` / `return null` 显式让位）；改成 `default: return kind;` 就匹配 ——
 * 那时"case 表 == 可见集合"失效，逐符号比对会给出一个半真的"一致"，必须响。
 *
 * 只在 default **自己那一段**里判：解析处把下一个 `case` 之后剪掉，否则
 * `switch (kind) { default: return; case "a": return kind; }` 这种 default 排在前面的写法
 * 会把 case 分支的 `return kind` 误读成漏值。
 */
const PENDING_KIND_DEFAULT_LEAKS = /return\s+(?!undefined\b|null\b)[^;}\s]/;
/**
 * 解析失败时给人看的线索：那个函数名还在不在。名字还在却形状对不上，与整个名字消失，
 * 是两种完全不同的上游改动，读日志的人该一眼分清。
 * @param source - 宿主 bundle 文本。
 */
function visiblePendingKindHint(source) {
    if (!source.includes('visiblePendingKind')) {
        return '源码里连 `visiblePendingKind` 这个名字都没有了（被改名或删掉了）';
    }
    // 名字「还在」也可能只是别的前缀把它包住了（`pickVisiblePendingKind`），照样要说清。
    return '`visiblePendingKind` 这个名字还在，但它不再是 `function visiblePendingKind(…) { switch (…) { … } }` 这个形状';
}
/**
 * 从宿主实现（发布产物 `lib/client.js` 的文本）里抠出 `visiblePendingKind` 认的 kind。
 *
 * 四种"抠不出来"都必须**响**，而且要说清是哪一条模式破的 —— 默默返回空集合是最坏的结果：
 * 空集合让"集合相等"要么永远成立（守卫假绿），要么退化成一条"我们多认了 kind"的误导性漂移。
 * 所以四种情形分开处理，每种都把**具体模式**写进消息：
 *
 * 1. `VISIBLE_PENDING_KIND` 整个不匹配（函数没了、改了名，或改成三元/映射表 —— 两代的产物
 *    形状，多行带缩进与压单行零空白，现在都命中，落在这条的就只剩"真换了形状"）；
 * 2. `switch` 匹配上了、函数体却没抠出来（只有正则被改坏才会发生，保留它也为类型收窄）；
 * 3. 函数体里有 `case`，但没有一处是引号字面量（双引号 / 单引号 / 反引号都认 —— 剩下常量引用、
 *    映射表这些写法）；
 * 4. `default` 分支不再丢弃没认出来的 kind（`default: return kind;`）：整套"读 case 表"的口径
 *    当场失效，逐符号比对会给出半真的"一致"，所以同样要响。
 *
 * 反过来，**一个 `case` 都没有**的 `switch`（只有 `default:`）是合法状态 —— 那是宿主真的
 * 不认任何 kind，返回空集合，交给 `compareHostContract` 按"我们多认了"去报漂移。
 *
 * 这些错误只抛给 CI 面（`scripts/check-upstream.ts` 的 try/catch → 退出码 2，
 * `tests/host-pending-kinds.node.test.mjs` → 用例失败）；`apply()` 的运行路径不碰这个模块。
 * @param source - 宿主 bundle 文本。
 * @throws 解析不了时抛错，消息里点名破掉的模式与该怎么办。
 */
export function parseHostPendingKinds(source) {
    const found = VISIBLE_PENDING_KIND.exec(source);
    if (!found) {
        throw new Error('宿主契约解析失败：VISIBLE_PENDING_KIND 不匹配 —— ' + visiblePendingKindHint(source) + '。\n'
            + `  不匹配的正则：${VISIBLE_PENDING_KIND.source}\n`
            + '  该做什么：按宿主的新形状改 src/host-contract.ts 的这个正则，并同步 src/client/tree.ts 那份 fork。');
    }
    const body = found[1];
    if (body === undefined) {
        // `[\s\S]*?` 非贪婪且可空，正常情况下一定参与匹配；这个分支只为 noUncheckedIndexedAccess
        // 收窄类型。真走到这里说明正则本身被改动过，照旧按解析失败处理。
        throw new Error('宿主契约解析失败：`visiblePendingKind` 的 `switch` 匹配上了，函数体却没抠出来。\n'
            + `  不匹配的正则：${VISIBLE_PENDING_KIND.source}\n`
            + '  该做什么：改 src/host-contract.ts 的这个正则，并同步 src/client/tree.ts 那份 fork。');
    }
    // 先把 `case` 的**出现次数**数出来：它是"解析坏了"与"宿主真的零 kind"的唯一区分依据。
    const caseKeywords = body.match(/\bcase\b/g)?.length ?? 0;
    const kinds = [];
    for (const match of body.matchAll(PENDING_KIND_CASE)) {
        // group 1 是引号本身（`\1` 负责配对），group 2 才是 kind 文本。
        if (match[2] !== undefined)
            kinds.push(match[2]);
    }
    if (kinds.length === 0 && caseKeywords > 0) {
        throw new Error(`宿主契约解析失败：\`visiblePendingKind\` 的 switch 里有 ${caseKeywords} 处 \`case\`，`
            + '却没有一处是引号字面量（双引号 / 单引号 / 反引号三种都认）—— 上游改了 case 的写法'
            + '（常量引用、映射表都算）。\n'
            + `  不匹配的正则：${PENDING_KIND_CASE.source}\n`
            + '  该做什么：改 src/host-contract.ts 里抠 kind 的那条正则，别把空集合当成"宿主零 kind"。');
    }
    // 读 case 表的前提：default 把没认出来的 kind 丢掉。只截 default 自己那一段（下一个
    // `case` 之前）—— default 排在最前面的写法里，case 分支的 `return kind` 不是漏值。
    const defaultClause = /default\s*:/.exec(body);
    if (defaultClause !== null) {
        const afterDefault = body.slice(defaultClause.index + defaultClause[0].length);
        const nextCase = /\bcase\b/.exec(afterDefault);
        const defaultSegment = nextCase === null ? afterDefault : afterDefault.slice(0, nextCase.index);
        if (PENDING_KIND_DEFAULT_LEAKS.test(defaultSegment)) {
            throw new Error('宿主契约解析失败：`visiblePendingKind` 的 default 分支不再丢弃没认出来的 kind'
                + '（出现了带值的 return）—— "case 表就是宿主可见集合"这条口径当场失效。\n'
                + `  不匹配的正则：${PENDING_KIND_DEFAULT_LEAKS.source}\n`
                + '  该做什么：读宿主的新形状，改 src/host-contract.ts 里判 kind 的整套读法，'
                + '并同步 src/client/tree.ts 那份 fork 的丢弃语义。');
        }
    }
    return kinds;
}
/**
 * 读一份宿主 bundle，抽出契约点。
 * @param source - 宿主 bundle 文本。
 */
export function readHostContract(source) {
    const kinds = parseHostPendingKinds(source);
    const facts = Object.fromEntries(HOST_STATUS_FACTS.map(fact => [fact, source.includes(fact)]));
    return { kinds, facts };
}
/**
 * 比对我们认的 kind 与宿主认的 kind，以及宿主是否还带着我们要读的事实。
 * @param ours - 本插件认的 kind。
 * @param host - 宿主契约。
 */
export function compareHostContract(ours, host) {
    const drifts = [];
    const missing = host.kinds.filter(kind => !ours.includes(kind));
    const extra = ours.filter(kind => !host.kinds.includes(kind));
    if (missing.length > 0 || extra.length > 0) {
        drifts.push({
            kind: 'kind-set',
            detail: `宿主认 [${host.kinds.join(', ')}]，我们认 [${ours.join(', ')}]`
                + (missing.length > 0 ? `；宿主多了：${missing.join(', ')}` : '')
                + (extra.length > 0 ? `；我们多认了：${extra.join(', ')}` : ''),
        });
    }
    for (const fact of HOST_STATUS_FACTS) {
        if (!host.facts[fact]) {
            drifts.push({ kind: 'fact-missing', detail: `宿主实现里找不到 \`${fact}\`（它改名或改了形状）` });
        }
    }
    return drifts;
}
//# sourceMappingURL=host-contract.js.map