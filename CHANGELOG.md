# 更新日志

本文件记录面向使用者的重要变更。细粒度提交历史见 git log。

文中 `Issues #NN` 指向本项目内部 Gitea 跟踪器上的条目（该跟踪器不对外，故不附链接）。

## 未发布

- **docs** 中英两份 README 按「装 → 认徽标 → 配 → 出问题查什么」重排：安装回到使用之前，新增
  「徽标不出现时」排错表（没重启、内核在窗口外、四档计数全为 0、低于 `countThreshold`、搭档
  插件未注册），并补上此前只写在代码注释里的两条用户可见事实：计数超过 99 显示 `99+`、外部
  来源之间的次序由各方的 `order` 决定。本机 `link:` 安装从用户路径移进「开发」。
  同时修掉与实现不符的陈述：设置项是 5 个（曾写「7 个」）、外部来源在本页没有专用开关
  （同篇另一处曾说「两个来源各有一个专用设置项」）、Node 与 spec 用例数按实跑值、跳过的上游
  spec 是 9 个（曾写 7）、`status.waitingReview` / `status.scheduled` 等 5 个文案键已随
  `legacy/` 删除不再列为本包新增、`rc.4` 的用例通过不等于行为一致（差异见升级手册）。
- **docs** 一处事实一个家：facet 契约细节归 [`docs/facet-protocol.md`](docs/facet-protocol.md)，
  README 只留方向、最小注册示例与指针；12 条 peer 的因果链归 [`docs/upgrading.md`](docs/upgrading.md)
  新增的「兼容声明为什么长这样」一节，README 兼容性段只给结论。
- **test** 新增 [`tests/readme-facts.node.test.mjs`](tests/readme-facts.node.test.mjs)（8 例）：
  README 的版本徽章 == `package.json` 的 `version`；设置表的字段与默认值 == `src/index.ts` 的
  `Config`；用例数 == 实跑数量（Node 侧静态计数再用 `node --test` 交叉验证，Vitest 侧读 JSON
  reporter）；用户文档不含工单号、已删除的实现名与内网地址；相对引用存在且图片落在 `files`
  白名单内；`extract-notes.mjs` 依赖的特性小节仍在。
- **chore** `package.json`：`description` 不再把「定时任务」「等待评审」列成本插件的档位
  （它们是提供方注册的状态源，本包不含对应字段）；`files` 白名单补 `docs`，此前发布 tarball 里
  没有截图与两份文档，README 的图片在包内视角是断链。

- **docs** 徽标读法表加「图标」列：三枚 SVG（待审批黄点、进行中转圈、已完成绿点）按
  `StateDot` 的几何复刻（实心点是 10px 槽位里的 6px 圆，转圈是 14px 的环 + 约 72° 的弧、
  轨道 25% 不透明度），颜色取自仓库自带实机截图的像素（`#F59E0B` / `#9AA0A5` / `#22C55E`），
  与截图同为暗色主题。产物由 [`scripts/make-badge-glyphs.mjs`](scripts/make-badge-glyphs.mjs)
  生成，形状与取色的出处写在脚本头注释里。「叫法」列保留黄点/转圈/绿点这些说法，图标不做
  唯一信息源（纯文本视图与读屏都还要能读）。外部来源的图标不复刻：形状归提供方，本包不替别家存资产。
- **test** `tests/readme-facts.node.test.mjs` 加一条：README 用到的三枚 SVG 必须能由脚本逐字节
  复现（比对后无论是否一致都把工作区还原，`npm test` 不留改动）。手改 SVG 会让图标与组件脱钩，
  这条把它挡在提交前。Node 用例数 49 → 50。

## 0.5.1 — 2026-10-27

- **refactor** 会话列表面板拆成四个组件文件：`rows/WorkspaceBrowser.tsx` 从 1562 行降到 685 行，
  树体、扁平列表、搜索结果、视图选项菜单、空态占位各自独立（`SessionTree.tsx` / `ListView.tsx` /
  `ViewOptionsMenu.tsx` / `EmptySessions.tsx`），三类共享件（搜索 wire 常量、拖拽状态机、树体的 prop
  契约）收进 `browser-shared.ts`。三个列表体本来就是**互斥渲染**的分支，拆开后仍互不 import；成环由
  `browser-shared.ts` 单向下指挡掉。行为不变：切分是逐段搬移，没有改写判定、排序或动画时序。

- **perf** 空闲分组不再产生新的状态对象：`summarizeGroupStatus` 对「六项全零且没有来源贡献」的组
  交回冻结的 `EMPTY_LIVE_STATUS`，`mergeLiveStatus` 把「加一份零」实现为**原样返回入参**。多层折叠
  里每层都会把子树重滚一遍，此前每滚一次都为每个空闲组造一份等值新对象；下游按引用判等的选择器于是
  每轮重渲染，而它读到的数字一个没变。合并仍不修改任何入参。

