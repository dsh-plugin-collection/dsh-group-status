# 上游升级手册（rebase runbook）

本仓库是 `@deepseek-ai/dsh-client-ui-workspace` 的 **fork 覆盖包**：同一个侧栏槽位再注册一份，并把官方那一行 disable。
上游一换代，本包就得手工 rebase 一次。这份手册写清楚基线从哪来、本地改了哪几处、下一代怎么合、怎么验证。

> 目标读者：维护者。使用与安装请看 [README](../README.md)。

## 基线从哪来

- **基线版本**：`@deepseek-ai/dsh-client-ui-workspace 0.2.1-rc.2`（DSH `dsh-v0.2.1-rc.2` 的发布产物与类型契约）。
- **来源**：`src/` 与 `tests/` 原从上游 `0.2.0-rc.2` 源码树拷入。`0.2.1-rc.2` 一代的发布包只带 `lib/`，本次同步以官方 `.d.ts`、`lib/client.js`、官方 README 为对照基线，并按本地 `src/` 结构逐项移植。
- **不要再 diff `lib/`**：`lib/client.js` 是 tsdown 产物（`window.__ModuleLoader__.load({ id: 'dsh-group-status', factory })` 闭包工厂），不是可 diff 的官方复制品；npm 上发布的上游包同样只带构建产物。**rebase 对象永远是 `src/`。**
- **构建链**：`build/tools/` 是上游 tsdown 客户端预设拉平后的自包含副本（自解析 manifest、扁平导入、不扫 monorepo 路径）；`tsconfig.json` 是独立客户端配置，去掉了 monorepo base 与 project references。
- **宿主契约有守卫**：`src/client/tree.ts` 是宿主 workspace 投影的 fork，其中 `pendingInteraction.kind` 与两个状态事实（`completionUnread` / `pendingInteraction`）是**会静默失效**的契约点 —— 宿主改了它们的形状，我们照样编译通过、测试照样全绿，只是徽标从此少画一类状态。`tests/host-pending-kinds.node.test.mjs` 直接读**锁定版本**宿主的实现来比对，宿主一改就红；人看的版本是 `pnpm check-upstream`（见 rebase 步骤第 0 步）。
- **产物要提交**：`lib/` 随仓库提交，`dsh plugin --profile web add "github:dsh-plugin-collection/dsh-group-status"` 直接吃它。**改完 `src/` 必须 `pnpm build` 并一并提交 `lib/`**，否则从 GitHub 安装的人拿不到新行为。
- **产物不是逐字节可复现的**：`lib/client.js` 里 CSS Modules 的类名哈希（如 `.eCE9Ta_…`）与 `//#region` 注释路径都跟**构建时的绝对路径**有关。同一份 `src/` 在不同 checkout（比如 issue worktree）里构建，`lib/` 会有几十行「只有哈希和路径不同」的 diff——那是噪声，不是功能差异。所以：**谁改 `src/` 谁重建并提交**，review 时不要把这种 diff 当行为变更。
- **`tsc` 的增量缓存会静默漏产物**（2026-10-16 踩过）：`tsconfig.json` 开了 `incremental` + `composite`，缓存写在 `lib/tsconfig.tsbuildinfo`（已被 `.gitignore` 忽略，不入库）。但**本地那份会陈旧**：`tsc` 认为源文件没变就跳过输出，产物于是停在旧版本，而它**退出码仍是 0、一行错误都不报**。这次是 `lib/types/index.js`（`tsdown.config.ts` 的打包入口）比 `src/index.ts` 少 6 个配置项，`lib/index.js` 里的 `Config` 只剩 1 个字段，**设置界面因此只画得出 1 个开关**。彻底修复要**全量**重建，只删 `lib/types` 不够：

  ```bash
  rm -rf lib/types lib/tsconfig.tsbuildinfo && pnpm build
  ```

  `tests/artifacts.node.test.mjs` 已锁住这条（产物存在性 + `Config` 字段对齐），改完 `src/` 跑 `pnpm test` 就能拦住。

## 本地改动清单（rebase 时逐条重新施加）

