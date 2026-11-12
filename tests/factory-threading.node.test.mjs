/**
 * Issues #50 / 决策 (c) 的**类型面与产物面**看守。
 *
 * ## 为什么需要这一份（行为 spec 抓不到的那一半）
 *
 * `tests/factory-threading.client.spec.tsx` 钉的是运行时行为：渲染器透传到行、行不消费它。
 * 但「透传面」本身是**声明**——它可以在一次上游 rebase 里被安静地抹掉：上游把
 * `WorkspaceBrowserProps` 的组合重写一遍、或行组件的 props 类型少了 `renderFactorySlot`，
 * 行为 spec 只会因为「props 类型不再要求它」而照样通过（我们直接构造 props 时传的是对象，
 * 少传一个 TS 也不报——spec 文件不参与 `tsc` 的发布检查）。
 *
 * 所以这里锁**已提交的构建产物** `lib/types/`（安装方真正吃到的东西；产物陈旧 /
 * 被上游覆盖的历史见本仓库 #47 与 `docs/upgrading.md`）：
 *   1. `contract/slots.d.ts` 里 `WorkspaceBrowserProps` 的组合必须仍含 `PropsRenderFactories`，
 *      `SlotFactoryMap` 必须仍声明 `'contextMenu.button'`（决策 (c) 的"保留 key、不消费"两面）；
 *   2. 行组件与两个列表体的产物面必须仍**带着**这个 prop，且**只透传不调用**——
 *      产物 JS 里出现 `renderFactorySlot(` 调用，就意味着有人把本地菜单换成了共享工厂。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

/** 去掉行注释与块注释，只留代码：看守"没有调用"时不该被注释里的措辞撞出误报。 */
const stripComments = (source) => source
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** 取某个 `export declare function NAME(...)` 声明的完整文本（到它的返回类型分号为止）。 */
const declaration = (source, name) => {
  const start = source.indexOf(`export declare function ${name}(`)
  if (start < 0) return null
  const rest = source.slice(start)
  // 函数声明以 `): import("react").JSX.Element;` 收尾；参数体内的分号不能当结束。
  const marker = rest.indexOf('JSX.Element;')
  assert.ok(marker >= 0, `${name} 的声明没有以 JSX.Element 收尾——产物形状变了`)
  return rest.slice(0, marker + 'JSX.Element;'.length)
}

/** 取 `export type X = ...;` 那一行（产物里组合类型都写成单行）。 */
const typeLine = (source, name) => {
  const match = source.match(new RegExp(`^export type ${name} = (.*);$`, 'm'))
  assert.ok(match, `产物里找不到 \`export type ${name}\``)
  return match[1]
}

test('contract/slots.d.ts：WorkspaceBrowserProps 的组合仍含 PropsRenderFactories', () => {
  const slots = read('lib/types/client/contract/slots.d.ts')
  const composed = typeLine(slots, 'WorkspaceBrowserProps')

  assert.ok(
    composed.includes('PropsRenderFactories'),
    'WorkspaceBrowserProps 少了 PropsRenderFactories——宿主 rc.2 的 renderFactorySlot 透传面被抹掉了',
  )
  // 组合面还在，不代表 import 还在：漏 import 的话产物是坏的类型。
  assert.match(
    slots,
    /import type \{[^}]*\bPropsRenderFactories\b[^}]*\} from '@deepseek-ai\/dsh-client-ui-slots'/,
    'slots.d.ts 没有从 @deepseek-ai/dsh-client-ui-slots 引入 PropsRenderFactories',
  )
})

test('contract/slots.d.ts：SlotFactoryMap 仍声明 contextMenu.button（保留而不消费）', () => {
  const slots = read('lib/types/client/contract/slots.d.ts')
  const block = slots.match(/interface SlotFactoryMap \{([\s\S]*?)\n\s*\}/)
  assert.ok(block, 'slots.d.ts 里找不到 `interface SlotFactoryMap` 的 declare module 块')
  assert.match(
    block[1],
    /'contextMenu\.button':/,
    "SlotFactoryMap 里必须仍保留 'contextMenu.button'——输入形状在这里钉住，外部消费方与本包未来整体迁移都靠它",
  )
  assert.match(block[1], /props: ContextMenuButtonProps/, '工厂输入必须仍是 ContextMenuButtonProps')
  // 形状自身也得在：行 trigger 的 target/label 语义全靠这几个字段。
  const props = slots.match(/interface ContextMenuButtonProps \{([\s\S]*?)\n\}/)
  assert.ok(props, 'slots.d.ts 里找不到 ContextMenuButtonProps')
  for (const field of ['target', 'label']) {
    assert.match(props[1], new RegExp(`readonly ${field}:`), `ContextMenuButtonProps 缺字段 ${field}`)
  }
})