- **perf** `watermarkRows` 在第一个被截断的行处提前退出（空行必然排在组首，由 `tree.ts` 的
  `sectionMembers` 保证，这条例外前提写进了它的 JSDoc）；`raiseWatermarks` 整趟只拷贝一次对象，
  不再为每个抬升的分组各展开一次；`WorkspaceBrowser` 与三个列表体共用的「主视图保留了哪个会话」
  扫描改为按 list 身份记忆，不再每轮渲染各 `Object.values()` 一次（`browser-shared.ts` 的
  `mainViewSessionId`）。

- **fix** `derive()` 用模块私有 Symbol 代替 `undefined` 表示「尚未投影」：投影**合法地**可能返回
  `undefined`（"此刻没有待处理请求"就是一次正常的空结果），旧写法让每次 `getSnapshot()` 都重跑投影；
  投影若新建 `Set`/数组，消费者每次读都拿到新引用，选择器永不收敛 —— 正是这个投影器要避免的事。

- **a11y** 徽标设置卡片的数字增减按钮不再硬编码中文 `aria-label`（`settings.count.decrease` /
  `settings.count.increase` 进 zh/en 两份字典）；搜索结果区补 `aria-busy`，并给「无匹配」与
  「仅显示前 N 条」加上 `role="status"`，屏幕阅读器能从"正在搜索"读到终止结果。徽标自身的
  `aria-label` 与 `title` 经复核同源、且逐项覆盖可见状态点与数字，无需改动。

- **test** 补上此前**从未在本仓库跑过**的契约：`tests/apply-smoke.client.spec.ts`（宿主半边
  `apply()` 不读 `ctx`、banner 仍报得出产物与进程）、`tests/facet-lifecycle.client.spec.tsx`
  （登记面 → 消费存储 → React 的迟到登记 / 快照推送 / 同 id 热替换 / 注销 / dispose）、
  `tests/derive.client.spec.ts`（投影身份稳定，含"返回 `undefined` 也只算一次"）与
  `tests/locale-keys.client.spec.ts`（中英字典键必须同集合）。`group-status` 那条「空闲组是全零」
  改为同时断言**引用**就是哨兵；`cross-plugin-summary` 补了「store 迟到注册后 hook 自愈」。
  每条新用例都做过反向验证：改坏被保护的行为即失败，改回即通过。

- **fix** 把客户端运行时依赖**逐条写进 `peerDependencies`**（12 个 `@deepseek-ai/dsh-*`，
  范围 `^0.2.1-rc.2` = `engines.dsh` 下界），闭合"声明说不支持、内核照样装"的洞。
  **为什么必须这么做**：≤0.2.0 的内核**不读 `engines.dsh`**，只按 `dsh-*` peer 的范围判兼容
  （0.2.1 起反过来——`engines.dsh` 单独决定，peer 不参与判定）。此前 peer 里只有
  `@deepseek-ai/cordis`，于是 0.2.0 把本插件判成"兼容"并装载；而那一代没发布
  `@deepseek-ai/dsh-api-remote-access`，客户端 `inject` 的 `remoteAccess` 永远拿不到 →
  fiber 永久 pending → `uiWorkspace` 不再被提供 → **`ui-sidebar` / `ui-conversation` /
  `ui-chat` 等 12 条一起不激活，整页 "Failed to load plugins"，用户失去整个侧栏**。
  现在 0.2.0-rc.2 实测：内核打印 `skipping profile bundle "dsh-group-status": … peerDependencies {...}`，
  插件不装载，**控制台 0 错误、宿主自带侧栏照常工作**；而 0.2.1-rc.2 / rc.3 / rc.4 三代
  `engines.dsh` 命中即返回，peer 不参与判定，仍全部判过、真 GUI 里分区正常渲染。
  新增用例 `tests/artifacts.node.test.mjs`「每个客户端注入包都声明为 peer，且范围等于
  `engines.dsh` 的下界」把这条不变量钉住（反向验证：把任一 peer 改成 `*` 即红）。

- **docs** 跨代次验证记录（2026-10-27，`devkit/results/dsh-group-status-cross-kernel-2026-10-27.json`
  与 `devkit/results/screens/`）：0.2.1-rc.2 上 gate / peer / tsc / test / 冷启动装配全绿，
  真 GUI 里分组行、会话行、View options 菜单、扁平列表、搜索命中与无匹配态均正常，
  搜索区的 `aria-busy` 与 `role="status"` 在真机可见。**0.2.0-rc.2 实测会把整个侧栏拖下去**：
  该代次没发布 `@deepseek-ai/dsh-api-remote-access`，客户端 `inject` 的 `remoteAccess` 拿不到
  → fiber 永久 pending → `uiWorkspace` 不再被提供 → 侧栏 / 对话 / chat 共 12 条一起不激活，
  页面直接 "Failed to load plugins"。所以 `engines.dsh >=0.2.1-rc.2` 是**硬下界**，不是保守估计；
  0.1.7/0.2.0 的内核也不读 `engines.dsh`（只卡 `dsh-*` peer，而本包的 `dsh-*` peer 只有
  `@deepseek-ai/cordis`），因此这两代上它**能被装进去**——装进去就会坏，别手工降级。
  折叠分组的活状态徽标这一轮**未判定**：隔离实例里宿主没有上报会话活状态，新/旧构建 A/B 均为空，
  故不能算通过（对照记录见 `devkit/results/screens/README.md`）。

