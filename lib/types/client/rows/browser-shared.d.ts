import type { SessionListState, SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspaceBrowserProps } from '../contract/slots.ts';
import { type SessionNode, type SessionRowState } from '../tree.ts';
/**
 * Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
 * focus() forces a synchronous layout and would jank the slide.
 */
export declare const EXPAND_SLIDE_MS = 300;
/** Pause between the latest keystroke and a Host content-search request. */
export declare const SEARCH_DEBOUNCE_MS = 250;
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
export declare const SEARCH_QUERY_MAX_CODE_UNITS = 500;
/** Keep controlled input and RPC payload inside the session.search wire contract. */
export declare function sanitizeSearchQuery(value: string): string;
/**
 * Accept the native drag at document level while a row drag is active: row
 * hover still owns the insertion marker, and releasing outside the list must
 * not be rendered as a rejected drop before dragend commits that last marker.
 */
export declare function useNativeDragAcceptance(active: boolean): void;
/** In-flight root-row drag: source identity plus the current insert marker. */
export interface DragState {
    /** Workspace id, or {@link UNGROUPED_KEY} for the browser-local loose-session account. */
    accountKey: string;
    sessionId: SessionNode['id'];
    /** Source row was pinned at drag start; drop targets share the pinned block. */
    pinned: boolean;
    /** Row the marker sits on and which half (insert above/below it). */
    over: {
        id: SessionNode['id'];
        half: 'before' | 'after';
    } | null;
}
/** Apply a visible drop to the complete account without removing hidden members. */
export declare function sessionDragOrder(order: readonly SessionId[], rows: readonly SessionNode[], drag: DragState, over: NonNullable<DragState['over']>): SessionId[] | undefined;
/** In-flight Workspace-row drag: source identity plus the current marker. */
export interface WorkspaceDragState {
    workspaceId: WorkspaceId;
    over: {
        id: WorkspaceId;
        half: 'before' | 'after';
    } | null;
}
/** Resolve an insertion side across the Workspace header, descendants, and Sessions. */
export declare function workspaceGroupHalf(e: {
    clientY: number;
    currentTarget: HTMLElement;
}): 'before' | 'after';
export type SessionTreeProps = Pick<WorkspaceBrowserProps, 'useSessionStatus' | 'startSession' | 'open' | 'renderFactorySlot' | 'insertWorkspaceBefore' | 't' | 'usePanelInfo' | 'useBadgeSettings'> & PropsRenderSlots<'sidebar.workspaces.session.menu.item' | 'sidebar.workspaces.session.row.action' | 'sidebar.session.row.leading' | 'sidebar.session.row.hover'> & {
    shortcuts: readonly import('@deepseek-ai/dsh-client-shortcuts/client').ShortcutCatalogEntry[];
    /** Always-mounted Session list snapshot. */
    list: SessionListState;
    /** Host account home for POSIX hover-path abbreviation. */
    home?: string | undefined;
    /** Workspaces in Host group order with browser-projected Session order. */
    workspaces: readonly WorkspaceView[];
    /** Browser-projected order for Sessions outside every Workspace. */
    ungroupedSessionIds: readonly SessionId[];
    /** Whether the current Workspace stream has a complete Host baseline. */
    workspaceReady: boolean;
    /** Grouping, ordering, and filter changes replace the view without row motion. */
    animationResetKey: string;
    /** Nest Workspaces under their nearest registered ancestors. */
    nestWorkspaces: boolean;
    /** Explicit persisted group expansion, including descendants in tree mode. */
    groupExpansion: Readonly<Record<string, boolean>>;
    /** Persist one Workspace group's expansion. */
    setGroupExpanded: (key: string, expanded: boolean) => void;
    /** Save a drag order and select Manual. */
    setSessionOrder: (accountKey: string, order: readonly string[]) => void;
    /** Registry-global pin and archive sets plus the archived-visibility choice. */
    rowState: SessionRowState;
    /** Switch the archived filter back to the default hide-archived view. */
    onLeaveArchivedOnly: () => void;
    /** Open the browser-owned rename dialog for a real Workspace group. */
    onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void;
    /** Open the browser-owned delete-confirmation dialog for a real Workspace group. */
    onDeleteRequest: (workspaceId: WorkspaceId, currentTitle: string) => void;
    /** Open the rename dialog from a row title double-click. */
    onSessionRenameRequest: (sessionId: SessionNode['id'], currentTitle: string) => void;
    /** One Session chosen from search that must be exposed and scrolled into view. */
    revealSessionId?: SessionId | undefined;
    /** Acknowledge that the chosen Session row has been revealed. */
    onSessionRevealed: (sessionId: SessionId) => void;
};
export interface RemoteSearchState {
    query: string;
    status: 'idle' | 'loading' | 'ready' | 'error';
    items: readonly SessionSearchResultItem[];
    hasMore: boolean;
}
/**
 * Session the main view currently retains, if any.
 *
 * All three list bodies and the shell need this same scan, and `Object.values`
 * allocates a fresh array each time; the call sites memoise it against the list
 * identity rather than re-scanning on every render.
 * @param list - always-mounted Session list snapshot.
 * @returns the retained Session id, or undefined when the main view holds none.
 */
export declare function mainViewSessionId(list: SessionListState): SessionId | undefined;
//# sourceMappingURL=browser-shared.d.ts.map