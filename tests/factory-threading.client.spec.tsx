// @vitest-environment jsdom
/**
 * Issues #50 / 决策 (c) 的行为看守：宿主 rc.2 的 `renderFactorySlot` **透传到行**，
 * 但本包**一次都不消费**它——行菜单继续走本包本地 `Menu` +
 * `sidebar.workspaces.session.menu.item` / `sidebar.workspaces.session.row.action`。
 *
 * 为什么这条必须用行为锁住，而不是只写注释（决策依据见 `docs/upgrading.md` 的兼容台账与
 * `docs/research/0.2.2-rc.2-renderFactorySlot.md`）：
 *  - 本包 `cordis.patch.yml` 把官方 `ui-workspace` bundle 置为 `disabled: true`，rc.2 宿主
 *    在 ui-workspace 里贡献的 `contextMenu.button` kind（`session` / `workspace`）因此不注册；
 *    但 context-menu 包注册的**工厂 definition 仍在**。`FactoryOutlet` 只在 definition
 *    **缺失**时才用 `options.fallback`——definition 在、其 `ContextMenuButton` 自己 return
 *    null 时 fallback 永不触发：行一旦去消费这个工厂，「…」触发器会整块消失。
 *  - 就算能渲染，共享菜单的内容也不含本 fork 的私有语义，行菜单必须留在本地面上。
 *
 * 于是这里同时钉两件事，缺一不可：
 *   1. **透传到位**：`SessionTree`（分组视图）与 `FlatList`（扁平视图）把根上那**同一个**
 *      渲染器交到 `ProjectRowItem` / `SessionNodeItem`——用 `Rows.tsx` 的包裹 mock 记录
 *      行实际收到的 prop 的**同一性**（`===` 到根上传入的那个函数），而不是在测试里复刻一遍
 *      接线（复刻接线只能证明复刻是对的）；
 *   2. **消费为零**：整树渲染 + 点击打开菜单的全程，记录的调用里不含 `'contextMenu.button'`；
 *      再把工厂换成「被调用就抛」的实现，渲染与点击仍然正常。
 *
 * 桩件边界：官方 `@deepseek-ai/dsh-client-ui-primitives` 的 bundle 依赖宿主应用预载的
 * externals（独立仓库里 require 它会炸 `.module.css`，原因见 `vitest.config.ts` 头部），
 * 所以与 `badge-settings-card.client.spec.tsx` 同样按**契约等价**替换：`Menu` 桩保留真实
 * 调用形状（`anchor` 恒在、`open` 时才渲染 `children` 与 `items` 两种用法），菜单的开关状态
 * 机仍是 `Rows.tsx` 自己的真 `useState` 在跑，桩件只补渲染容器。`workspace-browser.client.
 * spec.tsx` / `rows.client.spec.tsx` 这两份上游 spec 在本仓库被 `MONOREPO_ONLY_SPECS` 排除
 * （它们要 `@deepseek-ai/dsh-client-test-runtime` 直接读上游未发布的源码），所以本文件按
 * 其构造方式给组件**直接构造 props**，不依赖那份跑不起来的运行时。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { zh } from '../src/client/locales.ts'
import { DEFAULT_BADGE_SETTINGS } from '../src/client/badge-settings.ts'
import { FlatList } from '../src/client/rows/ListView.tsx'
import { ProjectRowItem, SessionNodeItem } from '../src/client/rows/Rows.tsx'
import { SessionTree } from '../src/client/rows/SessionTree.tsx'

/** 行收到的工厂渲染器登记处（`vi.hoisted` 保证 mock 工厂运行时它已存在）。 */
const tracked = vi.hoisted(() => ({
  /** 根上传入的那个函数；测试每次渲染前赋值。 */
  root: undefined as unknown,
  /** 每次行组件渲染记一条：组件名 + 收到的 prop 是否就是根上那个。 */
  rows: [] as { component: string; fromRoot: boolean; type: string }[],
}))