| # | 文件 / 符号 | 改了什么 |
|---|---|---|
| 1 | `src/client/tree.ts` — `GroupNode.liveStatus`（**可选字段**）+ `GroupLiveStatus` 类型 re-export | 只留类型面：`liveStatus?` 供渲染层读取，`GroupLiveStatus` 从 `group-status.ts` 转出给 `Rows.tsx` 用。**计算不在此文件**（见 #21、#22） |
| 2 | `src/client/rows/GroupBadge.tsx`（画）+ `src/client/badge-labels.ts`（说） | **本仓库新增文件**（上游没有）：前者在折叠且有活时画徽标（点 + 图标 + 数字，`role="img"` + `aria-label`），后者是纯函数文案面（`groupLiveLabel` / `hoverStatusLines` / `waitingReviewLabel` / `facetPulseClass`）。文案拆开的唯一理由：GroupBadge 引入宿主图标集，其 `require` 图只在 DSH 应用内解析（见 `vitest.config.ts` 排除理由 (b)），留在原地等于跨插件状态永远测不到。`Rows.tsx` 只剩 import 与两个调用点 |
| 3 | `src/client/rows/Rows.tsx` — `WorkspaceHoverContent` 的 `status` prop | 折叠时在 hover 卡里追加聚合明细行 |
| 4 | `src/client/rows/Rows.module.css` — `.groupBadge*` / `.groupLive*` | 徽标与数字的样式 |
| 5 | `src/client/rows/WorkspaceBrowser.tsx` — `require('dsh-later/client')` / `require('dsh-gitea-dispatch/client')` | 可选消费跨插件摘要 hook，容忍未安装（`try/catch` 后保持 `undefined`）。gitea-dispatch 那份还一并取它的分组聚合 `summarizeWaitingGroup()`：取到就委托它折叠组内等待，取不到（旧版提供方）才用 `group-status.ts` 的等价实现 |
| 6 | `src/client/cross-plugin-summary.ts` | **本仓库新增文件**（上游没有）：provider 侧摘要骨架，导出 `createSummaryStore` / `createSummaryRegistry` / `defaultCanPoll` / `entryFor` / `mapEquals` / `normalizeSessionId` / `summarizeGroup` |
| 7 | `src/client/locales.ts` | 复用上游文案键；新增 `status.waitingReview`、等待评审的三档状态 `status.waitingReviewOverdue` / `status.waitingReviewImminent` / `status.waitingReviewLeft`、`status.scheduled` 与设置卡片的 `settings.*` 文案（中 / 英，两侧键集由 `satisfies Record<WorkspaceKey, string>` 强制对齐） |
| 8 | `package.json` | `dsh.client.external: ["dsh-later", "dsh-gitea-dispatch"]`；`icon` 字段；`test` / `test:node` / `test:spec` / `test:watch` 脚本与测试用 devDependencies；`@deepseek-ai/schemastery` 依赖（宿主侧 `Config` 用） |
| 9 | `vitest.config.ts`、`tests/support/`、`tests/group-status.client.spec.ts` | **本仓库新增**：让上游 spec 在独立仓库可跑（见下节），加一份属于本包的折叠聚合 spec |
| 10 | `tests/cross-plugin-summary.node.test.mjs` | **本仓库新增**：模板模块的 12 条 `node --test` 用例（import 编译产物 `lib/types/client/cross-plugin-summary.js`，所以 `test:node` 先跑 `types`） |
| 11 | `src/index.ts` — `name` / `Config` / `apply()` | **本仓库新增**：上游宿主侧是空 `apply()`；这里加 `Config`（schemastery `.volatile()`，5 个字段：3 个按状态显隐 + 悬停明细 + 数字样式）供宿主投影成设置页。这是宿主侧唯一的面，不承载行为。⚠️ **只允许出现本插件自己的语义**：曾有 `showScheduledInBadge` / `showWaitingReviewInBadge` 两个替别人家写死的字段，已删除（外部来源的显隐归来源自己，见 `docs/facet-protocol.md`「显隐归谁」） |
| 12 | `src/client/badge-settings.ts` | **本仓库新增文件**（上游没有）：设置面快照 → 标准 props 源的适配、派生与引用稳定记忆 |
| 13 | `src/client/index.ts` — `ConfigFormsLike` / `createBadgeSettingsSource()` / `ctx.inject(['configForms'], …)` / `GlobalStandardProps.useBadgeSettings` | 挂一个**恒在**的 `useBadgeSettings` 标准 props 源，再非阻塞地等 `configForms` 就绪并推入快照。寻址键是**条目 id**（`dsh-group-status`），不是 settings namespace；同一块里再用 `forms.whileServed([ENTRY_ID], …)` 把下面的配置卡片注册进 `plugins.bundle.config` |
| 14 | `src/client/rows/Rows.tsx` — `ProjectRowItem.settings` / `groupLiveBadge(group, t, settings)` | 按设置决定各来源是否画点/图标、是否计入数字、是否参与「显示徽标」判断 |
| 15 | `src/client/rows/WorkspaceBrowser.tsx` — `SessionTreeProps` 增 `useBadgeSettings`、`ProjectRowItem` 增 `settings` | 把设置 hook 从浏览器根透传到折叠行（完整 `ResolvedBadgeSettings` 对象，不再是单个布尔） |
| 16 | `tests/badge-settings.client.spec.ts` | **本仓库新增**：解析与源契约用例（显式 false 才隐藏、引用稳定、无关变更不通知、设置面收回回落默认） |
| 17 | `src/client/badge-field.ts` | **本仓库新增**：卡片字段的官方规格（`SettingsFieldSpec`：`format` 缺失值读成默认、`parse` 只收 `'true'`/`'false'`，其余草稿判非法挡住保存）。纯逻辑、无 React 依赖，单独可测。⚠️ `ALL_BADGE_FIELDS` 的**顺序就是徽标画点顺序**（单一事实来源），新增档位请按 `rows/GroupBadge.tsx` 的顺序插入 |
| 18 | `src/client/BadgeSettingsCard.tsx` + `BadgeSettingsCard.module.css` | **本仓库新增**：插件详情页（插件 → dsh-group-status）的配置卡片。**为什么必需**：宿主只把 `Config` 投影成 `configForms` 表音，页面要插件自己注册卡片才画得出来——没有它 README「设置项」描述的 UI 不存在。外观与交互**不自造**：框架用官方 `SettingsForm`、草稿与保存用官方 `SettingsFormModel`、开关用官方 `Switch`（与「设置 → 内置插件 → 子智能体」同一套）；CSS 只写 section/heading 与开关行，取值逐条照抄 `ui-settings-subagent` 的 `SubagentCard.module.css` / `SubagentModelSelectionFields.module.css` |
| 19 | `src/client/plugin-manager-slot.d.ts` | **本仓库新增**：`plugins.bundle.config` 的本地 `SlotMap` 声明（按包名寻址）。手写而非 `import type` 插件管理器：该包不进 devDependencies；若哪天进了，删掉本文件 |
| 20 | `tests/badge-settings-card.client.spec.tsx` | **本仓库新增**：字段规格用真实现测；卡片接线用契约等价桩（官方 `SettingsForm` / `SettingsFormModel` / `Switch`）测——那个包的 bundle 依赖宿主应用预载的整棵依赖闭包，独立仓库跑不起来（见 `vitest.config.ts` 头部） |
| 21 | `src/client/group-status.ts` | **本仓库新增文件**（上游没有）：徽标数字的全部计算——`GroupLiveStatus` / `EMPTY_LIVE_STATUS` / `mergeLiveStatus` / `summarizeGroupStatus`，加上多层聚合三件套 `directStatusesForGroups` → `aggregateGroupStatuses` → `withAggregatedStatus`，与渲染契约类型 `StatusedGroupNode`（`liveStatus` 必填）。纯函数、无 React 依赖，所以整条管线可脱离渲染测 |
| 22 | `src/client/rows/WorkspaceBrowser.tsx` — 聚合管线三个 memo | `childrenByParentForAggregation`（父→子树）→ `directStatusesForGroups`（每组直接成员）→ `withAggregatedStatus`（上卷成子树合计），渲染行类型为 `StatusedGroupNode`。**两条铁律**：① 展开的分组同样必须被测量——「不画徽标」是 `groupLiveBadge` 的渲染决定，把 `expanded` 短路成 `EMPTY_LIVE_STATUS` 会让每个折叠父级按展开后代的规模少算（曾以此形态发布）；② 上游 `deriveGroups` 已不再算 `liveStatus`，若上游重新加回，本行与 #23 一起撤 |
| 23 | `src/client/tree.ts` — `deriveGroups()` 契约变更 | 三处：不再接收 `waitingReviewSummary` / `scheduleSummary` 入参；不再给 `liveStatus` 赋值（留空由 #22 填）；**`sessions` 恒为全量成员**，折叠时不再置空。第三条最危险——渲染层必须自己按 `expanded` 决定画不画会话行与溢出按钮，漏一处就是「折叠的工作区里会话还在列」 |
| 24 | `src/client/rows/WorkspaceBrowser.tsx` — `AnimatedRows` 的 `resetKey` | 上游用独立的 `watermarkMotionKey` 区分“水位线变化”和“视图替换”；本包同步该机制，折叠与展开都能保留淡出 |
| 25 | `src/client/index.ts`、`navigation.ts`、`shortcuts.ts`、`Rows.tsx`、`contract/toast.ts`、`toast/` | 同步 `0.2.1-rc.2` 上游能力：Workspace access keyed hook、Session ID 菜单、草稿与 Agent preset、Fork 迁移提示、会话水位线、共享 `workspace.toast` 架构、HoverCard group 与 Tooltip portal；徽标聚合、facet 协议和设置卡片仍按本仓库原有规则运行 |

