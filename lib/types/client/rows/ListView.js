import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** The two wide-only list bodies: the flat single-list view and the search results view. */
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { HoverCardGroup } from '@deepseek-ai/dsh-client-ui-primitives';
import { deriveFlat, deriveSearchResults } from "../tree.js";
import { SearchResultItem, SessionNodeItem } from "./Rows.js";
import { AnimatedRows } from "./AnimatedRows.js";
import { FLAT_SESSION_ORDER_KEY } from "../stores.js";
import css from './WorkspaceBrowser.module.css';
import { mainViewSessionId, sessionDragOrder, useNativeDragAcceptance, } from "./browser-shared.js";
import { EmptySessions } from "./EmptySessions.js";
/** The flat "In one list" body: every session is one draggable top-level row. */
export function FlatList({ list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, open, onSessionRenameRequest, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, renderFactorySlot, t, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const statuses = useSessionStatus(s => s);
    const rows = useMemo(() => deriveFlat(list, sessionIds, rowState, statuses), [list, sessionIds, rowState, statuses]);
    const [drag, setDrag] = useState(null);
    const dropCommitted = useRef(false);
    useNativeDragAcceptance(drag !== null);
    const mainViewId = useMemo(() => mainViewSessionId(list), [list]);
    const currentId = panelActive ? undefined : mainViewId;
    const commitDrag = (activeDrag, over) => {
        if (dropCommitted.current)
            return;
        dropCommitted.current = true;
        setDrag(null);
        const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
        if (nextOrder !== undefined)
            setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
    };
    const now = Date.now();
    return (_jsxs(HoverCardGroup, { className: clsx(css.treeBody, css.wide), children: [_jsxs(AnimatedRows, { className: clsx(css.list, css.flatList), label: t('section.sessions'), rowKeys: rows.length === 0 ? ['empty'] : rows.map(row => `session:${row.id}`), ready: list.phase === 'ready' && workspaceReady && drag === null, resetKey: animationResetKey, children: [rows.length === 0 && (_jsx(EmptySessions, { rowState: rowState, onLeaveArchivedOnly: onLeaveArchivedOnly, t: t })), rows.map((node) => {
                        const active = drag !== null && drag.pinned === node.pinned;
                        const normalizeHalf = (half) => node.blank ? 'after' : half;
                        return (_jsx(SessionNodeItem, { node: node, currentId: currentId, now: now, onOpen: open, onRenameRequest: onSessionRenameRequest, renderSlot: renderSlot, renderFactorySlot: renderFactorySlot, onReveal: node.id === revealSessionId
                                ? () => { onSessionRevealed(node.id); }
                                : undefined, drag: {
                                start: () => {
                                    dropCommitted.current = false;
                                    setDrag({ accountKey: FLAT_SESSION_ORDER_KEY, sessionId: node.id, pinned: node.pinned, over: null });
                                },
                                active,
                                marker: active && drag.over?.id === node.id ? drag.over.half : null,
                                hover: (half) => {
                                    setDrag(current => current === null ? current : {
                                        ...current, over: { id: node.id, half: normalizeHalf(half) },
                                    });
                                },
                                drop: (half) => {
                                    if (drag !== null)
                                        commitDrag(drag, { id: node.id, half: normalizeHalf(half) });
                                },
                                end: () => {
                                    if (drag?.over !== null && drag?.over !== undefined)
                                        commitDrag(drag, drag.over);
                                    else
                                        setDrag(null);
                                    dropCommitted.current = false;
                                },
                            }, t: t }, node.id));
                    })] }), _jsx("span", { className: css.fade })] }));
}
/** Flat search body: local metadata matches plus the current Host result page. */
export function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t, }) {
    const panelActive = usePanelInfo(info => info.activePanelId !== null);
    const list = useSessions(s => s);
    const statuses = useSessionStatus(s => s);
    const currentRemote = remote.query === query
        ? remote
        : { query, status: 'loading', items: [], hasMore: false };
    const results = useMemo(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit]);
    const pending = currentRemote.status === 'loading';
    const mainViewId = useMemo(() => mainViewSessionId(list), [list]);
    const currentId = panelActive ? undefined : mainViewId;
    return (_jsxs("div", { className: clsx(css.treeBody, css.wide), children: [_jsxs("div", { className: css.list, children: [_jsx("div", { className: css.searchTree, role: "tree", "aria-label": t('search.results.aria'), "aria-busy": pending, children: results.items.map(result => (_jsx(SearchResultItem, { result: result, currentId: currentId, onOpen: open, onUnarchive: onUnarchive, t: t }, result.id))) }), pending && (
                    /* Two skeleton rows on an empty list, one when local matches already
                       show and only the content hits are outstanding. */
                    _jsx("div", { role: "status", "aria-label": t('search.pending'), children: (results.items.length === 0 ? [0, 1] : [0]).map(i => (_jsxs("div", { className: css.skeletonRow, "aria-hidden": "true", children: [_jsx("span", { className: css.skeletonDot }), _jsxs("span", { className: css.skeletonBars, children: [_jsx("span", { className: css.skeletonBar }), _jsx("span", { className: clsx(css.skeletonBar, css.skeletonBarWide) })] })] }, i))) })), !pending && results.items.length === 0 && (_jsx("div", { className: css.empty, role: "status", children: t('search.noMatches') })), results.hasMore && (_jsx("div", { className: css.searchStatus, role: "status", children: t('search.hasMore', { n: resultLimit }) }))] }), _jsx("span", { className: css.fade })] }));
}
//# sourceMappingURL=ListView.js.map