/**
 * 官方组件包的契约等价桩。`Menu` 按真实调用面渲染：`anchor` 永远在场，`open` 为真时
 * 才渲染 `children`（会话行的 `renderSlot` 条目）或 `items`（Workspace 行的 rename/delete），
 * 于是「点 … → 本地菜单出现条目」这条链在桩件下仍然可断言。
 */
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { createElement } = await import('react')
  const icon = (testid: string) => (props: any) =>
    createElement('svg', { 'data-icon': testid, ...props })
  const pass = (name: string) => (props: any) =>
    createElement('div', { 'data-stub': name }, props.children)
  return {
    HoverCard: (props: any) => createElement('div', { 'data-stub': 'hover-card' },
      props.anchor,
      props.open === true ? createElement('div', { 'data-testid': 'hover-content' }, props.content) : null),
    HoverCardGroup: pass('hover-group'),
    Tooltip: pass('tooltip'),
    StateDot: (props: any) => createElement('span', { 'data-stub': 'state-dot', 'data-state': props.state }),
    relativeTime: () => '刚刚',
    Menu: (props: any) => createElement('div', { 'data-stub': 'menu' },
      props.anchor,
      props.open
        ? createElement('div', { 'data-testid': 'menu-content' },
            props.children,
            (props.items ?? []).map((item: any) =>
              createElement('button', { key: item.id, 'data-menu-item': item.id }, item.label)))
        : null),
    MenuItemButton: pass('menu-item-button'),
    Button: pass('button'),
    Modal: pass('modal'),
    writeClipboard: vi.fn(),
    IconEllipsisOutlineRegular: icon('ellipsis'),
    IconEditOutlineRegular: icon('edit'),
    IconTrashOutlineRegular: icon('trash'),
    IconArchiveOutlineRegular: icon('archive'),
    IconUnarchiveOutlineRegular: icon('unarchive'),
    IconPinFillRegular: icon('pin'),
    IconFolderOpenRegular: icon('folder-open'),
    IconFolderCloseRegular: icon('folder-close'),
    IconTriangleRightFillRegular: icon('chevron'),
    IconNewChatOutlineRegular: icon('new-chat'),
    IconQueueOutlineRegular: icon('queue'),
    IconCopyOutlineRegular: icon('copy'),
    IconBranchOutlineRegular: icon('branch'),
    IconWarningOutlineRegular: icon('warning'),
  }
})

/**
 * 包裹**真实**行组件，只登记它收到的 `renderFactorySlot` 身份，然后原样渲染真组件。
 * 这样断言的是「行确实拿到了根上传下来的那一个」，而不是「测试里传的 prop 对了」。
 */
vi.mock('../src/client/rows/Rows.tsx', async (importOriginal) => {
  const { createElement } = await import('react')
  const actual = await importOriginal<Record<string, unknown>>() as Record<string, any>
  const track = (component: string) => (props: any) => {
    tracked.rows.push({
      component,
      fromRoot: props.renderFactorySlot === tracked.root,
      type: typeof props.renderFactorySlot,
    })
    return createElement(actual[component], props)
  }
  return {
    ...actual,
    ProjectRowItem: track('ProjectRowItem'),
    SessionNodeItem: track('SessionNodeItem'),
  }
})

afterEach(() => {
  cleanup()
  // 登记处是模块级的：不清掉的话，上一条用例里行渲染的次数会漏进这一条的断言。
  tracked.rows.length = 0
  tracked.root = undefined
})

/** 词典取值器：断言里不抄字符串，插值按 `{name}` 形状做。 */
const t = ((key: string, vars?: Record<string, unknown>) => {
  const raw = (zh as Record<string, string>)[key] ?? key
  return Object.entries(vars ?? {}).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), raw)
}) as never

const sid = (id: string): SessionId => id as SessionId
const wid = (id: string): WorkspaceId => id as WorkspaceId

const summary = (id: string, title: string): SessionSummary => ({
  id: sid(id), title, displayTitle: title, running: false, blank: false,
  updatedAt: 0, retainedBy: {},
})

const list: SessionListState = {
  ids: [sid('s1'), sid('s2')],
  byId: { s1: summary('s1', 'Alpha Session'), s2: summary('s2', 'Beta Session') },
  phase: 'ready',
  projectionsBySession: {},
}