- **chore** 构建与守卫：CI 新增 `lib/client.js` 的 gzip 体积预算（当前 77,312 字节 / 上限 84,000，
  `release-invariants` job，纯 shell）；`parseHostPendingKinds` 解析不到时改为抛出**点名是哪一条正则
  破了**的错误，不再静默返回空集合 —— 空集合会让"集合相等"永远成立，或退化成一条误导性的
  "我们多认了 kind"漂移；`build/tools/experimental-package-policy.ts` 删掉本仓库结构上不可能走到的
  分支（没有 `packages/experimental/` 树，十个保留名在 264 个已装包里一个都不出现）；产物可复现性
  检查排除被 `.gitignore` 的增量缓存 `tsconfig.tsbuildinfo`（它记的是上次构建动过哪些文件，与被比较的
  编译输出无关）。


## 0.5.0 — 2026-10-22

- **fix** 宿主契约漂移**从此有人看着了**：`pendingInteraction.kind` 是开放集合
  （`SessionPendingInteractionMap` 靠声明合并扩展，任何宿主包都能贡献自己的 kind），而本仓库的
  `src/client/tree.ts` 是宿主 workspace 投影的 fork。宿主新增一种 kind 时本插件**不会**自动跟上，
  于是宿主侧栏与折叠徽标会**一起不显示**它 —— 两边口径一致所以不是"谁错了"，但用户只会觉得
  "这俩对不上"。而"宿主换了代"本来该由 `scripts/check-upstream.ts` 提醒，**那个脚本从来没有工作过**：
  它比对的 `src/vendor/src` 目录早就不存在了（vendored 的上游源码直接摊在 `src/` 下），上游发布包里
  也没有 `src/`（只有 `lib/`），于是它一跑就 `ENOENT: scandir 'src/vendor/src'`；而 `docs/upgrading.md`
  还让人照着它 rebase —— 一条指着不存在目录的命令比没有更糟：它让人以为"没红就是没漂移"。
  现在：同一份比对实现（`src/host-contract.ts`）被两处调用 —— `npm test` 里的
  `tests/host-pending-kinds.node.test.mjs`（离线，读锁定版宿主的实现，CI 会跑）与
  `pnpm check-upstream`（人看的；`--latest` 还能查 npm 上**已发布的最高版**，注意该包的 `latest`
  标签是旧的、还指着 0.0.1-rc.1，不能直接用 `npm view <pkg> version`）。守卫覆盖三件事：我们认的
  kind 集合必须与宿主一致、宿主不能把我们要读的两个状态事实改名、以及"守卫自己不是摆设"（拿真实
  bundle 的改造副本当反例）。另加类型层一道：`Rows.tsx` 的 `assertNever` 让"新增 kind 却没给行内
  表现"直接编译不过。

- **breaking** 删除设置项 `showScheduledInBadge` 与 `showWaitingReviewInBadge`：**外部来源的显隐不再由本插件管**。
  这两个字段把别人家的域名（定时任务 / 等待评审）、来源名（dsh-later / dsh-gitea-dispatch）连图标形状
  （"时钟" / "沙漏"）全都写死在**消费方**的 `Config`、设置卡片与文案里，与本插件「不认识任何具体来源」的
  立身之本直接矛盾 —— facet 协议把适配方向翻正了，配置面却没跟着翻。而且它**已经是错的**：dsh-gitea-dispatch
  自其 #60 起让徽标跟随自己的 `waitingIconStyle`，三档里两档不是沙漏，卡片却仍在承诺"沙漏"；对方没装时，
  那句"关闭后不再画"更是空话。
  现在的规则只有一条：**登记即显示，不注册即不显示**。要给用户一个"关掉它"的开关，请加在**你自己的**
  配置卡片里。协议成员 `settingKey` 同时废弃（v1 仍接受、不报错，但本插件不再读取）。
  **升级影响**：profile 里残留的这两个旧值不再被读取，等同回到默认「显示」（默认全开，最坏情况是某个来源
  重新出现，不会留下坏数据）。曾考虑的另一种收口（消费方保留 `disabledFacets: string[]` + 卡片遍历登记面）
  只是把来源名从文案换成 id，机制仍长在消费方身上，故未采用；取舍过程写进 `docs/facet-protocol.md`。
- **refactor** 徽标设置卡片的开关顺序改为**与徽标画点一致**（待审批 → 进行中 → 已完成）。此前是
  进行中 → 待审批 → 已完成，而徽标与悬停明细都是待审批在前；用户的操作场景恰是"我看到徽标第 N 个图标，
  想关掉它"。同一族毛病 #25① 已在点行与明细之间修过一次，卡片是当时漏掉的第三个面。单一事实来源是
  `badge-field.ts` 的 `ALL_BADGE_FIELDS`，并由 `tests/badge-settings-card.client.spec.tsx` 钉住
  （含"卡片文案里不得出现任何提供方名字与形状词"）。
