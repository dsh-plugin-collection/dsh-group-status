import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The workspace/session browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + view options + add
 * workspace), search, the grouped tree or flat list, and the workspace
 * dialogs. Wide state renders the full browser; rail state renders the two
 * region icons (search / add workspace) as 36px controls on the shell's shared
 * rail entry path, each requesting expansion through the owner share. Adding
 * is the header button's one action, so it raises the directory flow with no
 * menu in between; the flow and its error dialog live in WorkspacePicker
 * (same package — direct composition, no slot between them). A Session row's
 * "..." menu and hover buttons are the `sidebar.workspaces.session.menu.item`
 * and `sidebar.workspaces.session.row.action` lists rendered through this
 * entry's `renderSlot`; the actions in them, this package's own included,
 * are slot entries with their own behavior, so this component threads no
 * action callbacks and hosts no action surface.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button, IconCloseFillRegular, IconProjectAddOutlineRegular, IconSearchOutlineRegular, Modal, Tooltip, } from '@deepseek-ai/dsh-client-ui-primitives';
import { workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace';
import { orderByRecency, pinCurrentBlank, reconcileManualOrder, sessionMemberIds, UNGROUPED_KEY, } from "../tree.js";
import { FLAT_SESSION_ORDER_KEY } from "../stores.js";
import { WorkspacePickFlow } from "../WorkspacePicker.js";
import css from './WorkspaceBrowser.module.css';
import { EXPAND_SLIDE_MS, SEARCH_DEBOUNCE_MS, SEARCH_QUERY_MAX_CODE_UNITS, mainViewSessionId, sanitizeSearchQuery, } from "./browser-shared.js";
import { ViewOptionsMenu } from "./ViewOptionsMenu.js";
import { SessionTree } from "./SessionTree.js";
import { FlatList, SearchResults } from "./ListView.js";
export function WorkspaceBrowser({ wide, usePanelInfo, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession, open, requestSessionRename, notifyArchivedNotOpenable, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, unarchiveSession, createWorkspace, searchSessions, searchResultLimit, useDirectoryFlow, useHostInfo, useShortcuts, useWorkspaceShortcuts, useBadgeSettings, requestSearch, requestAddWorkspace, closeAddWorkspace, setDirectoryBusy, renderSlot, renderFactorySlot, t, }) {
    const home = useHostInfo(info => info.home);
    const shortcuts = useShortcuts(rows => rows);
    const searchShortcut = shortcuts.find(row => row.id === 'session.search');
    const addShortcut = shortcuts.find(row => row.id === 'workspace.add');
    const shortcutState = useWorkspaceShortcuts(state => state);
    // Ordering remains live while the rail or search replaces the list body.
    const list = useSessions(state => state);
    const storedWorkspaces = useWorkspaces(state => state.items);
    // The resolved name, not `t`, is the memo dependency: the bound seat keeps
    // its identity across a language switch.
    const defaultWorkspaceName = t('workspace.defaultName');
    const workspaces = useMemo(() => storedWorkspaces.map(workspace => ({
        ...workspace,
        title: workspaceDisplayTitle(workspace.title, defaultWorkspaceName),
    })), [storedWorkspaces, defaultWorkspaceName]);
    const workspacePhase = useWorkspaces(state => state.phase);
    const workspaceStreamState = useWorkspaces(state => state.state);
    const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds);
    const pinnedSessionIds = useWorkspaces(state => state.pinnedSessionIds);
    // Live occupancy of this surface's directory-flow hole (the same source the
    // flow reads): a composition without a picking affordance can add nothing.
    const directoryFlowAvailable = useDirectoryFlow(occupied => occupied);
    const groupBy = useStore(s => s.groupBy);
    const orderBy = useStore(s => s.orderBy);
    // Persisted view blobs written before the archived filter existed rehydrate
    // without the field; they read as the default hide-archived view.
    const archivedFilter = useStore(s => s.archivedFilter ?? 'default');
    const groupExpansion = useStore(s => s.groupExpansion);
    const sessionOrderByAccount = useStore(s => s.sessionOrderByAccount);
    // Archived sessions are not openable: the row stays visible under the
    // filter but a click explains instead of navigating.
    const guardedOpen = (sessionId) => {
        if (archivedSessionIds.includes(sessionId)) {
            notifyArchivedNotOpenable();
            return;
        }
        open(sessionId);
    };
    const leaveArchivedOnly = () => { actions.setArchivedFilter('default'); };
    const workspaceReady = workspacePhase === 'ready' && workspaceStreamState !== 'loading';
    const mainSessionId = useMemo(() => mainViewSessionId(list), [list]);
    const currentBlank = mainSessionId !== undefined && list.byId[mainSessionId]?.blank === true
        ? mainSessionId
        : undefined;
    const ungroupedMemberIds = useMemo(() => {
        const accounted = new Set(workspaces.flatMap(workspace => workspace.sessionIds));
        return list.ids.filter(id => list.byId[id] !== undefined && !accounted.has(id));
    }, [list, workspaces]);
    const orderState = useMemo(() => ({ pinnedSessionIds, archivedSessionIds }), [archivedSessionIds, pinnedSessionIds]);
    const rowState = useMemo(() => ({ ...orderState, archivedFilter }), [orderState, archivedFilter]);
    const flatMemberIds = useMemo(() => sessionMemberIds(list), [list]);
    const orderedWorkspaces = useMemo(() => workspaces.map((workspace) => {
        const memberIds = workspace.sessionIds;
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(memberIds, list.byId)
            : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
        return {
            ...workspace,
            sessionIds: pinCurrentBlank(baseOrder, currentBlank !== undefined && memberIds.includes(currentBlank) ? currentBlank : undefined),
        };
    }), [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, workspaces]);
    const orderedUngroupedSessionIds = useMemo(() => {
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(ungroupedMemberIds, list.byId)
            : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[UNGROUPED_KEY], list.byId, orderState);
        return pinCurrentBlank(baseOrder, currentBlank !== undefined && ungroupedMemberIds.includes(currentBlank) ? currentBlank : undefined);
    }, [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, ungroupedMemberIds]);
    const orderedFlatSessionIds = useMemo(() => {
        const baseOrder = orderBy === 'updated'
            ? orderByRecency(flatMemberIds, list.byId)
            : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState);
        return pinCurrentBlank(baseOrder, currentBlank !== undefined && flatMemberIds.includes(currentBlank) ? currentBlank : undefined);
    }, [currentBlank, flatMemberIds, list.byId, orderBy, orderState, sessionOrderByAccount]);
    const activeSessionOrders = useMemo(() => Object.fromEntries([
        ...orderedWorkspaces.map(workspace => [workspace.workspaceId, workspace.sessionIds]),
        [UNGROUPED_KEY, orderedUngroupedSessionIds],
        [FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds],
    ]), [orderedFlatSessionIds, orderedUngroupedSessionIds, orderedWorkspaces]);
    useEffect(() => {
        if (workspacePhase !== 'ready')
            return;
        actions.retainAccountKeys([
            UNGROUPED_KEY,
            FLAT_SESSION_ORDER_KEY,
            ...workspaces.map(workspace => workspace.workspaceId),
        ]);
    }, [actions.retainAccountKeys, workspacePhase, workspaces]);
    useEffect(() => {
        if (list.phase !== 'ready' || workspaceReady || orderBy !== 'manual' || currentBlank === undefined)
            return;
        // A first prompt can end blank pinning before the Workspace baseline arrives.
        // Preserve saved members until that baseline can establish departures.
        const changed = {};
        for (const [key, ids] of Object.entries(activeSessionOrders)) {
            if (key !== FLAT_SESSION_ORDER_KEY && workspacePhase !== 'ready')
                continue;
            const saved = sessionOrderByAccount[key] ?? [];
            if (ids[0] !== currentBlank || saved[0] === currentBlank)
                continue;
            changed[key] = [currentBlank, ...saved.filter(id => id !== currentBlank)];
        }
        if (Object.keys(changed).length > 0)
            actions.syncSessionOrders(changed);
    }, [
        actions.syncSessionOrders,
        activeSessionOrders,
        currentBlank,
        list.phase,
        orderBy,
        sessionOrderByAccount,
        workspacePhase,
        workspaceReady,
    ]);
    useEffect(() => {
        if (list.phase !== 'ready' || !workspaceReady || orderBy !== 'manual' || currentBlank === undefined)
            return;
        const moved = Object.entries(activeSessionOrders).some(([key, ids]) => ids[0] === currentBlank && sessionOrderByAccount[key]?.[0] !== currentBlank);
        if (moved)
            actions.syncSessionOrders(activeSessionOrders);
    }, [
        actions.syncSessionOrders,
        activeSessionOrders,
        currentBlank,
        list.phase,
        orderBy,
        sessionOrderByAccount,
        workspaceReady,
    ]);
    const saveSessionOrder = (accountKey, order) => {
        actions.setSessionOrder(accountKey, order, activeSessionOrders);
    };
    // The query outlives the tree and the input (both wide-only) so collapsing
    // does not silently drop an in-progress filter.
    const [query, setQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [revealSessionId, setRevealSessionId] = useState(undefined);
    const normalizedQuery = sanitizeSearchQuery(query).trim();
    const [remoteSearch, setRemoteSearch] = useState({
        query: '',
        status: 'idle',
        items: [],
        hasMore: false,
    });
    const searchRoot = useRef(null);
    const searchInput = useRef(null);
    // Section-header ＋ opens the picker menu (same popover in wide and rail
    // states; the menu anchors on this button).
    const wsPickerOpen = shortcutState.addRequested;
    const wsPlusRef = useRef(null);
    const composingRef = useRef(false);
    const openSearchResult = (sessionId) => {
        if (archivedSessionIds.includes(sessionId)) {
            notifyArchivedNotOpenable();
            return;
        }
        setRevealSessionId(sessionId);
        setQuery('');
        setSearchExpanded(false);
        open(sessionId);
    };
    const acknowledgeSessionReveal = (sessionId) => {
        setRevealSessionId(current => current === sessionId ? undefined : current);
    };
    useEffect(() => {
        if (normalizedQuery !== '')
            setRevealSessionId(undefined);
    }, [normalizedQuery]);
    // Rail search = expand + land in the search box: the flag arms before the
    // expand request; once the shell flips wide the input mounts and takes focus.
    const [searchOnExpand, setSearchOnExpand] = useState(false);
    useEffect(() => {
        if (wide && searchOnExpand) {
            const timer = window.setTimeout(() => {
                searchInput.current?.focus({ preventScroll: true });
                setSearchOnExpand(false);
            }, EXPAND_SLIDE_MS);
            return () => { window.clearTimeout(timer); };
        }
    }, [wide, searchOnExpand]);
    useEffect(() => {
        if (shortcutState.searchRequest === 0)
            return;
        closeAddWorkspace();
        setSearchExpanded(true);
        if (!wide) {
            setSearchOnExpand(true);
            expandSidebar();
        }
        else
            searchInput.current?.focus({ preventScroll: true });
    }, [shortcutState.searchRequest]);
    useEffect(() => {
        if (!wide || !searchExpanded || searchOnExpand)
            return;
        searchInput.current?.focus({ preventScroll: true });
    }, [wide, searchExpanded, searchOnExpand]);
    // Outside-click dismissal stays off while the rail gesture is in flight
    // (searchOnExpand): the rail click flips the shell wide and mounts this
    // listener during its own dispatch, then keeps bubbling to document with
    // the now-unmounted rail button as its target — outside searchRoot, so the
    // listener would dismiss the search that click just opened.
    useEffect(() => {
        if (!wide || !searchExpanded || searchOnExpand)
            return;
        const onClick = (event) => {
            if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true)
                return;
            searchInput.current?.blur();
            if (normalizedQuery !== '')
                return;
            setSearchExpanded(false);
        };
        document.addEventListener('click', onClick);
        return () => { document.removeEventListener('click', onClick); };
    }, [normalizedQuery, wide, searchExpanded, searchOnExpand]);
    useEffect(() => {
        if (normalizedQuery === '') {
            setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false });
            return;
        }
        const controller = new AbortController();
        setRemoteSearch({
            query: normalizedQuery,
            status: 'loading',
            items: [],
            hasMore: false,
        });
        const timer = window.setTimeout(() => {
            searchSessions(normalizedQuery, controller.signal).then((result) => {
                if (controller.signal.aborted)
                    return;
                setRemoteSearch({
                    query: normalizedQuery,
                    status: 'ready',
                    items: result.items,
                    hasMore: result.hasMore,
                });
            }).catch(() => {
                if (controller.signal.aborted)
                    return;
                setRemoteSearch({
                    query: normalizedQuery,
                    status: 'error',
                    items: [],
                    hasMore: false,
                });
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [normalizedQuery, searchSessions]);
    // Rename dialog (browser-owned so it outlives row unmounts during collapse).
    // The stored title decides whether confirming is a real rename; the draft is
    // seeded with the label on screen. They differ for a Workspace still
    // carrying its automatic title, so confirming the prefill pins that name.
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [renameError, setRenameError] = useState(null);
    const renameTrimmed = renameDraft.trim();
    // Self is excluded by identity, not by title: the draft is seeded with the
    // localized label, which for an automatically titled Workspace equals its
    // own displayed title without being a conflict with itself.
    const renameDuplicate = renameTarget !== null && renameTrimmed !== ''
        && workspaces.some(w => w.workspaceId !== renameTarget.workspaceId && w.title === renameTrimmed);
    const renameBlocked = renaming || renameTrimmed === ''
        || renameTarget === null || renameTrimmed === renameTarget.storedTitle || renameDuplicate;
    const closeRename = () => {
        if (renaming)
            return;
        setRenameTarget(null);
        setRenameError(null);
    };
    const confirmRename = () => {
        if (renameBlocked)
            return;
        setRenaming(true);
        setRenameError(null);
        renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
            setRenaming(false);
            setRenameTarget(null);
        }).catch((reason) => {
            setRenaming(false);
            setRenameError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    // The search results' restore button; the row actions own the rest of the
    // Session verbs as slot entries.
    const onSessionUnarchive = (sessionId) => {
        unarchiveSession(sessionId).catch((reason) => {
            console.warn('session unarchive rejected:', reason);
        });
    };
    // Delete dialog is separate from the row so a successful removal can
    // unmount that row without tearing down the in-flight confirmation state.
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteCommittedId, setDeleteCommittedId] = useState(null);
    const [deleteError, setDeleteError] = useState(null);
    useEffect(() => {
        if (deleteCommittedId === null
            || workspaces.some(workspace => workspace.workspaceId === deleteCommittedId))
            return;
        setDeleting(false);
        setDeleteCommittedId(null);
        setDeleteTarget(null);
    }, [deleteCommittedId, workspaces]);
    const closeDelete = () => {
        if (deleting)
            return;
        setDeleteTarget(null);
        setDeleteError(null);
    };
    const confirmDelete = () => {
        /* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
        if (deleting || deleteTarget === null)
            return;
        setDeleting(true);
        setDeleteCommittedId(null);
        setDeleteError(null);
        deleteWorkspace(deleteTarget.workspaceId).then(() => {
            // Keep the confirmation pending until this component has rendered the
            // committed list projection without the deleted id. Closing earlier
            // exposes one stale React frame to the next Create Workspace gesture.
            setDeleteCommittedId(deleteTarget.workspaceId);
        }).catch((reason) => {
            setDeleting(false);
            setDeleteError(reason instanceof Error ? reason.message : String(reason));
        });
    };
    return (_jsxs("div", { className: clsx(css.root, !wide && css.rail), children: [_jsxs("div", { className: css.sectionHeader, children: [wide && (_jsx("span", { className: clsx(css.sectionLabel, css.wide, searchExpanded && css.sectionLabelHidden), children: groupBy === 'flat' ? t('section.sessions') : t('section.workspaces') })), wide && (_jsx("div", { className: clsx(css.searchSlot, searchExpanded && css.searchSlotExpanded), children: _jsxs("div", { ref: searchRoot, className: clsx(css.search, searchExpanded && css.searchExpanded), onClick: () => {
                                closeAddWorkspace();
                                setSearchExpanded(true);
                                searchInput.current?.focus();
                            }, children: [_jsx(Tooltip, { label: t('search'), shortcutKeys: searchShortcut?.keys, side: "bottom", delayMs: 500, disabled: searchExpanded, children: _jsx("button", { type: "button", className: css.searchButton, "aria-label": t('search.sessions.aria'), "aria-keyshortcuts": searchShortcut?.aria, "aria-expanded": searchExpanded, onClick: () => {
                                            requestSearch();
                                        }, children: _jsx(IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 }) }) }), _jsx("input", { ref: searchInput, className: css.searchInput, type: "text", placeholder: t('search.placeholder'), maxLength: SEARCH_QUERY_MAX_CODE_UNITS, value: query, tabIndex: searchExpanded ? 0 : -1, onChange: (e) => { setQuery(sanitizeSearchQuery(e.target.value)); }, onKeyDown: (e) => {
                                        if (e.key !== 'Escape')
                                            return;
                                        setQuery('');
                                        setSearchExpanded(false);
                                    } }), searchExpanded && (_jsx("button", { type: "button", className: css.clearButton, "aria-label": t('search.clear'), onClick: (e) => {
                                        e.stopPropagation();
                                        setQuery('');
                                        setSearchExpanded(false);
                                    }, children: _jsx(IconCloseFillRegular, {}) }))] }) })), _jsxs("div", { className: clsx(css.headerActions, wide && searchExpanded && css.headerActionsHidden), children: [wide && (_jsx(ViewOptionsMenu, { groupBy: groupBy, orderBy: orderBy, archivedFilter: archivedFilter, onGroupPick: actions.setGroupBy, onOrderPick: (mode) => { actions.setOrderBy(mode, activeSessionOrders); }, onArchivedFilterPick: actions.setArchivedFilter, t: t })), directoryFlowAvailable && (_jsx(Tooltip, { label: t('workspace.add'), shortcutKeys: addShortcut?.keys, side: "bottom", delayMs: 500, children: _jsx("button", { ref: wsPlusRef, type: "button", className: css.iconButton, "aria-label": t('workspace.add'), "aria-keyshortcuts": addShortcut?.aria, onClick: () => {
                                        requestAddWorkspace();
                                    }, children: _jsx(IconProjectAddOutlineRegular, { size: wide ? 16 : 18 }) }) }))] }), _jsx(WorkspacePickFlow, { t: t, open: wsPickerOpen, anchorRef: wsPlusRef, useWorkspaces: useWorkspaces, createWorkspace: createWorkspace, useDirectoryFlow: useDirectoryFlow, renderDirectoryFlow: owner => renderSlot('sidebar.workspaces.directoryFlow', owner), addOnly: true, onBusyChange: setDirectoryBusy, side: "right", onPick: (workspaceId) => {
                            closeAddWorkspace();
                            startSession(workspaceId, { clearPreviousDraft: false });
                        }, onClose: () => { closeAddWorkspace(); } })] }), !wide && _jsx("div", { className: css.search, children: _jsx(Tooltip, { label: t('search'), shortcutKeys: searchShortcut?.keys, children: _jsx("button", { type: "button", className: css.searchButton, "aria-label": t('search.sessions.aria'), "aria-keyshortcuts": searchShortcut?.aria, onClick: () => {
                            requestSearch();
                        }, children: _jsx(IconSearchOutlineRegular, { size: 18 }) }) }) }), _jsx("div", { className: css.listArea, children: wide && (normalizedQuery !== ''
                    ? (_jsx(SearchResults, { usePanelInfo: usePanelInfo, useSessions: useSessions, useSessionStatus: useSessionStatus, open: openSearchResult, onUnarchive: onSessionUnarchive, workspaces: workspaces, archivedSessionIds: archivedSessionIds, archivedFilter: archivedFilter, query: normalizedQuery, remote: remoteSearch, resultLimit: searchResultLimit, t: t }))
                    : groupBy === 'flat'
                        ? (_jsx(FlatList, { usePanelInfo: usePanelInfo, list: list, sessionIds: orderedFlatSessionIds, rowState: rowState, onLeaveArchivedOnly: leaveArchivedOnly, workspaceReady: workspaceReady, animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`, useSessionStatus: useSessionStatus, open: guardedOpen, onSessionRenameRequest: requestSessionRename, renderSlot: renderSlot, renderFactorySlot: renderFactorySlot, setSessionOrder: saveSessionOrder, revealSessionId: revealSessionId, onSessionRevealed: acknowledgeSessionReveal, t: t }))
                        : (_jsx(SessionTree, { usePanelInfo: usePanelInfo, useBadgeSettings: useBadgeSettings, list: list, shortcuts: shortcuts, useSessionStatus: useSessionStatus, onSessionRenameRequest: requestSessionRename, renderSlot: renderSlot, renderFactorySlot: renderFactorySlot, workspaces: orderedWorkspaces, ungroupedSessionIds: orderedUngroupedSessionIds, workspaceReady: workspaceReady, nestWorkspaces: groupBy === 'workspace-tree', animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`, groupExpansion: groupExpansion, setGroupExpanded: actions.setGroupExpanded, setSessionOrder: saveSessionOrder, rowState: rowState, onLeaveArchivedOnly: leaveArchivedOnly, startSession: startSession, open: guardedOpen, insertWorkspaceBefore: insertWorkspaceBefore, revealSessionId: revealSessionId, onSessionRevealed: acknowledgeSessionReveal, home: home, t: t, onRenameRequest: (workspaceId, displayTitle) => {
                                setRenameTarget({
                                    workspaceId,
                                    storedTitle: storedWorkspaces.find(w => w.workspaceId === workspaceId)?.title ?? displayTitle,
                                });
                                setRenameDraft(displayTitle);
                                setRenameError(null);
                            }, onDeleteRequest: (workspaceId, title) => {
                                setDeleteTarget({ workspaceId, title });
                                setDeleteError(null);
                            } }))) }), _jsxs(Modal, { open: renameTarget !== null, onClose: closeRename, closeLabel: t('close'), title: t('rename.workspace.title'), footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: renaming, onClick: closeRename, children: t('cancel') }), _jsx(Button, { variant: "primary", disabled: renameBlocked, onClick: confirmRename, children: t('rename') })] })), children: [_jsx("input", { className: css.renameInput, value: renameDraft, "aria-label": t('field.workspaceName'), "data-modal-autofocus": true, disabled: renaming, onFocus: (e) => { e.target.select(); }, onChange: (e) => { setRenameDraft(e.target.value); setRenameError(null); }, onCompositionStart: () => { composingRef.current = true; }, onCompositionEnd: () => { composingRef.current = false; }, onKeyDown: (e) => {
                            if (e.key === 'Enter' && !composingRef.current) {
                                e.preventDefault();
                                confirmRename();
                            }
                        } }), renameDuplicate && (_jsx("div", { className: css.renameError, role: "alert", children: t('conflict.named', { name: renameTrimmed }) })), renameError !== null && _jsx("div", { className: css.renameError, role: "alert", children: renameError })] }), _jsxs(Modal, { open: deleteTarget !== null, onClose: closeDelete, closeLabel: t('close'), title: t('delete.workspace'), ...deleteTarget === null
                    ? {}
                    : { description: t('delete.desc', { name: deleteTarget.title }) }, footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", disabled: deleting, onClick: closeDelete, children: t('cancel') }), _jsx(Button, { variant: "outline", className: css.deleteAction, disabled: deleting, onClick: confirmDelete, children: t('delete.workspace') })] })), children: [deleting && _jsx("div", { className: css.deleteStatus, role: "status", children: t('delete.pending') }), deleteError !== null && _jsx("div", { className: css.renameError, role: "alert", children: deleteError })] })] }));
}
//# sourceMappingURL=WorkspaceBrowser.js.map