/** 路径 basename 即分组行的 label（`workspaceLabel`），断言 aria-label 时按同一个来源。 */
const workspace: WorkspaceView = {
  workspaceId: wid('w1'), path: '/workspaces/alpha', title: 'alpha',
  sessionIds: [sid('s1'), sid('s2')],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

const rowState = { pinnedSessionIds: [], archivedSessionIds: [], archivedFilter: 'default' } as never

/** 三个宿主 selector hook 的最薄替身：`select(state)` 直接算，不接真 store。 */
const useSessionStatus = ((select: (s: unknown) => unknown) => select(new Map())) as never
const usePanelInfo = ((select: (s: { activePanelId: string | null }) => unknown) =>
  select({ activePanelId: null })) as never
const useBadgeSettings = ((select: (s: typeof DEFAULT_BADGE_SETTINGS) => unknown) =>
  select(DEFAULT_BADGE_SETTINGS)) as never

/** 可记录调用的假工厂渲染器。 */
function recordingFactory() {
  return vi.fn((): null => null) as (...args: unknown[]) => null
}

/** 记录过的 occurrence 名字（第 0 个实参）。 */
const names = (factory: (...args: unknown[]) => null): string[] =>
  factory.mock.calls.map(call => String(call[0]))

/**
 * 会话行的 child-seat 替身：菜单条目与 hover/action 席位各画一个可寻址的标记，
 * 断言「条目进的是本地菜单」时看的是 DOM，不是调用记录。
 */
function entrySlot(seat: { names: string[] }) {
  return vi.fn((name: string, props: { sessionId?: string }) => {
    seat.names.push(name)
    if (name !== 'sidebar.workspaces.session.menu.item') return null
    return createElement('button', { 'data-testid': `entry:${props.sessionId}` }, `entry:${name}`)
  }) as never
}

/** 分组视图：`SessionTree`（Workspace 行 + 其下 Session 行）。 */
function renderGrouped(factory: (...args: unknown[]) => null, renderSlot: (...args: unknown[]) => unknown) {
  tracked.root = factory
  return render(<SessionTree
    list={list}
    workspaces={[workspace]}
    ungroupedSessionIds={[]}
    rowState={rowState}
    onLeaveArchivedOnly={vi.fn()}
    useSessionStatus={useSessionStatus}
    usePanelInfo={usePanelInfo}
    useBadgeSettings={useBadgeSettings}
    startSession={vi.fn()}
    open={vi.fn()}
    workspaceReady
    animationResetKey="manual"
    nestWorkspaces={false}
    groupExpansion={{ w1: true }}
    setGroupExpanded={vi.fn()}
    setSessionOrder={vi.fn()}
    onRenameRequest={vi.fn()}
    onDeleteRequest={vi.fn()}
    onSessionRenameRequest={vi.fn()}
    onSessionRevealed={vi.fn()}
    insertWorkspaceBefore={vi.fn()}
    shortcuts={[]}
    home="/home/u"
    renderSlot={renderSlot}
    renderFactorySlot={factory}
    t={t}
  />)
}

/** 扁平视图：`FlatList`（无层级，每个会话一条顶层行）。 */
function renderFlat(factory: (...args: unknown[]) => null, renderSlot: (...args: unknown[]) => unknown) {
  tracked.root = factory
  return render(<FlatList
    list={list}
    sessionIds={[sid('s1'), sid('s2')]}
    rowState={rowState}
    onLeaveArchivedOnly={vi.fn()}
    useSessionStatus={useSessionStatus}
    usePanelInfo={usePanelInfo}
    open={vi.fn()}
    onSessionRenameRequest={vi.fn()}
    setSessionOrder={vi.fn()}
    workspaceReady
    animationResetKey="manual"
    revealSessionId={undefined}
    onSessionRevealed={vi.fn()}
    renderSlot={renderSlot}
    renderFactorySlot={factory}
    t={t}
  />)
}

/** 行内那个自绘「…」触发按钮：按 aria-label 取，顺带确认它画的是省略号图标。 */
function ellipsisTrigger(label: string): HTMLElement {
  const trigger = screen.getByLabelText(label)
  expect(trigger.tagName).toBe('BUTTON')
  expect(trigger.querySelector('svg[data-icon="ellipsis"]')).toBeTruthy()
  return trigger
}

describe('决策 (c) ①：renderFactorySlot 透传到行', () => {
  it('分组视图：Workspace 行与 Session 行拿到的就是根上传入的那一个', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderGrouped(factory, entrySlot(seat))

    // 行照常渲染：分组行、两条会话行都在。
    expect(screen.getByText('Alpha Session')).toBeTruthy()
    expect(screen.getByText('Beta Session')).toBeTruthy()
    expect(screen.getByText('alpha')).toBeTruthy()

    // 两类行都被登记过，且每一次拿到的都是根上那个函数本身。
    const components = new Set(tracked.rows.map(row => row.component))
    expect(components.has('ProjectRowItem')).toBe(true)
    expect(components.has('SessionNodeItem')).toBe(true)
    expect(tracked.rows.every(row => row.fromRoot)).toBe(true)
    expect(tracked.rows.every(row => row.type === 'function')).toBe(true)
  })

  it('扁平视图：FlatList 同样把同一个渲染器交到每条会话行', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderFlat(factory, entrySlot(seat))

    expect(screen.getByText('Alpha Session')).toBeTruthy()
    expect(screen.getByText('Beta Session')).toBeTruthy()
    expect(tracked.rows.length).toBeGreaterThan(0)
    expect(tracked.rows.every(row => row.component === 'SessionNodeItem')).toBe(true)
    expect(tracked.rows.every(row => row.fromRoot)).toBe(true)
  })

  it('直接构造行组件时同样成立：prop 是必需面，缺了它类型面就散架', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    tracked.root = factory
    render(<SessionNodeItem
      node={{
        id: sid('s1'), title: 'Alpha Session', blank: false, running: false,
        runningSubagentCount: 0, completed: false, updatedAt: 0, pinned: false, archived: false,
      } as never}
      currentId={undefined}
      now={0}
      onOpen={vi.fn()}
      onRenameRequest={vi.fn()}
      renderSlot={entrySlot(seat)}
      renderFactorySlot={factory}
      t={t}
    />)
    expect(screen.getByText('Alpha Session')).toBeTruthy()
    expect(tracked.rows.length).toBeGreaterThan(0)
    expect(tracked.rows.every(row => row.component === 'SessionNodeItem')).toBe(true)
    expect(tracked.rows.every(row => row.fromRoot)).toBe(true)
  })
})