- **refactor** 删除 `facetVisibleBySettings` 与 `facet-visibility.ts`；`useVisibleFacets` 更名
  `useRegisteredFacets`（它不再筛任何东西，只负责"订阅 + 读登记面"，见下一条目为何必须收进一个 hook）。

- **fix** 提供方**晚于首渲染**注册的状态源永远进不了折叠徽标：`WorkspaceBrowser` 订阅了
  facet 存储，却把 `useSyncExternalStore` 的返回值丢掉，`useMemo` 的依赖里只有设置项——
  于是登记面变化只换来一次重渲染，渲染算的仍是**上一次**的登记面。表现是「徽标少一家、
  无任何报错、刷新页面就好了」，而刷新只是碰巧让注册赶在了首渲染之前。宿主不保证插件
  `apply` 与侧栏挂载的先后，所以这条按加载时序随机命中。修法是把订阅 + 读表 + 按设置筛
  收进 `use-visible-facets.ts` 一个 hook，让"只用信号、不用值"在结构上写不出来。这条接缝
  此前测不到（能渲染整条路径的 `tests/workspace-browser.client.spec.tsx` 在本仓库是跳过的），
  新增 `tests/use-visible-facets.client.spec.tsx` 5 例覆盖，并用变异测试验过非空洞性：把依赖
  里的版本号拿掉，「晚到的注册」与「晚到的注销」两条会红。
- **fix** 登记面从**模块级**单例改为挂在 `globalThis` 上的**进程级**共享表。宿主热替换只
  换代被替换的那个模块（`dsh-client-modules` 的 `invalidate()` 不级联到依赖方，也不重跑
  别人的 `apply`），于是本插件一旦被换成新实例就持有一张**空表**：提供方那一次性登记留在
  被丢弃的旧表上，徽标从此少一家，且只有刷新页面才好。开发环境用 `link:` 装插件、反复
  重建 `lib/`，这条几乎必然发生。现在换代只是"再拿一次同一张表"；`registerGroupStatusFacet`
  也改为**现取**当前那张表，而不是用模块加载时抄下的引用。那把全局键同时是现场诊断入口：
  `globalThis.__dshGroupStatusFacetRegistry__.list()` 一眼看出注册到底落没落，判据写进
  `docs/facet-protocol.md` 新增的「登记面的生命周期」一节。
- **test** `tests/facets.node.test.mjs` 补 3 例：共享表重复取不新建、模块级 `registry` 常量
  就是那张共享表、换代后新注册只落新表不落被丢弃的旧表。

## 0.4.0 — 2026-10-20

- **upgrade** 依赖基线从 DSH `0.2.0-rc.2` 升到 `0.2.1-rc.2`：Cordis peer 改为 `~4.0.5`，Schemastery 与全部 `@deepseek-ai/dsh-*` 开发依赖升到对应版本；客户端 `dsh.client.inject` 加入 `@deepseek-ai/dsh-api-remote-access`。`tsc`、`tsdown`、27 个 Node 用例与 165 个 Vitest 用例全绿。
- **feat** 同步上游 `dsh-client-ui-workspace 0.2.1-rc.2` 的会话行「复制 Session ID」菜单项（`order: 450`）和成功 / 失败全局提示；复制不打开会话、不 retain reference、不加载历史。
- **feat** 同步上游 Workspace 权限面：注册并对外提供 keyed hook `useWorkspaceAccess(workspaceId, action)`，注入 `remoteAccess` 服务；fork 菜单项改由 `useSessionAccess(sessionId, 'session/fork')` 决定是否出现。
- **feat** 同步上游 New Session 语义：`startSession` / `openWorkspace` / `connectWorkspace` 接受 `agentPreset`、`prompt` 与 `clearPreviousDraft`；启动恢复读取已保存空白会话日志记录的 preset，preset 失效时回退 Host 默认；添加工作区保留现有空白会话草稿。
- **feat** 同步上游会话水位线：基础仍为 5 条非空白会话，但运行中、子智能体运行中、等待用户、未读完成、当前打开与搜索揭示的会话会自动抬高水位线；搜索揭示可超过 50 条上限，手动展开或收起按上游规则重置；水位线不写入 viewing store。
- **refactor** 同步上游 Toast 架构：`workspace.toast` 按 notice kind 分派，共享 Factory 为 `workspace.toast.content`；归档动作、筛选动作与 fork 迁移提示回到各自业务注册项。旧 `WorkspaceBrowser` 内联 fork 错误条随之删除。
- **feat** 同步上游 fork 迁移处理：会话行 fork 以 `allowMigration: false` 请求 Host；源会话需要迁移时提示「打开原会话」，用户确认只导航，不自动重试 fork。
- **style** 同步上游侧栏弹层细节：Workspace / Session hover card 加入 `HoverCardGroup` 和 `grouped`，共享首张卡片的 800ms 停留计时；新建会话、置顶、归档、搜索恢复等按钮 Tooltip 经 body portal 绘制，避免被侧栏层叠上下文裁切。
- **docs** README、升级手册与依赖表统一改为 DSH / 上游基线 `0.2.1-rc.2`；验证清单补复制 Session ID、权限 fork、水位线和共享 Toast 四项。

## 0.3.0 — 2026-10-20