test('产物类型面：行组件与两个列表体都带着 renderFactorySlot', () => {
  // 行为 spec 证明"运行时传到了"；这里证明"声明面还在"，rebase 才能被撞出来。
  const rows = read('lib/types/client/rows/Rows.d.ts')
  for (const name of ['ProjectRowItem', 'SessionNodeItem']) {
    const decl = declaration(rows, name)
    assert.ok(decl, `Rows.d.ts 里找不到 ${name} 的签名`)
    assert.match(
      decl,
      /renderFactorySlot: WorkspaceBrowserProps\['renderFactorySlot'\]/,
      `${name} 的 props 类型不再有 renderFactorySlot——透传链在这一环断了`,
    )
  }

  for (const [file, name] of [
    ['lib/types/client/rows/WorkspaceBrowser.d.ts', 'WorkspaceBrowser'],
    ['lib/types/client/rows/SessionTree.d.ts', 'SessionTree'],
    ['lib/types/client/rows/ListView.d.ts', 'FlatList'],
  ]) {
    const decl = declaration(read(file), name)
    assert.ok(decl, `${file} 里找不到 ${name} 的签名`)
    assert.ok(
      decl.includes('renderFactorySlot'),
      `${name} 的签名里应当出现 renderFactorySlot（根上解构 + 往下传）`,
    )
  }

  // SessionTreeProps 的 Pick 面含它：列表体的类型来源就是这一条。
  assert.match(
    read('lib/types/client/rows/browser-shared.d.ts'),
    /export type SessionTreeProps = Pick<WorkspaceBrowserProps,[^;]*'renderFactorySlot'/,
    "SessionTreeProps 的 Pick 里必须含 'renderFactorySlot'（对齐 rc.2 宿主列表体）",
  )
})

test('产物与源码一致：只有 toast 消费工厂，rows 一律只透传', () => {
  // 决策 (c) 的产物面版本：行侧出现调用 = 本地菜单被换成了共享 contextMenu.button。
  const rowArtifacts = [
    'lib/types/client/rows/Rows.js',
    'lib/types/client/rows/SessionTree.js',
    'lib/types/client/rows/ListView.js',
    'lib/types/client/rows/WorkspaceBrowser.js',
  ]
  for (const file of rowArtifacts) {
    const emitted = read(file)
    assert.ok(
      !/renderFactorySlot\s*\(/.test(emitted),
      `${file} 出现了 renderFactorySlot( 调用：本包按决策 (c) 不消费宿主工厂，行菜单必须走本地 Menu + renderSlot`,
    )
    assert.ok(
      !emitted.includes(`'contextMenu.button'`),
      `${file} 直接点名了 contextMenu.button——共享工厂 occurrence 不该出现在本包的行侧`,
    )
  }

  // 同一件事在源码面也锁一遍：spec 跑之前不依赖产物是否刚重建。
  for (const file of ['src/client/rows/Rows.tsx', 'src/client/rows/ListView.tsx', 'src/client/rows/WorkspaceBrowser.tsx', 'src/client/rows/browser-shared.ts']) {
    assert.ok(
      !/renderFactorySlot\s*\(/.test(stripComments(read(file))),
      `${file} 里出现了工厂调用——行侧消费工厂与决策 (c) 相悖`,
    )
  }

  // 唯一的合法消费方是本包自己的 toast 工厂。
  const toast = read('src/client/toast/Toast.tsx')
  assert.match(toast, /renderFactorySlot\('workspace\.toast\.content'/,
    'toast 仍在消费 workspace.toast.content——这条看守的前提变了的话，上面的"行侧不消费"也要重新讨论')
})
