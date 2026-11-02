<div align="center">

<img src="icon.svg" width="72" alt="dsh-group-status"/>

# dsh-group-status：折叠分组的聚合状态徽标

**中文** | [English](./README.en.md)

[![version](https://img.shields.io/badge/version-0.5.1-0EA5E9)](https://github.com/dsh-plugin-collection/dsh-group-status)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

</div>

> DSH 侧栏里，工作区分组一收起，组内会话的状态就全部不可见：进行中的、等审批的、等回答的，都藏在折叠里面。本插件在收起的文件夹行上显示一个聚合徽标（黄点表示待审批，转圈表示进行中，绿点表示有未读的已完成，后面可跟外部状态图标与一个数量），悬停可看逐项明细。分组展开时不显示徽标，状态由子行各自呈现。

---

## 特性一览

- **收起可见**：徽标只在分组收起时出现，展开后状态由子行各自呈现；嵌套分组聚合整棵子树。
- **与行内同源**：三档状态点复用官方 `StateDot` 与会话行的派生逻辑，跳过空白会话与已归档会话。
- **跨插件聚合**（可选）：其他插件可注册自己的状态源（定时任务、等待评审等），本插件不含任何来源的专用分支。
- **零配置可用**：5 个设置项控制三档显隐、悬停明细与数字阈值，默认全部显示。
- **不改官方包**：同槽位注册并在 profile 里禁用官方行，官方发布包的文件一个不动。
- **多语言**：跟随 DSH 界面语言（中文 / English），外部状态的文案由该状态的提供方给出。
- **无障碍**：徽标是 `role="img"`，读屏文案与悬停 `title` 同源，状态区分不只靠颜色。

---

## 效果预览

下面 `tmp` 分组里有 1 个进行中（转圈）、1 个已完成（绿点）、1 个定时任务（时钟），计数 `3`：

<p align="center">
<img src="docs/media/screenshot-folders.png" width="267" alt="侧栏中收起的 tmp 分组：转圈、绿点、时钟图标与数字 3"/>
</p>

悬停文件夹行，明细追加在路径与创建时间下面：

<p align="center">
<img src="docs/media/screenshot-hover.png" width="300" alt="悬停卡片：1 等待回答 · 1 进行中"/>
</p>

三档会话状态点复用 DSH 原生 `StateDot`，颜色与会话行同源。

---

## 安装

```bash
dsh plugin --profile web add dsh-group-status
```

侧栏是整包替换，**装完需要重启 `dsh web`** 才生效。配置项在插件页保存后即时生效，不用重启。

卸载（两条 profile 补丁一起撤，官方会话行自动回来，同样要重启）：

```bash
dsh plugin --profile web remove dsh-group-status
```

本包不改官方发布包里的任何文件：它注册同一个槽位，并在 profile 里禁用官方 `ui-workspace` 行。改代码时的本机 link 安装见[开发](#开发)。

---

## 验证

1. 找一个含进行中或待审批会话的分组，收起 → 文件夹名后出现徽标；
2. 悬停文件夹行 → 出现明细行，文案与徽标 `aria-label` 一致；
3. 展开分组 → 徽标消失；
4. 浏览器 console 无报错。

---

## 徽标不出现时

| 现象 | 原因 |
|---|---|
| 装完没反应 | 没重启 `dsh web`（侧栏整包替换） |
| 本包完全没被装载 | DSH 内核在 `engines.dsh` 窗口之外，内核直接 `skipping profile bundle`（实测 `0.2.0-rc.2`），侧栏保持官方行为 |
| 组内确有进行中或待审批的会话，收起后却没有徽标 | 组内四档计数（待审批、进行中、已完成、外部来源贡献）全为 0；空白会话与已归档会话不计入 |
| 只有状态点、没有数字 | 计数小于 `countThreshold`（默认 2） |
| 没有定时任务或等待评审图标 | 对应搭档插件未安装、未启用，或该插件自己关闭了这个状态源（外部状态的显隐由来源自己决定） |

---

## 徽标怎么读

本插件自己画三档会话状态：

| 图标 | 叫法 | 含义 | 颜色来源 |
|---|---|---|---|
| <img src="docs/media/glyph-pending.svg" width="10" height="10" alt=""/> | 黄点 | 组内有待审批 / 计划待审 / 等待回答 | `StateDot` `warning`，与会话行一致 |
| <img src="docs/media/glyph-running.svg" width="14" height="14" alt=""/> | 转圈 | 组内有进行中（含运行中的子智能体） | `StateDot` `ongoing` |
| <img src="docs/media/glyph-completed.svg" width="10" height="10" alt=""/> | 绿点 | 组内有已完成但未读的会话 | `StateDot` `done`，与会话行一致 |

图标是复刻件：形状按 `StateDot` 的几何（实心点是 10px 槽位里的 6px 圆，转圈是 14px 的环加一弧约 72°），颜色取自上面两张实机截图的像素，与截图同为暗色主题，由 [scripts/make-badge-glyphs.mjs](scripts/make-badge-glyphs.mjs) 生成。「转圈」在 UI 里持续旋转（1.5s 一圈），这里只能是一帧。真实界面上的颜色以 UI 为准，本包不另存一份色值表。

外部状态源（定时任务、等待评审等）交自己的图标与色档，本插件不决定它们的图标形状、颜色档位与是否闪烁，所以那两枚图标不在这里复刻，要看它们各自提供方的说明。

- **计数** = 待审批 + 进行中（含运行中的子智能体）+ 已完成 + 各外部来源自己报的条数。计数大于 99 显示 `99+`；小于 `countThreshold` 时省略数字，只画点。
- **排布**：待审批、进行中、外部来源、已完成。外部来源之间的次序由各自的 `order` 决定。悬停明细与徽标点行同一套次序，逐档一行，例如 `1 等待回答 · 1 进行中`。等待评审那一行由提供方带上 PR 号与剩余时长。
- **只在收起时出现**：分组展开后不显示徽标，状态由子行各自呈现。嵌套分组聚合整棵子树，父分组折叠时读到的是所有后代分组的合计。
- **无障碍**：徽标是 `role="img"`，`aria-label` 与悬停 `title` 同文案并随界面语言本地化；超时一类的区分不只靠颜色，文案里是两句不同的话。
- **脉冲按来源生效**：某个外部来源闪不闪由它自己声明，不连带整只徽标、计数数字或宿主会话状态点。

---

## 设置

侧栏 **插件** → **dsh-group-status**（bundle 详情页的配置表单）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `showRunningInBadge` | `true` | 折叠徽标是否显示「进行中」转圈 |
| `showPendingInBadge` | `true` | 折叠徽标是否显示「待审批 / 计划待审 / 等待回答」黄点 |
| `showCompletedInBadge` | `true` | 折叠徽标是否显示「已完成」绿点 |
| `showHoverDetails` | `true` | 悬停卡是否显示聚合状态明细行 |
| `countThreshold` | `2` | 计数达到该值才显示数字；设为 1 则始终显示 |

关掉一档，它完全退出折叠行的聚合提示：不画点、不计入数字、不进明细、不参与「是否显示徽标」的判断。会话行自身的状态点不受影响，那是行级状态。`showHoverDetails` 关掉后，悬停卡只剩标题、路径与创建时间。

点「保存」即时生效，无需刷新。设置由宿主写进 profile patch 的 `dsh-group-status` 条目 `config`，刷新页面后仍在。读不到设置面（例如宿主未提供设置服务）时回落为默认值「全部显示」：读不到不等于用户关掉。profile 里残留的未知字段不读取，行为等同默认。

外部来源在这张表单里没有开关，这是设计：本插件不认识任何具体来源，配置面也就不该出现别家的域名与图标形状。要关某个来源，去那个插件自己的设置卡片；它关掉时不注册状态源，徽标上就没有这一项。详见 [docs/facet-protocol.md](docs/facet-protocol.md) 的「显隐归谁」。

---

## 搭档插件（可选）

| 插件 | 折叠徽标里多出什么 | 安装 |
|---|---|---|
| [dsh-later](https://github.com/dsh-plugin-collection/dsh-later) | 组内定时任务（时钟图标；颜色档位与文案由 dsh-later 决定） | 公共 npm |
| `dsh-gitea-dispatch` | 组内等待评审的 PR（沙漏图标；颜色档位与文案由 dsh-gitea-dispatch 决定） | 未发布到公共 npm，见其仓库说明 |

两个都不装，本插件照常工作。等待评审图标的数据完全来自 `dsh-gitea-dispatch` 自己注册的 facet，本插件不替它维护文案或色档。

---

## 兼容性

| 项 | 值 |
|---|---|
| DSH 内核 | `engines.dsh: >=0.2.1-rc.2 <0.3.0-0` |
| 已验代次 | `0.2.1-rc.2` / `rc.3` / `rc.4`（三代门禁、冷启动装配、类型检查与全部用例通过；rc.2 上另做过真 GUI 验收） |
| peer 依赖 | `@deepseek-ai/cordis ~4.0.5` + 12 个 `@deepseek-ai/dsh-*`（范围 `^0.2.1-rc.2`） |
| 上游基线 | `@deepseek-ai/dsh-client-ui-workspace 0.2.1-rc.2`（源码 vendored 进本仓库 `src/`） |

`rc.4` 的**行为面**相对基线有漂移（空白会话复用、草稿初始化语义），本包的 fork 仍按基线代次走，所以那些改进到不了用户；能跑不等于行为一致，逐条差异与触发条件记在 [docs/upgrading.md](docs/upgrading.md) 的「上游代次跟踪」。

peer 里那 12 条不是元数据：不读 `engines.dsh` 的旧内核只按 peer 范围判兼容，漏声明会让旧代次把本包装进去并整页失败。因果与实测记在 [docs/upgrading.md](docs/upgrading.md)。

---

## 给第三方插件作者：注册一个状态源

折叠徽标可以显示别的插件的状态，方向是反的：**状态所有者把事实注册进来**，本插件的聚合与渲染路径不认识任何具体来源。

```js
const gs = require('dsh-group-status/client')
const unregister = gs?.registerGroupStatusFacet?.({
  protocol: gs.GROUP_STATUS_FACET_PROTOCOL_VERSION,
  id: 'my-plugin.review',        // '<包名>.<状态名>'
  subscribe: store.subscribe,    // 外部存储面，不是 React hook
  getSnapshot: store.getSnapshot,
  fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
  label, renderIcon, order,      // 可选：文案、图标、次序归提供方
})
ctx.effect(() => () => unregister?.(), 'my-plugin: group status facet')
```

- 只交 `protocol` / `id` / `subscribe` / `getSnapshot` / `fold` 五项就能显示：`N 需要关注` 加一枚按色档取色的通用点，内部 id 不会念给用户。
- 图标与文案归提供方：这个状态长什么样、超时该静止还是该闪，是提供方的知识。
- `fold` 交结构化 `data` 而不是文本，因为折叠的父分组要覆盖整棵子树、同名折果需要再合并；文本合并不了。
- 本插件未安装或未启用时 `require` 抛错，捕获该异常即可。
- 同 id 冲突由来源决胜、与注册顺序无关：状态所有者恒胜代管者。
- 跨插件**值导入**在本项目走不通（客户端 bundle 是自包含的闭包工厂），所以提供方只用 `require` 拿到的运行时符号，不 `import` 本包的类型。

完整契约、`FacetFold` 逐字段、缺省合并规则、生命周期与降级、版本规则见 [docs/facet-protocol.md](docs/facet-protocol.md)。为什么这里是 `subscribe` / `getSnapshot` 而不是 React hook，也在那份文档里。

---

## 开发

```sh
pnpm install
pnpm build        # tsc 类型检查 + tsdown 打包 → lib/
pnpm watch        # 监听 src/ 自动重建（仍需重启 dsh web）
pnpm test         # test:node（node --test，50 用例）+ test:spec（vitest + jsdom，191 用例）
pnpm test:spec    # 只跑 spec 套件
pnpm check-upstream   # 上游代次跟踪（加 --latest 查 npm 已发布的最高版）
```

### 本机开发安装

改代码时不必反复发包，用 link 挂进本机 profile：

```bash
git clone https://github.com/dsh-plugin-collection/dsh-group-status.git
cd dsh-group-status
pnpm install && pnpm build
dsh plugin --profile web add "link:$PWD"
```

`pnpm watch` 监听 `src/` 自动重建，重建后同样要重启 `dsh web`。

`tests/` 的上游副本之外，本仓库自己的用例覆盖折叠聚合（计数、待处理类互斥、子智能体、空白/归档跳过、外部来源登记与注销、悬停文案）。另有 9 个上游 spec 只能在 DSH monorepo 里跑，原因逐条写在 [vitest.config.ts](vitest.config.ts) 顶部。

README 里会随代码漂移的可数事实（版本徽章、设置项字段与默认值、用例数、不该出现的内部措辞、引用可达性）由 [tests/readme-facts.node.test.mjs](tests/readme-facts.node.test.mjs) 看着。

宿主契约里会**静默失效**的那部分（本插件认的待处理 kind 集合、从宿主读的两个状态事实）由 [tests/host-pending-kinds.node.test.mjs](tests/host-pending-kinds.node.test.mjs) 对着锁定版宿主实现比对，宿主一改就红。

---

## 已知限制

- **上游换代要手工 rebase**：本包 vendored 了上游源码，用的不是稳定公共 API；上游改槽位名、组件签名或上下文契约时要跟着改，步骤见 [docs/upgrading.md](docs/upgrading.md)。
- **每次状态变更多一轮全量测量**：聚合计数与展开态共用同一份派生，折叠的父分组要算得准，展开的分组同样得被测量。超大分组（数百会话）的这一轮 traverse 与上卷成本由 `tests/group-status.client.spec.ts` 的性能用例守住。
- **外部状态图标完全依赖提供方**：搭档插件不装就只是少那两个图标，不影响本体；提供方文案缺失时退回通用「需要关注」。
- **数字比明细粗**：外部来源按它自己报的条数计入，本插件不重新定义别人的计数口径。
- **只覆盖侧栏折叠态**：不改会话状态机，不改会话行的状态判据。
- **倒计时精度到分钟**：徽标只在提供方 store 通知时重渲染，秒级读数会停在旧值上不再更新。

---

## 文档

- [docs/facet-protocol.md](docs/facet-protocol.md)：跨插件状态源协议（提供方必读）
- [docs/upgrading.md](docs/upgrading.md)：上游基线、本地改动清单、换代 rebase 与验证、上游代次跟踪
- [src/client/cross-plugin-summary.ts](src/client/cross-plugin-summary.ts)：提供方侧骨架，文件头即设计说明

以上两份文档目前只有中文版本。

## 许可

MIT（沿用上游 `@deepseek-ai/dsh-client-ui-workspace`）。

---

<div align="center">

<img src="icon.svg" width="48" alt="dsh-group-status"/>

</div>