- **refactor** 删除过渡适配器 `src/client/legacy/`（5 个文件）、`package.json` 的两条 `dsh.client.external` 声明，以及只为它们存在的 5 个文案键（`status.waitingReview` / `...Overdue` / `...Imminent` / `...Left`、`status.scheduled`）。两家已各自注册同名 facet：dsh-gitea-dispatch 走其 PR #51（Issues #47），dsh-later 走其 PR #40（Issues #36）。
- **refactor** `visibleFacets` 从 `legacy/store-source.ts` 移到 `src/client/facet-visibility.ts`：它是徽标自己的可见性规则，不是某个来源的适配。移进 `legacy/` 只是当初为了让它能被测试，现在它本来就该在核心侧。
- **test** 核心用例不再引真实适配器，改用测试自己声明的合成来源。**这是一次所有权校正，不是减少覆盖**：用真实适配器测聚合，等于把「本插件不认识任何来源」这条断言悄悄写成「认识两个」。文案用例改为断言「来源交出的句子逐字呈现、无 label 时兜底且绝不读出来源 id」。删除 `tests/legacy-bridge.client.spec.ts`（被测对象已不存在）；其"store 迟到"与"设置过滤"两条不变量分别由 `tests/facets.node.test.mjs`（登记面语义）与 `tests/badge-labels.client.spec.ts`（过滤后不残留）继续覆盖。
- **docs** `facet-protocol.md` 的过渡一节改写为迁移史，并补两条提供方必读：`require` 只能用工厂注入的那个（全局 `require` 缺席且静默失败）；`protocol` 必须**比对**而不是回声对端版本（回声会关掉版本闸门，使 v1 形状的 facet 能声称 v2 并被接受，之后按错的语义静默渲染）。

### 由 dsh-gitea-dispatch 提出的四个问题（#22 / #23 / #24 / #25）

- **fix** 脉冲作用在**整只**徽标上，同组里任何一家声明 `pulse: true` 就让别家本该静止的图标跟着呼吸（Issues #22）。此前只把**判据**交出去了（`fold.pulse`），**作用对象**仍留在徽标容器上，于是 `pulse: false` 是否生效取决于同组里恰好有没有别人开闪——「等待评审超时不闪」这条承诺（README 与 `badge-labels.ts` 注释都写着）会悄悄失效，而提供方无从发现：它交出了 `pulse: false`、自己的 CSS 里零 `animation`，失效完全发生在本仓库的容器 class 上。现在判据与作用对象一起下沉到**声明它的那个元素**（`facetPulseClass` 取代 `groupBadgeIsUrgent`），计数数字与宿主会话状态点任何时候都不再继承来源的紧急程度。`docs/facet-protocol.md` 同步改写 `pulse` 的语义。
- **fix** 悬停明细不渲染 provider 的图标，只画一个统一 `StateDot`，而写着这件事的注释理由是「紧急程度由文案与**图标色**表达」——明细里根本没有图标色，这个前提不存在（Issues #24）。结果是同一条状态、同一次悬停里，徽标上是红色沙漏、明细里是黄点：徽标与明细是**同一行的两个视图**却各说一套。宿主 `StateDot` 只有 warning / ongoing / done 三档、没有 error 档，所以色档只能由来源自己的图标表达；现在明细行与徽标用**同一个** `facetGlyph` 元素（`HoverStatusLine` 新增可选 `glyph`，provider 未交 `renderIcon` 时两处同款退回通用点）。`docs/facet-protocol.md` 的「已知取舍」改写成与实现一致。
- **refactor** 同一事实两份实现，四处（Issues #25）：
  - **点行顺序 ≠ 明细顺序**，而注释声称两者「完全一致」。徽标是 pending → active → **done** → facet，明细是 pending → active → **facet** → done。点行按明细对齐，注释与实现从此同一条来源。
  - **状态优先级两份实现，结果不同**。徽标计数在 pending 分支里 `continue` 掉 `subagents += n.runningSubagentCount`（行内却给两个点），且未运行但已完成 + 有运行中子智能体时两处判断相反（徽标凭空多一枚绿点并计入数字）——`GroupBadge.tsx` 里「数字 = 进行中（**含子智能体**）」此前是空头承诺。计数判据改为与行内 `sessionStatuses()` 同一套规则，两处分歧各配一条回归测试。**这是行为变更**：折叠徽标的数字可能变大。
  - **一次渲染两个时钟**。`groupLiveBadge` 与 `hoverStatusLines` 各走 `Date.now()` 默认参数，而聚合用一次读数——跨分钟边界时同一行的徽标文案与明细文案可能差 1 分钟，正是 `group-status.ts` 那条不变式想防的事。`ProjectRowItem` 现接收 `now`，由 `WorkspaceBrowser` 统一的读数下发到徽标与明细。
  - `FACET_TONE_RANK` 仍是对外导出的名字但仓库内零使用（真正生效的是 `TONE_ORDER`）——**本次不动，且留作待决**。原先记的理由**经核实不成立**：「删除可能影响 dsh-gitea-dispatch 的产物断言」是错的，对方那条断言是**负向**的（其 `tests/group-status-facet.test.mjs:707`：`assert.equal(built.includes('… FACET_TONE_RANK'), false)`），它只要求「对方的内部件没被打进包」，本仓库删掉这个导出它照样通过。剩下的真实情况是：它从 `src/client/index.ts:157` 导出、第三方技术上能 import，但 `docs/facet-protocol.md` 与两份 README 都没提它，仓库内也没有任何实现读它。所以三选一：让 `defaultMergeFold` 真正用它、删掉这个导出、或把它写进契约文档承认是公共 API。判定过程见 Issues #25 的评论。
  - **后续已收口，选第一项**：`defaultMergeFold` 改读对外的 `FACET_TONE_RANK`，私有的 `TONE_ORDER` 删除（它只有这一个使用者）。两份表的顺序逐项相同，所以对合法色档**零行为变更**（64 种组合逐一比对，0 处分歧）。非法档位靠 `FACET_TONE_RANK[tone] ?? -1` 保住旧性质——`facetRejection` 只校验 protocol / id / 三个方法，**不校验 `fold()` 返回的 `tone`**（那是跨插件边界、运行时才产出的东西），少了这个 `?? -1`，坏 provider 的非法档位会被传播而不是被另一侧的合法档压掉。护栏是 `tests/facets.node.test.mjs` 的两条 #25③ 用例，并已用变异测试验过其非空洞性：删掉 `?? -1` 后「非法色档」那条会红。