describe('决策 (c) ②：本包不消费共享 contextMenu.button 工厂', () => {
  it('整树渲染 + 点开两个菜单，工厂一次都没被调用', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderGrouped(factory, entrySlot(seat))

    fireEvent.click(ellipsisTrigger(t('actions.workspace.aria', { name: 'alpha' })))
    fireEvent.click(ellipsisTrigger(t('actions.session.aria', { name: 'Alpha Session' })))

    expect(names(factory)).not.toContain('contextMenu.button')
    expect(factory).not.toHaveBeenCalled()
  })

  it('把工厂换成「被调用就抛」的实现，渲染与打开菜单仍然正常（消费路径根本不存在）', () => {
    const boom = vi.fn((name: string): never => {
      throw new Error(`本包不该消费宿主工厂：${name}`)
    }) as unknown as (...args: unknown[]) => null
    const seat = { names: [] as string[] }
    let failure: unknown = null
    try {
      tracked.root = boom
      render(<ProjectRowItem
        group={{
          key: 'w1', workspaceId: wid('w1'), cwd: '/workspaces/alpha', createdAt: 0,
          label: 'alpha', sessions: [], expanded: true, containsCurrent: false,
          sessionCount: 0, liveStatus: undefined,
        } as never}
        settings={DEFAULT_BADGE_SETTINGS}
        home="/home/u"
        now={0}
        renderFactorySlot={boom}
        t={t}
        onToggle={vi.fn()}
        onCreate={vi.fn()}
        actions={{ rename: vi.fn(), delete: vi.fn() }}
      />)
      fireEvent.click(ellipsisTrigger(t('actions.workspace.aria', { name: 'alpha' })))
      render(<SessionNodeItem
        node={{
          id: sid('s1'), title: 'Alpha Session', blank: false, running: false,
          runningSubagentCount: 0, completed: false, updatedAt: 0, pinned: false, archived: false,
        } as never}
        currentId={undefined}
        now={0}
        onOpen={vi.fn()}
        onRenameRequest={vi.fn()}
        renderSlot={entrySlot(seat)}
        renderFactorySlot={boom}
        t={t}
      />)
      fireEvent.click(ellipsisTrigger(t('actions.session.aria', { name: 'Alpha Session' })))
    } catch (error) {
      failure = error
    }
    expect(failure).toBe(null)
    expect(boom).not.toHaveBeenCalled()
  })
})

describe('决策 (c) ③：行菜单仍是本包本地面', () => {
  it('分组行的「…」是自绘按钮，点开的是本地 Menu 的重命名/删除两项', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderGrouped(factory, entrySlot(seat))

    expect(screen.queryByTestId('menu-content')).toBe(null)
    fireEvent.click(ellipsisTrigger(t('actions.workspace.aria', { name: 'alpha' })))

    const menu = screen.getByTestId('menu-content')
    expect(menu.querySelector('[data-menu-item="rename"]')).toBeTruthy()
    expect(menu.querySelector('[data-menu-item="delete"]')).toBeTruthy()
    expect(within(menu).getByText(t('rename'))).toBeTruthy()
    expect(within(menu).getByText(t('delete.workspace'))).toBeTruthy()
    expect(names(factory)).not.toContain('contextMenu.button')
  })

  it('会话行的「…」点开的是本地 Menu，条目来自 sidebar.workspaces.session.menu.item', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderGrouped(factory, entrySlot(seat))

    fireEvent.click(ellipsisTrigger(t('actions.session.aria', { name: 'Alpha Session' })))

    // 条目落在**本地菜单**里，而不是共享工厂的产物。
    const menu = screen.getByTestId('menu-content')
    expect(menu.querySelector('[data-testid="entry:s1"]')).toBeTruthy()
    expect(seat.names).toContain('sidebar.workspaces.session.menu.item')
    expect(names(factory)).not.toContain('contextMenu.button')
  })

  it('扁平视图的会话行同样走本地菜单条目', () => {
    const factory = recordingFactory()
    const seat = { names: [] as string[] }
    renderFlat(factory, entrySlot(seat))

    fireEvent.click(ellipsisTrigger(t('actions.session.aria', { name: 'Beta Session' })))
    expect(screen.getByTestId('menu-content').querySelector('[data-testid="entry:s2"]')).toBeTruthy()
    expect(seat.names).toContain('sidebar.workspaces.session.menu.item')
    expect(names(factory)).not.toContain('contextMenu.button')
  })
})
