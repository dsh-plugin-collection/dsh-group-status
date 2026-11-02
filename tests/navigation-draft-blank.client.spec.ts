/**
 * Fork-owned coverage for the kernel-0.2.2 forward adaptations from issue #43:
 * the `whenDraftExists` tri-state joins `clearPreviousDraft` in the New-Session
 * draft-intent decision, and blank reuse skips blanks listing another preset.
 *
 * The vendored `tests/workspaces-service.client.spec.ts` drives the same service but
 * cannot run in this repository (see `vitest.config.ts`); this spec keeps the stubs
 * plain-object so only `cordis` is imported for runtime.
 */
import { setImmediate } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISessions, SessionListState, SessionReference, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces, WorkspaceId, WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { UiWorkspaceService } from '../src/client/navigation.ts'

const sid = (id: string): SessionId => id as SessionId
const wid = (id: string): WorkspaceId => id as WorkspaceId

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.restoreAllMocks()
})

function workspace(id: string, sessionIds: readonly SessionId[] = []): WorkspaceView {
  return {
    workspaceId: wid(id),
    path: `/w/${id}`,
    title: id,
    sessionIds,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function summary(id: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 0,
    ...overrides,
    retainedBy: overrides.retainedBy ?? {},
  }
}

class MutableSource<T> {
  private readonly listeners = new Set<() => void>()

  constructor(private value: T) {}

  getSnapshot(): T {
    return this.value
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  set(value: T): void {
    this.value = value
    for (const listener of [...this.listeners]) listener()
  }
}

function sessionState(summaries: readonly SessionSummary[] = []): SessionListState {
  return {
    ids: summaries.map(item => item.id),
    byId: Object.fromEntries(summaries.map(item => [item.id, item])),
    // `pending` keeps the startup restoration out of the seat; each call drives its own path.
    phase: 'pending',
    projectionsBySession: {},
  }
}

function workspaceState(items: readonly WorkspaceView[] = []): WorkspaceSnapshot {
  return {
    items,
    archivedSessionIds: [],
    pinnedSessionIds: [],
    phase: 'pending',
    state: 'idle',
    error: null,
  }
}

interface DraftStub {
  readonly input: { requestDraftInitialization: ReturnType<typeof vi.fn> }
}

interface BenchOverrides {
  readonly sessions?: SessionListState
  readonly workspaces?: WorkspaceSnapshot
  readonly draft?: DraftStub
}

/** Drives the service with plain-object stubs; only the navigation module is real. */
function bench(overrides: BenchOverrides = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  const selectPanel = vi.fn()
  ctx.provide('layout', {
    beginNavigation: () => new AbortController().signal,
    selectPanel,
  } as never)
  if (overrides.draft !== undefined) ctx.provide('conversation', overrides.draft as never)
  const sessions = {
    list: new MutableSource(overrides.sessions ?? sessionState()),
    create: vi.fn(async (options?: { readonly sessionId?: SessionId }) =>
      options?.sessionId ?? sid('created')),
    retain: vi.fn((target: SessionId): SessionReference => {
      const release = vi.fn()
      return { sessionId: target, binding: { sessionId: target } as never, ready: Promise.resolve(null), release, [Symbol.dispose]: release }
    }),
    binding: vi.fn((sessionId: SessionId) => ({ sessionId })),
    refreshProjections: vi.fn(async () => undefined),
    subagentAddress: vi.fn(),
  } as unknown as ISessions
  const workspaces = {
    list: new MutableSource(overrides.workspaces ?? workspaceState()),
  } as unknown as IWorkspaces
  const notify = vi.fn()
  const uiWorkspace = new UiWorkspaceService(
    ctx,
    {} as never,
    workspaces,
    sessions,
    { pinSessionOrder: vi.fn() } as never,
    notify,
  )
  return { ctx, sessions, workspaces, notify, selectPanel, uiWorkspace }
}

describe('blank reuse follows the listed preset (issue #43)', () => {
  const preset = summary('preset', { blank: true, cwd: '/w/a', projectionValues: { agentPreset: 'workflow' } })
  const plain = summary('plain', { blank: true, cwd: '/w/a' })
  const b = () => bench({
    sessions: sessionState([preset, plain]),
    workspaces: workspaceState([workspace('a', [sid('preset'), sid('plain')])]),
  })

  it('a preset-less request skips the preset-listing blank and reuses the plain one', async () => {
    const x = b()
    await expect(x.uiWorkspace.connectWorkspace(wid('a'))).resolves.toBe(sid('plain'))
    expect(x.sessions.create).toHaveBeenCalledExactlyOnceWith({ workspaceId: wid('a'), sessionId: sid('plain') })
  })

  it('a preset-naming request reuses the blank that lists the same preset', async () => {
    const x = b()
    await expect(x.uiWorkspace.connectWorkspace(wid('a'), { agentPreset: 'workflow' })).resolves.toBe(sid('preset'))
    expect(x.sessions.create).toHaveBeenCalledExactlyOnceWith({
      workspaceId: wid('a'), sessionId: sid('preset'), agentPreset: 'workflow',
    })
  })

  it('a preset-naming request still reuses a preset-less blank', async () => {
    // Skipping hits only blanks listing another preset; the plain blank applies.
    const x = b()
    await expect(x.uiWorkspace.connectWorkspace(wid('a'), { agentPreset: 'review' })).resolves.toBe(sid('plain'))
    expect(x.sessions.create).toHaveBeenCalledExactlyOnceWith({
      workspaceId: wid('a'), sessionId: sid('plain'), agentPreset: 'review',
    })
  })

  it('a request whose preset matches no listed blank creates a fresh Session', async () => {
    const onlyPreset = bench({
      sessions: sessionState([preset]),
      workspaces: workspaceState([workspace('a', [sid('preset')])]),
    })
    await expect(onlyPreset.uiWorkspace.connectWorkspace(wid('a'), { agentPreset: 'review' })).resolves.toBe(sid('created'))
    expect(onlyPreset.sessions.create).toHaveBeenCalledExactlyOnceWith({ workspaceId: wid('a'), agentPreset: 'review' })
    // The same holds for a preset-less request: preset-listing blanks are all skipped.
    const presetOnlyPlain = bench({
      sessions: sessionState([preset]),
      workspaces: workspaceState([workspace('a', [sid('preset')])]),
    })
    await expect(presetOnlyPlain.uiWorkspace.connectWorkspace(wid('a'))).resolves.toBe(sid('created'))
    expect(presetOnlyPlain.sessions.create).toHaveBeenCalledExactlyOnceWith({ workspaceId: wid('a') })
  })
})

describe('startSession draft intent (issue #43)', () => {
  function draftBench() {
    const requestDraftInitialization = vi.fn(() => 'applied' as const)
    const x = bench({
      draft: { input: { requestDraftInitialization } },
      workspaces: workspaceState([workspace('a')]),
    })
    return { ...x, requestDraftInitialization }
  }

  it('whenDraftExists alone initializes the draft and reaches the Host verbatim', async () => {
    const { uiWorkspace, requestDraftInitialization } = draftBench()
    uiWorkspace.startSession(wid('a'), { whenDraftExists: 'append' })
    await vi.waitFor(() => {
      expect(requestDraftInitialization).toHaveBeenCalledExactlyOnceWith(
        { sessionId: sid('created') }, { whenDraftExists: 'append' },
      )
    })
  })

  it('prompt plus a policy passes both fields through untouched', async () => {
    const { uiWorkspace, requestDraftInitialization } = draftBench()
    uiWorkspace.startSession(wid('a'), { prompt: 'hello', whenDraftExists: 'keep' })
    await vi.waitFor(() => {
      expect(requestDraftInitialization).toHaveBeenCalledExactlyOnceWith(
        { sessionId: sid('created') }, { prompt: 'hello', whenDraftExists: 'keep' },
      )
    })
  })

  it('clearPreviousDraft alone still initializes the draft', async () => {
    const { uiWorkspace, requestDraftInitialization } = draftBench()
    uiWorkspace.startSession(wid('a'), { clearPreviousDraft: true })
    await vi.waitFor(() => {
      expect(requestDraftInitialization).toHaveBeenCalledExactlyOnceWith(
        { sessionId: sid('created') }, { clearPreviousDraft: true },
      )
    })
  })

  it('an options bag without shaping intent does not touch the draft', async () => {
    const { uiWorkspace, requestDraftInitialization, selectPanel } = draftBench()
    // The WorkspaceBrowser New Session seat: keep the reused blank's draft as it is.
    uiWorkspace.startSession(wid('a'), { clearPreviousDraft: false })
    await vi.waitFor(() => { expect(selectPanel).toHaveBeenCalled() })
    await setImmediate()
    expect(requestDraftInitialization).not.toHaveBeenCalled()
    uiWorkspace.startSession(wid('a'), { agentPreset: 'workflow' })
    await setImmediate()
    expect(requestDraftInitialization).not.toHaveBeenCalled()
  })
})