`cordis.patch.yml` 只有两条：`insert` 本包、`ui-workspace` `disabled: true`。升级不动它。

## rebase 步骤

0. **先看契约有没有漂移**：`pnpm check-upstream --latest` —— 它比对我们认的待处理 kind
   集合与宿主实现是否一致，以及宿主是否还带着 `completionUnread` / `pendingInteraction`
   这两个状态事实。**这是唯一能自动发现"宿主换了代"的地方**：这两个契约点一旦变了，我们的
   fork 会**静默**地再也不画某一类状态（不报错、不红测试），只有这道检查会说话。
   > 老版本这里有个 `check-upstream` 脚本，比的是"vendored 上游源码目录"与 npm 最新版的
   > 哈希。它**从来没有工作过**：本地那份 pristine 副本在 `src/vendor/`（早就不存在了，
   > vendored 的上游源码直接摊在 `src/` 下），而上游发布包里**没有 `src/`**（只有 `lib/`），
   > 于是脚本一跑就 `ENOENT: scandir 'src/vendor/src'`。文档却还让人照着它 rebase —— 一条
   > 指着不存在目录的命令比没有更糟：它让人以为"没红就是没漂移"。现在它比的是**契约点**，
   > 离线可跑、且同一份实现也进了 `npm test`（`tests/host-pending-kinds.node.test.mjs`）。