- **docs** 设置项标签与 hint（中 / 英）、字段注释、`Config` 注释、`README.md` 两处表格、`README.en.md` 两处表格（图标对照表 + 设置项表）、`docs/upgrading.md` 的升级验收清单里对「等待评审」图标的描述改回与屏幕一致：dsh-gitea-dispatch 自其 #56/#60 起交出自绘沙漏，不再是「列表笔」（Issues #23）。英文表格与升级验收清单是第一轮漏掉的，漏法与它自己要修的那条毛病同一种：zh 改了，而「照着核的人读的那份」没跟上。验收清单里写着一个已经不存在的形状，照它核的人只会得出「插件没生效」。`legacy/register-legacy-facets.tsx` 的 pen 保留为**兜底形状**并注明「仅 provider 缺席时现形，形状不一致是有意接受的」——provider 缺席时让形状与行内不一致，好过「等待评审彻底不进徽标」。
- **test** 新增 5 条用例：脉冲逐来源判定（含邻居开闪不影响 `pulse: false`）、明细取来源图标及其缺省兜底、点行与明细同序、同一 `now` 决定倒计时读数、#25② 的两处优先级分歧各一条 + 一条「无子智能体的已完成仍照常计入」的反向保护。

- **fix** 入库的构建产物比源码陈旧：`lib/types/index.js`（`tsdown` 的打包入口）比 `src/index.ts` 少 6 个配置项，导致发布出去的 `lib/index.js` 里 `Config` 只有 `showCompletedInBadge` 一个字段——**设置界面因此只画得出 1 个开关**，其余 6 项（进行中 / 待审批 / 定时任务 / 等待评审 / 悬停明细 / 数字阈值）在界面上无法配置。徽标行为不受影响（客户端对这些字段有「缺失即回落默认」的兜底），受影响的是可配置性。根因是 `tsc` 的 `incremental` 缓存（`lib/tsconfig.tsbuildinfo`）陈旧后**静默跳过输出且退出码为 0**，产物便一直停在旧版本。已全量重建 `lib/`，并新增 `tests/artifacts.node.test.mjs` 锁住「产物存在性 + `Config` 字段与源码对齐」，同时把全量重建的写法补进 `docs/upgrading.md`。
- **feat** 跨插件状态改为**协议**：本插件不再逐家适配，改由状态所有者注册 facet。新增 `src/client/facets.ts`（协议 v1 + 登记面）与 `docs/facet-protocol.md`（契约文档），client 入口导出 `registerGroupStatusFacet` / `GROUP_STATUS_FACET_PROTOCOL_VERSION`。加一个新状态源，本插件**零改动**。
- **refactor** 聚合与渲染去掉所有按来源写死的分支：`GroupLiveStatus` 不再有 `scheduled*` / `waitingReview*` 具名字段，改持 `facets: Map<id, {facet, fold}>`；徽标的数字取各来源自报的 `count` 之和，图标取来源自带的 `renderIcon`（缺则按 `tone` 退通用点），文案取 `label`（缺则「N 需要关注」，绝不把内部 id 念给用户），脉冲取 `pulse`。
- **refactor** 消费侧不再逐个调提供方 hook。facet 运行时可增删，而同一组件的 hook 序列必须恒定，逐个调会在注册面变化时直接抛 "Rendered more hooks than during the previous render"。改为订阅一个聚合外部存储 + 读版本号，与来源数量无关。
- **feat** 同 id 冲突由**来源**决胜而非注册顺序（宿主不保证 apply 先后）：`provider` 恒胜过渡适配器 `legacy`，低一方的登记被拒并在 console 点名。
- **fix** 登记面的通知改为**合并补跑**而非递归：订阅者在回调里再登记会嵌套递归（两个互相触发的订阅者即无界），且中间那轮看到的登记面是改到一半的。
- **fix** 未声明 `order` 的来源排在所有声明过之后（彼此按注册先后）。原先缺省为 `0`，新接入的陌生来源会插到既有状态前面抢视觉位置。
- **refactor** 过渡适配器的可测部分拆到 `src/client/legacy/store-source.ts`（纯函数）：与图标同文件的逻辑在本仓库根本 import 不动（`vitest.config.ts` 排除理由 (b)），"store 迟到"和"设置关掉哪个来源"这两处真会咬人的逻辑此前测不到。
- **test** 新增协议契约用例：`tests/facets.node.test.mjs`（校验、决胜、注销语义、排序、重入合并、缺省合并）与 `tests/legacy-bridge.client.spec.ts`（设置过滤、store 迟到与替换、提供方缺席、订阅接线）；`tests/badge-labels.client.spec.ts` 改为经真实适配器驱动，锁住"陌生来源不写分支也能读出来"。
- **chore** 新增文案键 `status.needsAttention`（中 / 英）。

