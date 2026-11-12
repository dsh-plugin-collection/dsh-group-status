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
export declare const HOST_STATUS_FACTS: readonly ["completionUnread", "pendingInteraction"];
/** 一处契约漂移。 */
export interface ContractDrift {
    readonly kind: 'kind-set' | 'fact-missing';
    readonly detail: string;
}
/** 从宿主实现里读出来的契约。 */
export interface HostContract {
    /** 宿主认的待处理 kind 集合。 */
    readonly kinds: readonly string[];
    /** 宿主 bundle 里是否还找得到那两个状态事实。 */
    readonly facts: Readonly<Record<(typeof HOST_STATUS_FACTS)[number], boolean>>;
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
export declare function parseHostPendingKinds(source: string): string[];
/**
 * 读一份宿主 bundle，抽出契约点。
 * @param source - 宿主 bundle 文本。
 */
export declare function readHostContract(source: string): HostContract;
/**
 * 比对我们认的 kind 与宿主认的 kind，以及宿主是否还带着我们要读的事实。
 * @param ours - 本插件认的 kind。
 * @param host - 宿主契约。
 */
export declare function compareHostContract(ours: readonly string[], host: HostContract): ContractDrift[];
//# sourceMappingURL=host-contract.d.ts.map