1. **取新基线源码**：优先从新一代 DSH 源码树取 `@deepseek-ai/dsh-client-ui-workspace` 的 `src/` 与 `tests/`。发布包不含 `src/` 时，用 `lib/types/**/*.d.ts`、`lib/client.js` 与包内 README 对照移植；不要只看类型就认定行为一致。
2. **先看上游动了什么**：把新基线的 `src/` 与本地 `src/` 逐个 diff，重点看第 1–5、7 条改动落点周围有没有结构变化，以及槽位名 / 组件签名是否变了（见下节）。
3. **覆盖再施加**：用新基线覆盖 `src/`、`tests/`，然后按上表逐条把本地改动重新施加（不要直接 `git merge` 整棵源码树之外的东西）。
4. **补跨插件接入**：第 5、6、10 条属于本仓库新增能力，覆盖后要确认两个 hook 的接入点还在、`src/client/cross-plugin-summary.ts` 未被删、模板用例仍全绿。
5. **类型检查**：`npx tsc --noEmit -p tsconfig.json` 必须干净（上游严格选项不变）。
6. **构建**：`pnpm build`（= `pnpm types` + `tsdown`）→ 产出 `lib/index.js`、`lib/client.js`、`lib/types/`。
7. **跑测试**：`pnpm test` 必须全绿；看到跳过的 spec 数变了要回头核对下节。
8. **重装重启**：
   ```sh
   dsh plugin --profile web remove dsh-group-status
   dsh plugin --profile web add "link:$PWD"    # 或 github: 装法
   # 重启 dsh web
   ```
9. **验证**（见下节），然后提交：commit 信息写清新基线版本，`lib/` 一起提交；tag 带基线，如 `v0.2.1-rc.2-fork1`。

## 测试基线

`pnpm test` = `test:node`（`npm run types && node --test`，50 用例）→ `test:spec`（`vitest run`，jsdom，14 个文件 / 191 用例）。README 里的这两个数字由 `tests/readme-facts.node.test.mjs` 对齐实跑值看守。下表列出与 `navigation.ts`、聚合与设置相关的文件（部分动态生成的循环用例不计入静态表）：