- **fix** 对 dsh-gitea-dispatch 的适配只做了一半：徽标只消费它发布的 `state`，其余字段全丢。提供方按 issue #16 发布的条目是 `{ prNumber, state, startedAt?, waitMaxSec?, deadline? }`，本插件的接收类型只声明 `{ prNumber, state }`，于是「在等哪个 PR」「还要等多久」「窗口缺失」三件事到不了界面。现在悬停明细与 `aria-label` 带上 PR 号与剩余时长（分钟粒度：徽标只在提供方 store 通知时重渲染，秒级读数会停在旧值上撒谎），窗口缺失时照实说「等待评审」，不编造倒计时。实测：注入一条 `PR #990002` 的等待登记后，折叠的 `dsh-plugins` 徽标由 `1 进行中 · 1 等待评审 · 1 定时任务` 变为 `1 进行中 · 1 等待评审（剩 2分钟） · #990002 · 1 定时任务`；把等待窗口改成已过期则变为 `…（已超时）…`。
- **fix** `waiting` 与 `overdue` 此前只有颜色不同，文案都是「等待评审」。这与本插件自己为定时任务与等待评审选用不同图标的理由（只靠颜色区分对色盲用户不可用）自相矛盾，也丢掉了提供方算出来的状态。现在两者各有一句文案：`等待评审` 与 `等待评审（已超时）`。
- **fix** 等待评审超时不再触发徽标脉冲。数据所有者把 `overdue` 的会话行图标画成静止（其 `lib/waiting-glyph.js` 写明「超时后停动画：静止即不再期待，比继续闪动更能表达已经结束」），且其 `overdue` 只代表 CI 的等待窗口到期、不代表评审失败。同一条等待在行内静止、在父级徽标闪动，就是同一事实的两种说法。红色不变。判据抽成纯函数 `groupBadgeIsUrgent()`，定时任务的 overdue/urgent 仍脉冲。（该判据已在上面的 #22 条里进一步下沉到单个元素，`groupBadgeIsUrgent` 由 `facetPulseClass` 取代。）
- **refactor** 分组折叠交给提供方：能用到 `summarizeWaitingGroup()` 就用它（id 口径、状态排序、截止时刻算法都归它所有），缺失时才退回本仓库的等价实现 `summarizeWaitingGroupLocally()`。此前本插件自己重写了一遍查表，且比提供方少两条兜底（`session-` / `webhook-` 前缀形态），只会静默 miss；现在与 `cross-plugin-summary.ts` 的 `entryFor()` 共用同一条四形态规则。
- **refactor** 徽标文案拆到 `src/client/badge-labels.ts`（纯函数，零运行时 import）。`rows/GroupBadge.tsx` 引入宿主图标集，其 `require` 图只在 DSH 应用内解析得到（`vitest.config.ts` 排除理由 (b)），文案留在原地等于这批跨插件状态永远测不到。新增 `tests/badge-labels.client.spec.ts` 11 例锁住文案与脉冲判据。
- **feat** 等待评审的事实随多层聚合正确上卷：PR 号取并集、去重、升序，倒计时取组内最早的未到期截止（一侧无窗口不会抹掉另一侧的）。多个会话等同一个 PR 时，明细只写一次 `#15`。

## 0.2.2 — 2026-10-15

