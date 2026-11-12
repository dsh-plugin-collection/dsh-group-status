import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { WorkspaceBrowserProps } from '../contract/slots.ts';
import { type ArchivedFilter, type SessionNode } from '../tree.ts';
import { type RemoteSearchState, type SessionTreeProps } from './browser-shared.ts';
/** The flat "In one list" body: every session is one draggable top-level row. */
export declare function FlatList({ list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, open, onSessionRenameRequest, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, renderFactorySlot, t, }: Pick<SessionTreeProps, 'useSessionStatus' | 'open' | 'onSessionRenameRequest' | 'renderSlot' | 'renderFactorySlot' | 'usePanelInfo' | 'setSessionOrder' | 'workspaceReady' | 'animationResetKey' | 'revealSessionId' | 'onSessionRevealed' | 'rowState' | 'onLeaveArchivedOnly' | 't'> & {
    list: SessionListState;
    sessionIds: readonly SessionId[];
}): import("react").JSX.Element;
/** Flat search body: local metadata matches plus the current Host result page. */
export declare function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t, }: Pick<WorkspaceBrowserProps, 'useSessions' | 'useSessionStatus' | 'open' | 't' | 'usePanelInfo'> & {
    workspaces: readonly WorkspaceView[];
    archivedSessionIds: readonly SessionNode['id'][];
    /** Search matches follow the archived filter selected for the list. */
    archivedFilter: ArchivedFilter;
    /** Unarchive an archived result row in place. */
    onUnarchive: (id: SessionNode['id']) => void;
    query: string;
    remote: RemoteSearchState;
    resultLimit: number;
}): import("react").JSX.Element;
//# sourceMappingURL=ListView.d.ts.map