| 文件 | 来源 | 覆盖 |
|---|---|---|
| `tests/artifacts.node.test.mjs` | **本仓库** | 构建产物存在性、`Config` 字段对齐、DSH `0.2.1-rc.2` 依赖基线（4 用例，`node --test`）|
| `tests/host-pending-kinds.node.test.mjs` | **本仓库** | **宿主契约守卫**：我们认的待处理 kind 必须与锁定版宿主实现一致；宿主认的状态事实（`completionUnread` / `pendingInteraction`）不能消失；外加一条"守卫自己不是摆设"的反例（3 用例，`node --test`）|
| `tests/cross-plugin-summary.node.test.mjs` | **本仓库** | provider 侧模板：store 订阅、迟到登记自愈、分组折叠、id 归一、帧等值（12 用例，`node --test`）|
| `tests/facets.node.test.mjs` | **本仓库** | facet 协议：校验、来源决胜、注销、排序、重入合并、缺省合并与非法色档护栏（11 用例，`node --test`）|
| `tests/tree.client.spec.ts` | 上游 | 分组派生、排序、会话行与搜索 |
| `tests/browser-styles.client.spec.ts` | 上游 | 侧栏样式契约（直接读 CSS 文件） |
| `tests/animated-rows.client.spec.tsx` | 上游 | 行动画 |
| `tests/session-watermarks.client.spec.ts` | **本仓库** | `0.2.1-rc.2` 会话水位线：空白行、基线、活动行抬升、自动上限、搜索揭示与 stored marks 身份稳定 |
| `tests/badge-settings.client.spec.ts` | **本仓库** | 设置源、默认值回落与引用稳定 |
| `tests/badge-labels.client.spec.ts` | **本仓库** | 徽标文案、明细顺序、来源图标与脉冲规则 |
| `tests/badge-settings-card.client.spec.tsx` | **本仓库** | 设置字段规格与插件详情页卡片接线 |
| `tests/navigation-draft-blank.client.spec.ts` | **本仓库** | Issues #43 前瞻适配：空白复用的 preset 感知（无 preset 请求跳过列 preset 的空白、命名 preset 命中同值或无 preset 空白、全部不匹配时新建），以及 `startSession` 草稿意图判定（`whenDraftExists` 单独出现也初始化草稿、`prompt`/`clearPreviousDraft: true` 照旧、`clearPreviousDraft: false` 与仅 `agentPreset` 不碰草稿）。纯对象 stub 驱动真实 `UiWorkspaceService`，运行期只依赖 `cordis`（8 用例）|
| `tests/group-status.client.spec.ts` | **本仓库** | 折叠聚合：计数、待处理类互斥、子智能体、空白/归档跳过、定时任务与等待评审聚合、未安装时降级；**多层聚合**（展开的中间层必须计入折叠祖先、任意深度、父子环不死循环）；聚合路径全折叠 / 全展开两侧的 perf 护栏。注意 `groupOf()` 走的是真实管线，**不要**再在测试里手工赋 `liveStatus`——那样测试只能证明副本自己 |

**9 个上游 spec 被显式跳过**（`vitest.config.ts` 顶部的 `MONOREPO_ONLY_SPECS`），因为它们在独立仓库里无解：

- `rows` / `workspace-browser` / `workspace-picker`：`@deepseek-ai/dsh-client-test-runtime` 深导入 `dsh-client-ui-renderer`、`dsh-api-session-controller` 的**源码**（`…/src/client/bind.ts`、`scoped-slots.tsx`、`scope.ts`）。这些包不发布 `src/`（`0.2.1-alpha` 也没有），产物里也没有导出 `bindSnapshotSelector` / `createSlotRenderer`。
- `apply` / `shortcuts` / `workspaces-service` / `session-actions` / `host-home-staleness` / `rename-assembly`：从已发布的 `…/client` 产物里取**运行期值**（`SlotRegistry`、`LocaleRuntime`、`LayoutController`、各种 `*Error`）。这些产物是闭包工厂，`require` 图假定宿主已预载外部依赖——例如 `dsh-client-ui-primitives` 自己**一个依赖都不声明**，却 require 了 shiki / katex / micromark 全家桶。要在本地跑就得把 DSH 应用整棵依赖树装成插件 devDependencies。

> 底线：不要给这两类写假实现让它们变绿——那测的是假实现。上游哪天开始发布 `src/` 或宿主无关的测试运行时，删掉对应条目即可。

`vitest.config.ts` 还负责四件让上游 spec 保持原样的接线：把 `@deepseek-ai/dsh-client-ui-workspace/client` 指到本仓库 `src/client/index.ts`；把 `@deepseek-ai/dsh-client-locale/src/locales/{en,zh}.ts` 指到 `tests/support/common-locale.ts`（该包只发布类型，没有运行期字典）；把 `../../shortcuts/src/client/registry.ts` 指到 `@deepseek-ai/dsh-client-shortcuts/client`；给测试模块真实的 `file:` URL（有一个 spec 用 `new URL(..., import.meta.url)` 读文件）。`tests/support/setup.ts` 每个用例前清 `localStorage`——viewing store 会从 `dsh.workspace.view.v5` 水合，不清就会串上一条用例的排序状态。

依赖说明：`vitest` / `jsdom` / `@testing-library/react` 是测试运行的直接依赖；`zustand` 与 `immer` 是给 `@deepseek-ai/dsh-client-store` 补的——该包**没有声明**这两个依赖，它假定宿主提供（版本对齐宿主：`zustand@5.0.10`、`immer@10.2.0`）。

## 核对清单：上游换代时最容易踩的两类东西

**槽位名是否改名**（本包注册 / 消费的）：

