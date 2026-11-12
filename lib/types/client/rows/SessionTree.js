import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The scrolling session tree: Workspace groups, aggregated live-status badges,
 * watermarks, and row drag ordering.
 *
 * Split out of `WorkspaceBrowser.tsx` so the shell keeps only the header, search
 * box, and dialogs; this file owns the tree body and its local row limits, and
 * unmounting it drops both the sessions subscription and those limits.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { HoverCardGroup } from '@deepseek-ai/dsh-client-ui-primitives';
import { deriveGroups, owningGroupKey, owningParentFolder, UNGROUPED_KEY } from "../tree.js";
import { directStatusesForGroups, withAggregatedStatus } from "../group-status.js";
import { raiseWatermarks, requiredWatermark, SESSION_WATERMARK_BASE, watermarkRows } from "../session-watermarks.js";
import { facetStore } from "../facet-store.js";
import { useRegisteredFacets } from "../use-registered-facets.js";
import { ProjectRowItem, SessionNodeItem } from "./Rows.js";
import { AnimatedRows } from "./AnimatedRows.js";
import css from './WorkspaceBrowser.module.css';
import { mainViewSessionId, sessionDragOrder, useNativeDragAcceptance, workspaceGroupHalf, } from "./browser-shared.js";
import { EmptySessions } from "./EmptySessions.js";
// 外部状态来源：**本文件不认识任何具体插件**。运行时只有登记面（`../facets.ts`）与
// 它背后的存储订阅；谁想让自己的状态进折叠徽标，就按协议注册一个 facet
// （`docs/facet-protocol.md`）。现有两家已各自注册，本插件不再代管任何来源。
//
// 这里只经 `useRegisteredFacets` 订阅一次外部存储，与 facet 数量无关，所以增删来源不会
// 改变 hook 调用序列（那正是逐个调 provider hook 的写法做不到的）；登记面本身**迟到**也
// 照样生效，理由与踩过的坑写在那个文件里。本插件不再筛外部来源：登记面即所见。
const facetsStore = facetStore();
/** The scrolling session tree; unmounting drops the sessions subscription and local row limits. */
export function SessionTree({ list, useSessionStatus, startSession, open, workspaces, ungroupedSessionIds, rowState, onLeaveArchivedOnly, workspaceReady, animationResetKey, usePanelInfo, onRenameRequest, onDeleteRequest, onSessionRenameRequest, renderSlot, renderFactorySlot, insertWorkspaceBefore, nestWorkspaces, groupExpansion, setGroupExpanded, setSessionOrder, home, t, revealSessionId, onSessionRevealed, shortcuts, useBadgeSettings, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    // 徽标设置：**本插件自己**那三档会话状态的显隐、悬停明细、数字样式。
    const badgeSettings = useBadgeSettings(settings => settings);
    const statuses = useSessionStatus(s => s);
    // 外部状态：订阅 + 读登记面，在 `useRegisteredFacets` 里一次做完。这里刻意**不**自己
    // 摊开那两行：登记面是运行时增删的（提供方在自己的 apply 里注册，宿主不保证它早于本
    // 组件首渲染），而 memo 的依赖里必须有版本号，否则订阅只换来一次重渲染、算的却还是
    // 上一次的登记面——「注册成功了却永远不进徽标」。推导过程与回归用例见
    // `../use-registered-facets.ts`。外部来源的显隐不归本插件管：来源不注册就是不显示。
    const facets = useRegisteredFacets(facetsStore);
    const mainViewId = useMemo(() => mainViewSessionId(list), [list]);
    const current = panelActive ? undefined : mainViewId;
    const revealGroup = revealSessionId === undefined || !workspaceReady
        ? undefined
        : owningGroupKey(workspaces, revealSessionId);
    const [storedWatermarks, setStoredWatermarks] = useState({});
    const [watermarkMotionKey, setWatermarkMotionKey] = useState(0);
    // Transient drag marker state; the selected mode owns the resulting order.
    const [drag, setDrag] = useState(null);
    const sessionDropCommitted = useRef(false);
    const [workspaceDrag, setWorkspaceDrag] = useState(null);
    const workspaceDropCommitted = useRef(false);
    const nativeDragActive = drag !== null || workspaceDrag !== null;
    useNativeDragAcceptance(nativeDragActive);
    const currentGroup = current === undefined || !workspaceReady
        ? undefined
        : owningGroupKey(workspaces, current);
    useEffect(() => {
        if (current === undefined || currentGroup === undefined || Object.hasOwn(groupExpansion, currentGroup))
            return;
        setGroupExpanded(currentGroup, true);
    }, [current, currentGroup, setGroupExpanded, groupExpansion]);
    const parents = useMemo(() => {
        if (!nestWorkspaces)
            return new Map();
        const keysByPath = new Map(workspaces.map(workspace => [workspace.path, workspace.workspaceId]));
        const paths = [...keysByPath.keys()];
        return new Map(workspaces.map((workspace) => {
            const path = owningParentFolder(workspace.path, paths);
            return [workspace.workspaceId, path === undefined ? undefined : keysByPath.get(path)];
        }));
    }, [nestWorkspaces, workspaces]);
    const currentAncestors = useMemo(() => {
        const keys = new Set();
        for (let key = currentGroup === undefined ? undefined : parents.get(currentGroup); key !== undefined; key = parents.get(key)) {
            keys.add(key);
        }
        return keys;
    }, [currentGroup, parents]);
    const expandedGroups = useMemo(() => {
        const ancestorKeys = new Set(parents.values());
        return [...workspaces.map(workspace => workspace.workspaceId), UNGROUPED_KEY]
            .filter(key => groupExpansion[key] ?? ancestorKeys.has(key));
    }, [groupExpansion, parents, workspaces]);
    const groups = useMemo(() => deriveGroups(list, workspaces, rowState, statuses, {
        expandedGroups,
        ungroupedOrder: ungroupedSessionIds,
    }), [list, workspaces, rowState, statuses, expandedGroups, ungroupedSessionIds]);
    useEffect(() => {
        for (let key = revealGroup; key !== undefined; key = parents.get(key)) {
            if (groupExpansion[key] === false || (key === revealGroup && groupExpansion[key] !== true)) {
                setGroupExpanded(key, true);
            }
        }
    }, [groupExpansion, parents, revealGroup, setGroupExpanded]);
    const baselines = new Map(groups.map(group => [
        group.key,
        Math.max(SESSION_WATERMARK_BASE, requiredWatermark(group.expanded ? group.sessions : [], current, group.key === revealGroup ? revealSessionId : undefined)),
    ]));
    const foldedKeys = new Set(groups.filter(group => !group.expanded).map(group => group.key));
    const underFoldedAncestor = (key) => {
        for (let owner = parents.get(key); owner !== undefined; owner = parents.get(owner)) {
            if (foldedKeys.has(owner))
                return true;
        }
        return false;
    };
    const requiredWatermarks = new Map([...baselines].filter(([key]) => !underFoldedAncestor(key)));
    const sessionWatermarks = raiseWatermarks(storedWatermarks, requiredWatermarks);
    if (sessionWatermarks !== storedWatermarks) {
        setStoredWatermarks(marks => raiseWatermarks(marks, requiredWatermarks));
    }
    const dropWatermarks = (drop) => {
        if (!Object.keys(storedWatermarks).some(drop))
            return;
        setStoredWatermarks(marks => Object.fromEntries(Object.entries(marks).filter(([key]) => !drop(key))));
        setWatermarkMotionKey(key => key + 1);
    };
    const withinGroup = (key, root) => {
        for (let owner = key; owner !== undefined; owner = parents.get(owner)) {
            if (owner === root)
                return true;
        }
        return false;
    };
    const now = Date.now();
    const commitSessionDrag = (activeDrag, over) => {
        if (sessionDropCommitted.current)
            return;
        sessionDropCommitted.current = true;
        setDrag(null);
        const group = groups.find(candidate => candidate.key === activeDrag.accountKey);
        if (group === undefined)
            return;
        if (over.id === activeDrag.sessionId)
            return;
        const accountSessionIds = activeDrag.accountKey === UNGROUPED_KEY
            ? ungroupedSessionIds
            : workspaces.find(workspace => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
        if (accountSessionIds === undefined)
            return;
        const renderedSessions = watermarkRows(group.sessions, sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE).rows;
        const nextOrder = sessionDragOrder(accountSessionIds, renderedSessions, activeDrag, over);
        if (nextOrder !== undefined)
            setSessionOrder(activeDrag.accountKey, nextOrder);
    };
    const commitWorkspaceDrag = (activeDrag, over) => {
        if (workspaceDropCommitted.current)
            return;
        workspaceDropCommitted.current = true;
        setWorkspaceDrag(null);
        const owner = parents.get(activeDrag.workspaceId);
        const siblings = workspaces.filter(workspace => parents.get(workspace.workspaceId) === owner);
        const rowIndex = siblings.findIndex(workspace => workspace.workspaceId === over.id);
        if (rowIndex === -1)
            return;
        const anchor = over.half === 'before' ? over.id : siblings[rowIndex + 1]?.workspaceId;
        if (anchor === activeDrag.workspaceId)
            return;
        const sourceIndex = siblings.findIndex(workspace => workspace.workspaceId === activeDrag.workspaceId);
        const anchorIndex = anchor === undefined
            ? siblings.length
            : siblings.findIndex(workspace => workspace.workspaceId === anchor);
        if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1))
            return;
        insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
            console.warn('workspace reorder rejected:', reason);
        });
    };
    // Build tree structure from original groups (for aggregation traversal)
    const childrenByParentForAggregation = useMemo(() => {
        const rendered = new Set(groups.map(group => group.key));
        const children = new Map();
        for (const group of groups) {
            let parent = parents.get(group.key);
            while (parent !== undefined && !rendered.has(parent))
                parent = parents.get(parent);
            const siblings = children.get(parent);
            if (siblings === undefined)
                children.set(parent, [group]);
            else
                siblings.push(group);
        }
        return children;
    }, [groups, parents]);
    // Fork-owned: each group's DIRECT member status — the input to the tree-wide
    // aggregation below. deriveGroups stopped computing liveStatus (PR #10 moved it
    // out), so this map is the aggregator's only data source. Expanded groups are
    // measured too; see directStatusesForGroups.
    const directStatusByGroup = useMemo(() => directStatusesForGroups(groups, facets, now), 
    // `now` 刻意不进依赖：它是渲染期的时钟读数，唯一影响的是"哪些截止还算将来"。
    // 提供方的 store 到点会通知，需要新答案的那次渲染本来就带着新的 `now` 发生。
    [groups, facets]);
    // Multi-level aggregation: a collapsed folder's badge covers its own members plus
    // every descendant group's, at any depth. Every row comes back measured, so the
    // render path can never see an unresolved liveStatus.
    const groupsWithAggregatedStatus = useMemo(() => withAggregatedStatus(groups, directStatusByGroup, childrenByParentForAggregation), [groups, directStatusByGroup, childrenByParentForAggregation]);
    // Rebuild tree structure with aggregated groups (for rendering)
    const childrenByParent = useMemo(() => {
        const rendered = new Set(groupsWithAggregatedStatus.map(group => group.key));
        const children = new Map();
        for (const group of groupsWithAggregatedStatus) {
            // The archived-only view drops empty groups, so an ancestor may be
            // absent; nest under the nearest rendered one.
            let parent = parents.get(group.key);
            while (parent !== undefined && !rendered.has(parent))
                parent = parents.get(parent);
            const siblings = children.get(parent);
            if (siblings === undefined)
                children.set(parent, [group]);
            else
                siblings.push(group);
        }
        return children;
    }, [groupsWithAggregatedStatus, parents]);
    const rootGroups = childrenByParent.get(undefined) ?? [];
    const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== undefined
        && workspaceDrag?.over?.id === rootGroups[0].workspaceId
        && workspaceDrag.over.half === 'before';
    const rowKeys = groupsWithAggregatedStatus.length === 0 ? ['empty'] : [];
    const renderGroup = (group, depth) => {
        const workspaceId = group.workspaceId;
        const children = childrenByParent.get(group.key) ?? [];
        const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
        const watermark = sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE;
        const collapsed = watermarkRows(group.sessions, baselines.get(group.key) ?? SESSION_WATERMARK_BASE);
        const visible = watermarkRows(group.sessions, watermark);
        const sessionsExpanded = visible.hiddenCount === 0;
        rowKeys.push(`workspace:${group.key}`);
        const childRows = group.expanded ? children.map(child => renderGroup(child, depth + 1)) : [];
        const sessions = visible.rows;
        for (const node of sessions)
            rowKeys.push(`session:${node.id}`);
        if (collapsed.hiddenCount > 0)
            rowKeys.push(`overflow:${group.key}`);
        const workspaceMarker = workspaceId !== undefined && workspaceDrag?.over?.id === workspaceId
            ? workspaceDrag.over.half
            : null;
        const workspaceDragProps = workspaceId === undefined ? undefined : {
            start: () => {
                workspaceDropCommitted.current = false;
                setWorkspaceDrag({ workspaceId, over: null });
            },
            end: () => {
                if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) {
                    commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
                }
                else {
                    setWorkspaceDrag(null);
                }
                workspaceDropCommitted.current = false;
            },
        };
        const hoverWorkspace = workspaceId === undefined || !compatibleDrag
            ? undefined
            : (half) => {
                setWorkspaceDrag(active => active === null
                    ? active
                    : { ...active, over: { id: workspaceId, half } });
            };
        const dropWorkspace = workspaceId === undefined || !compatibleDrag
            ? undefined
            : (half) => {
                commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half });
            };
        // group arrives from groupsWithAggregatedStatus: collapsed groups already
        // carry the bottom-up aggregated liveStatus (direct + all descendants).
        return (
        // Group section: header, descendant Workspaces, and own Session rows. The
        // inter-group breathing room is the section's own margin
        // (WorkspaceBrowser.module.css).
        _jsxs("div", { style: { '--dsh-workspace-indent': `${depth * 12}px` }, className: clsx(css.groupSection, workspaceMarker === 'before' && css.workspaceDropBefore, workspaceMarker === 'after' && css.workspaceDropAfter), onDragOver: workspaceDrag === null
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (hoverWorkspace === undefined && parents.get(group.key) !== undefined)
                        return;
                    e.stopPropagation();
                    if (hoverWorkspace === undefined) {
                        e.dataTransfer.dropEffect = 'none';
                        if (workspaceDrag.over !== null)
                            setWorkspaceDrag({ ...workspaceDrag, over: null });
                    }
                    else {
                        e.dataTransfer.dropEffect = 'move';
                        hoverWorkspace(workspaceGroupHalf(e));
                    }
                }, onDrop: workspaceDrag === null
                ? undefined
                : (e) => {
                    e.preventDefault();
                    if (dropWorkspace === undefined && parents.get(group.key) !== undefined)
                        return;
                    e.stopPropagation();
                    if (dropWorkspace === undefined) {
                        workspaceDropCommitted.current = true;
                        setWorkspaceDrag(null);
                    }
                    else {
                        dropWorkspace(workspaceGroupHalf(e));
                    }
                }, children: [_jsx(ProjectRowItem, { newShortcut: shortcuts.find(row => row.id === 'session.new'), group: group, containsCurrentDescendant: currentAncestors.has(group.key), home: home, settings: badgeSettings, renderFactorySlot: renderFactorySlot, now: now, t: t, onToggle: () => {
                        if (group.expanded)
                            dropWatermarks(key => withinGroup(key, group.key));
                        setGroupExpanded(group.key, !group.expanded);
                    }, onCreate: () => {
                        if (group.workspaceId !== undefined) {
                            setGroupExpanded(group.key, true);
                            startSession(group.workspaceId);
                        }
                    }, drag: workspaceDragProps, actions: group.workspaceId === undefined
                        ? undefined
                        : {
                            rename: () => {
                                /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                                if (group.workspaceId !== undefined)
                                    onRenameRequest(group.workspaceId, group.label);
                            },
                            delete: () => {
                                /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                                if (group.workspaceId !== undefined)
                                    onDeleteRequest(group.workspaceId, group.label);
                            },
                        } }), childRows.length > 0 && (_jsx("div", { role: "group", children: childRows })), group.expanded && sessions.map((node) => {
                    // Session drag never leaves its browser-local account, and pinned
                    // rows reorder only within their leading pinned block.
                    const sameGroupDrag = drag !== null && drag.accountKey === group.key;
                    const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
                    const normalizeHalf = (half) => node.blank ? 'after' : half;
                    const dragProps = {
                        start: () => {
                            sessionDropCommitted.current = false;
                            setDrag({ accountKey: group.key, sessionId: node.id, pinned: node.pinned, over: null });
                        },
                        active: compatibleTarget,
                        marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
                        hover: (half) => {
                            /* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
                            setDrag(d => (d === null ? d : {
                                ...d, over: { id: node.id, half: normalizeHalf(half) },
                            }));
                        },
                        drop: (half) => {
                            /* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
                            if (drag === null)
                                return;
                            commitSessionDrag(drag, { id: node.id, half: normalizeHalf(half) });
                        },
                        end: () => {
                            if (drag?.over !== null && drag?.over !== undefined)
                                commitSessionDrag(drag, drag.over);
                            else
                                setDrag(null);
                            sessionDropCommitted.current = false;
                        },
                    };
                    return (_jsx(SessionNodeItem, { node: node, currentId: current, now: now, onOpen: open, onRenameRequest: onSessionRenameRequest, renderSlot: renderSlot, renderFactorySlot: renderFactorySlot, onReveal: node.id === revealSessionId && group.key === revealGroup
                            ? () => { onSessionRevealed(node.id); }
                            : undefined, drag: dragProps, t: t }, node.id));
                }), group.expanded && collapsed.hiddenCount > 0 && (_jsx("button", { type: "button", className: css.sessionOverflowButton, "data-row-key": `overflow:${group.key}`, "aria-expanded": sessionsExpanded, onClick: () => {
                        if (sessionsExpanded) {
                            dropWatermarks(key => key === group.key);
                            return;
                        }
                        setStoredWatermarks(marks => ({
                            ...marks,
                            [group.key]: visible.hiddenCount <= SESSION_WATERMARK_BASE
                                ? Infinity
                                : watermark + SESSION_WATERMARK_BASE,
                        }));
                        setWatermarkMotionKey(key => key + 1);
                    }, children: sessionsExpanded
                        ? t('sessions.collapse')
                        : t('sessions.expand', { n: visible.hiddenCount }) }))] }, group.key));
    };
    const groupRows = rootGroups.map(group => renderGroup(group, 0));
    return (_jsxs(HoverCardGroup, { className: clsx(css.treeBody, css.wide), children: [workspaceDropAtListStart && _jsx("span", { className: css.listTopDropIndicator, "aria-hidden": "true" }), _jsxs(AnimatedRows, { className: clsx(css.list, workspaceDropAtListStart && css.listTopDropActive), label: t('section.sessions'), rowKeys: rowKeys, ready: list.phase === 'ready' && workspaceReady && !nativeDragActive, resetKey: JSON.stringify([animationResetKey, watermarkMotionKey]), children: [groupsWithAggregatedStatus.length === 0 && (_jsx(EmptySessions, { rowState: rowState, onLeaveArchivedOnly: onLeaveArchivedOnly, t: t })), groupRows] }), _jsx("span", { className: css.fade })] }));
}
//# sourceMappingURL=SessionTree.js.map