- **feat** 多层聚合：父分组折叠时，徽标聚合所有后代分组的会话状态，不再只看直接成员。嵌套的 workspace 目录结构现在能正确反映整棵子树的活动。
- **fix** 上面这条「多层聚合」交付时是坏的：折叠的父文件夹会**漏算处于展开状态的中间层文件夹**的会话。`directStatusesForGroups` 沿用了「展开即 `EMPTY_LIVE_STATUS`」的占位写法，而聚合器把这个值当输入消费，于是展开的中间层对祖先贡献 0。现在展开的分组同样被测量，「不画徽标」退回渲染层决定。实测：dsh-group-status 展开且 1 个运行中、dsh-gitea-dispatch 1、dsh-later 3 时，dsh-plugins 的折叠徽标由 `4` 修正为 `5`。
- **fix** 折叠文件夹时完全没有淡出动画。`AnimatedRows` 的 `resetKey` 混入了 `sessionLimits`，而上游在折叠时会把该组的 limit 重置回默认值 → `resetKey` 变化 → 动画被整个跳过。属上游行为（vendor 基线 `d70ad82`），非本仓库引入。副作用：「展开其余 N 个会话」现在也会淡入而非瞬时呈现。
- **test** 徽标管线的测试此前是**自欺**的：`groupOf()` 在测试里手工赋值 `group.liveStatus`，而那份手工副本编码的正是上面第一个错误语义——所以少算 bug 能一路绿灯合入。改为走真实管线 `deriveGroups → directStatusesForGroups → aggregateGroupStatuses`，并给聚合路径补上全折叠 / 全展开两侧的 perf 护栏。变异验证：把 bug 塞回去，红 6 个测试（此前 0 个）。
- **refactor** 未经聚合的行现在在类型上不可表示：`StatusedGroupNode`（`liveStatus` 必填）+ `withAggregatedStatus` 生产者。上游的 `GroupNode.liveStatus?` 与 vendored 文件的签名均未改动。
- **refactor** 删掉 `tree.ts` 里无人使用的 re-export（两个值只有测试在用，4 个跨插件 summary 类型零消费方）。`tree.ts` 相对上游基线的新增分歧 31 → 18 行。
- **docs** 修正 README 的徽标数字公式：漏了「运行中的子智能体」一项，且「有徽标就带数字」与 `countThreshold` 默认值 2 自相矛盾。
- **perf** 代价说明：为正确性放弃了「展开的分组跳过聚合计算」这一优化，展开分组现在也会被测量（折叠祖先需要它的数字）。该成本由新增的 perf 用例守住。
- **feat** 设置项从 1 个扩展到 7 个：5 个按状态显隐（进行中 / 待审批 / 已完成 / 定时任务 / 等待评审）+ 悬停明细开关 + 数字显示阈值。设置卡片分 3 个 section，每个开关独立控制对应来源的点/图标是否出现在折叠徽标、悬停明细与计数中。
- **feat** 数字显示阈值（`countThreshold`）：取代原来的布尔开关 `alwaysShowCount`。现在可以设置一个数字阈值，只有当聚合数量 >= 该阈值时才在徽标上显示数字。默认 2（即 count=1 时省略，因为状态点已表达"有东西"）；设为 1 则始终显示；设为 3 则 count=1 和 count=2 时都不显示。
- **fix** 设置项 `showCompletedInBadge` 在 GUI 里根本没有入口：宿主只把 `Config` 投影成客户端表单，插件页要插件自己往 `plugins.bundle.config` 注册卡片才画得出来。现在侧栏 **插件** → dsh-group-status 的 bundle 详情页有这张卡片，保存后写进 profile patch 并即时生效。外观与交互不自造——用官方 `SettingsForm` / `SettingsFormModel` / `Switch`，与「插件 → 官方 → 子智能体」同一套框架与取值。README 此前描述的路径是文档超前于实现，文案与升级手册已同步。
- **test** 新增字段规格（真实现）与卡片接线（官方组件契约等价桩）用例。

## 0.2.1 — 2026-10-15

与 0.2.2 同一分钟内发布（npm `08:02:01Z` / `08:02:48Z`），**仓库里没有对应提交，也没有 tag**：
`git log -S'"version": "0.2.1"' -- package.json` 零命中。两个版本的 tarball 也不同（unpacked 1390616 vs
1244786 字节），所以 0.2.1 的确切内容无法从仓库重建 —— 此处只如实记录这个缺口，不据猜测填写条目。

## 0.2.0 — 2026-10-12

首个正式发布。内容与下面的 `0.2.0-rc.2-fork1` 相同（unpacked 1269018 vs 1269025 字节，差值即版本号本身；
`files` 字段一致），特性清单见该小节。

## 0.2.0-rc.2-fork1

- **feat** 折叠分组聚合徽标：收起的文件夹行显示进行中（转圈）、待审批（黄点）、已完成（绿点）的聚合状态，带数字与悬停明细。
- **feat** 跨插件聚合（可选）：接入 dsh-later 定时任务（时钟图标）与 dsh-gitea-dispatch 等待评审（列表笔图标），未安装时静默降级。
- **feat** 设置项 `showCompletedInBadge`：可关闭折叠徽标上的「已完成」绿点，默认开启。
- **feat** 无障碍：徽标带 `role="img"` + 本地化 `aria-label`，悬停 `title` 同文案。
- **refactor** 拆分 `badge-settings` / `group-status` 模块，新增 `GroupBadge` 组件。
- **refactor** 上游 `tree.ts` / `Rows.tsx` 代码下沉，侧栏展开态与官方版本逐像素一致。
- **docs** 中英双语 README + 上游升级手册 + 跨插件摘要模板说明。
- **test** 上游 spec 本地可跑（vitest + jsdom），新增折叠聚合用例（计数、待处理类互斥、子智能体、空白/归档跳过、跨插件来源）。