- `sidebar.workspaces`
- `sidebar.workspaces.session.menu.item`
- `sidebar.workspaces.session.row.action`
- `sidebar.session.row.leading` / `sidebar.session.row.hover`
- `conversation.hero.workspace`
- `shell.overlay`
- `workspace.toast`（`shell.overlay` 的 row-toast 注册项声明）
- `workspace.toast.content`（全局共享 Factory）
- `plugins.bundle.config`

**组件签名是否变化**（本包改过的两处所在）：

- `ProjectRowItem`：`group, containsCurrentDescendant, onToggle, onCreate, actions, drag, home, newShortcut, t`
- `WorkspaceHoverContent`：`label, cwd, createdAt, status, t`

**跨插件接口是否搬家**：

- **facet 协议是本包对外的契约**（[`docs/facet-protocol.md`](facet-protocol.md)）。改它的任何必填成员或语义都要升 `GROUP_STATUS_FACET_PROTOCOL_VERSION` 并在文档变更记录里写迁移；provider 侧只认 `require('dsh-group-status/client')` 的运行时符号，类型抄结构声明，不 import 本包。
- 聚合与渲染**按协议工作，不按来源分支**：新状态源接入不应改动 `group-status.ts` / `badge-labels.ts` / `rows/GroupBadge.tsx`。上游换代若要求这三处重新施加，检查点是没有把来源名写回去。
- 本插件**不代管任何来源**：不要为了「方便」重新引入 `legacy/` 式适配器，两家现有接入方各自注册（见 [`facet-protocol.md`](facet-protocol.md) 的迁移史一节)。
- provider 侧模板的导出面（`createSummaryStore` / `createSummaryRegistry` / `summarizeGroup` / `mapEquals` / `entryFor` / `normalizeSessionId` / `defaultCanPoll`）——它被别的插件**复制**走，改名会静默影响它们的调用点；设计说明与「复制、不要 import」的实测依据写在 [`src/client/cross-plugin-summary.ts`](../src/client/cross-plugin-summary.ts) 文件头

## 兼容声明为什么长这样（12 条 peer 不是元数据）

README 只给结论（声明 `>=0.2.1-rc.2 <0.3.0-0`，另有 12 条 peer），机制记在这里。

peer 里那 12 条**不是元数据**：≤0.2.0 的内核不读 `engines.dsh`，只按 `@deepseek-ai/dsh*` peer 的范围判兼容。不逐条声明时，0.2.0 会把本包判成「兼容」并装进去 —— 而那一代没有 `@deepseek-ai/dsh-api-remote-access`，客户端 `inject` 的 `remoteAccess` 永远拿不到，fiber 永久 pending，`uiWorkspace` 不再被提供，`ui-sidebar` / `ui-conversation` / `ui-chat` 等 12 条一起不激活，**整页 "Failed to load plugins"，用户失去整个侧栏**。声明之后，0.2.0-rc.2 实测是内核直接 `skipping profile bundle`，宿主不受损；而 0.2.1 起 `engines.dsh` 命中即返回、peer 不参与判定，窗口内代次不受影响。

**这条链上有两个静默点**，所以换代时两处都要人看着：

- 漏写一条 peer 不会立刻报错，只会在**旧内核**上炸，而旧内核根本不在 CI 矩阵里；
- `engines.dsh` 与 peer 下界必须同一条线（`tests/artifacts.node.test.mjs` 锁住），只改一边等于声明面失效。

**预发布版匹配不上 caret 范围，这是 semver 规则而不是破口**（Issues #43 §3，2026-11-02 复核）：12 条
peer 的 `^0.2.1-rc.2` 按预发布规则**不匹配** `0.2.2-alpha.x`（预发布只对同 `[major,minor,patch]` 元组的
范围可见），但 `0.2.2` **正式版**落在 `>=0.2.1-rc.2 <0.3.0` 里，会自动纳入。所以 alpha 线提前验证时才需要
临时把范围写成 `^0.2.1-rc.2 || ^0.2.2-alpha.2`，**这类临时改动不入仓**：`tests/artifacts.node.test.mjs`
锁的就是 peer == `^` + `engines.dsh` 下界这一条不变式，commit 半个 `||` 范围会让声明面与守卫互相说谎，
而"支持 0.2.2-alpha.x"在实测通过之前也不该被写进任何兼容声明（未判定不是绿）。

## 上游代次跟踪（2026-10-27 实测）

本包声明 `engines.dsh: >=0.2.1-rc.2 <0.3.0-0`，peer 侧另有 12 条 `@deepseek-ai/dsh-*`（`^0.2.1-rc.2`，
用于让不读 `engines.dsh` 的旧内核拒绝装载）。

**已验代次**：`0.2.1-rc.2`（= 当时 npm `latest`，也是本包声明的下界）、`0.2.1-rc.3`、`0.2.1-rc.4`。
三代的门禁（本运行时 + 0.2.1+ 语义双判）、冷启动装配、`dsh.client.inject` 12 个包可解析、
`tsc`（**对着该代次真实的 `.d.ts`**，不是对着基线猜）、`vitest 183` + `node 41` 全部通过。
rc.2 上另做了真 GUI 功能验收：分组行 / 会话行 / 视图菜单 / 扁平列表 / 搜索命中与无匹配 /
折叠徽标（「1 进行中 · 1 已完成」两枚点并存）/ 悬停明细两行。证据（JSON 明细 + real-gui 截图）
在 workspace 的 `devkit/results/dsh-group-status-cross-kernel-2026-10-27.json` 与
`devkit/results/screens/`，不在本仓库内。

**契约面没变**：rc.4 的 `dsh-client-ui-workspace/lib/client.js` 相比 rc.2 有 15 行差异
（231 078 → 231 234 字节），但 `visiblePendingKind` 认的 kind 仍是 `approval` / `plan-review` /
`question`，`completionUnread` 与 `pendingInteraction` 两个事实也都还在 ——
所以 `src/host-contract.ts` 那道守卫在 rc.4 上是绿的，**不需要跟着改**。

**但行为面漂了，漂的正是本仓库 fork 的那块**。rc.4 在 `UiWorkspaceService` 上改了三处，
`src/client/navigation.ts` 是它的 fork，此前仍是 rc.2 写法（2026-10-27 登记；2026-11-02 按 Issues #43
对 `0.2.2-alpha.2` 复核后更新下表）：

| rc.4 的改动 | `navigation.ts` 现状（2026-11-02） |
|---|---|
| 删掉 `connectBlank` 里的 `if (reuse === undefined) return this.sessions.create({ workspaceId })` 早退 | 未跟：`connectWorkspace` 恒传 `{}`，该早退不可达，无行为差 |
| 空白会话复用改为 **preset 感知**（比较 `summary.projectionValues?.agentPreset`） | **已对齐**（Issues #43）：`createInWorkspace` 挑选复用候选时跳过列出其它 preset 的空白；无 preset 的空白对任何请求仍可复用。`0.2.2-alpha.2` 的定稿措辞与此一致 |
| 草稿初始化 `clearPreviousDraft: boolean` → `whenDraftExists: 'replace' \| 'keep'`（旧字段降级为别名；`0.2.2-alpha.2` 定稿为三态 `replace \| append \| keep`） | **已对齐**（Issues #43）：`StartSessionOptions` 前瞻声明三态并原样透传给 `requestDraftInitialization`（旧宿主忽略、新宿主生效）；`initializeDraft` 判定同时识别 `prompt` / `clearPreviousDraft: true` / `whenDraftExists`，两字段语义分叉后导航层不再漏判 |

这件事**不会**自动修好：`cordis.patch.yml` 把官方 `ui-workspace` 行 `disabled: true`，`uiWorkspace`
由本插件自己提供 —— 所以在 rc.4 上跑的时候，**rc.4 的这三处改进根本到不了用户**，用户拿到的是 fork 里
那份 rc.2 行为。**能跑 ≠ 行为一致**，这是"全绿"之外必须单独记一笔的差别。

**本仓库的约定**：容器服务（`navigation.ts`）以**基线代次**为准，不逐 rc 跟。此前的理由：这块没有任何本地
用例覆盖（`tests/workspaces-service.client.spec.ts` 在 `MONOREPO_ONLY_SPECS` 里，从未在 CI 跑过），
改 inflight 复用与草稿保留语义无法证明没坏，而收益只是三处细节 UX。该前提在 Issues #43 后**已经不成立**：
新增的 `tests/navigation-draft-blank.client.spec.ts` 用纯对象 stub 驱动真实 `UiWorkspaceService`
（运行期只依赖 `cordis`，本仓库可跑），preset 感知复用与草稿意图判定两侧共 8 用例看守。此后逐 rc 跟改
按这份形状补用例即可；但**前瞻适配不等于基线迁移**，升基线仍按下面的触发清单与迁移步骤走。

**什么时候必须动**（任一触发即升基线，别拖）：

1. npm 的 `latest` 移到基线之后的代次 —— 用户会自动装上，漂移立刻变成用户可见行为；
2. `devkit/matrix.mjs` 的 `gate` 或 `boot` 在某个代次变红；
3. `tests/host-pending-kinds.node.test.mjs` 变红（kind 集合或两个事实名漂移）；
4. `tsc` 对着新代次的 `.d.ts` 变红。

**升基线的清单**（漏一项 CI 就红，2026-10-27 实测踩过）：

- 26 个 `@deepseek-ai/dsh-*` devDependencies 一起改（`tests/artifacts.node.test.mjs` 逐个断言）；
- `peerDependencies` 里那 12 条的范围必须等于新的 `engines.dsh` 下界（同文件另一条用例锁住）；
- `tests/artifacts.node.test.mjs` 里那条**硬编码**的 `'0.2.1-rc.2'`；
- 本文件「基线从哪来」「本地改动清单」两节里的版本号；
- 重新 `pnpm install` 并重建 `lib/`（产物随源码提交）。

## 验证

1. 找一个有进行中 / 待审批会话的分组 → 收起 → 文件夹名后出现徽标；
2. 悬停文件夹行 → 明细行出现，文案与徽标 `aria-label` 一致；
3. 展开分组 → 徽标消失，子行自带状态；
4. 组内有定时任务 / 等待评审时，徽标各多一枚图标，且明细与 `aria-label` 带上 `#PR` 与剩余时长；等待窗口到期后 `aria-label` 换成该来源的超窗文案（当前是「已超窗，仍在等待」），**徽标不闪动**（`pulse: false` 由来源声明，与 dsh-gitea-dispatch 那条会话行的静止图标同一口径）。⚠️ **别在这里核对形状与颜色**：图标由来源自己的 `renderIcon` 交出，形状还跟随该插件自己的风格档位（dsh-gitea-dispatch 的 `waitingIconStyle` 三档），本插件无权决定，写死成"时钟/沙漏"的清单会指着一个不存在的形状验收；
5. 临时卸掉 dsh-later / dsh-gitea-dispatch → 图标消失但**不报错**、不空转；本插件的设置卡片上**不应出现**任何提供方名字或它的图标名（回归用例：`tests/badge-settings-card.client.spec.tsx`）；
6. 提供方不导出 `summarizeWaitingGroup()`（旧版）时，徽标走本仓库的等价折叠，数字/色档/文案与新版一致（`tests/group-status.client.spec.ts` 锁住）；
7. **设置项**：侧栏 **插件** → dsh-group-status（bundle 详情页，描述与「包含的组件」之间）→ 卡片分 3 个 section（折叠徽标 **3** 个开关，顺序与徽标画点一致：待审批 → 进行中 → 已完成 / 悬停明细 1 个开关 / 数字显示 1 个数字）→ 关掉某个开关 → 保存 → 对应档位的点从徽标与悬停明细中消失、数字相应减少；再打开 → 回来。**外部来源在这一页没有开关**（显隐归来源自己：不注册就是不显示）。改完**无需刷新**；刷新页面后设置仍在（宿主把它写进 profile patch 的 `dsh-group-status` 条目 `config`）。表单外观应与「插件 → 官方 → 子智能体」同款：section 标题 13px/600、开关行 label 左 + switch 右、说明 12px 次级灰度、保存按钮在内容列左缘（官方 `SettingsForm` 的定位）；
8. **设置面缺失时**（把 `Config` 临时去掉再构建）→ 插件照常加载，徽标按默认「显示已完成」；console 无 `cannot get property … without inject` 一类报错；
9. 浏览器 console 无本插件错误；
10. 中 / 英界面语言切换后文案跟随。
11. 会话行的 `...` 菜单末尾有「复制 Session ID」；点击后菜单关闭，成功与失败各出现一次全局提示，且不会打开会话或加载历史。
12. 组内第 6 条之后的会话进入水位线规则：运行中、子智能体运行中、等待用户、未读完成、当前打开或搜索揭示的会话自动抬高水位线；折叠父组或列表卸载时水位线回落，不写入持久化 store。
13. 无权限 Peer 不显示 fork 菜单项；有权限但源会话需要迁移时，菜单提示提供「打开原会话」，只导航、不自动重试 fork。快捷键失败通过共享 `workspace.toast` 显示，不再由 `WorkspaceBrowser` 自己挂旧 Toast。

## 回滚

```sh
dsh plugin --profile web remove dsh-group-status
# 两条补丁一起撤，官方行自动回来；重启 dsh web 生效
```

## 已知限制

- 本包 vendored 上游源码，不是公共 API 消费方：上游重构时 rebase 成本可能不止「重新施加 25 条」。
- 设置卡片依赖宿主的 `configForms.whileServed`（0.1.7 settings rewrite 一代，`0.2.1-rc.2` 仍在）。更早一代拿不到它时只跳过插件页卡片，折叠徽标读取设置面与其余功能不受影响。
- 聚合计数与展开态共用同一份派生，超大分组（数百会话）每次状态变更多一次全量 traverse，与展开渲染同量级。
- 定时任务按「组内有」计 1，不按任务条数累计，也不占 hover 明细行。
