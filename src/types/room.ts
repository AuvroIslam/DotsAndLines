/**
 * Lobby / room and matchmaking domain types.
 * Rooms live in Realtime Database while waiting; once started they become games.
 */

import type { BoardSize, GameMode, PlayerIndex } from './game';

export type RoomStatus = 'open' | 'starting' | 'in_progress' | 'closed';

export interface RoomMember {
  uid: string;
  displayName: string;
  index: PlayerIndex;
  isReady: boolean;
  isHost: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  /** Short human-friendly join code for custom rooms. */
  code: string;
  hostUid: string;
  mode: GameMode;
  boardSize: BoardSize;
  maxPlayers: 2 | 3 | 4;
  status: RoomStatus;
  members: Record<string, RoomMember>;
  /** Set once the game starts so clients can navigate to it. */
  gameId: string | null;
  /** Friends the host invited; used to clear their `gameInvites` when the room is swept. */
  invitedUids?: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}

/**
 * A game invitation delivered to one friend, at `gameInvites/{toUid}/{roomId}`.
 * A small snapshot (name, code, board) so the notification renders without a
 * profile read; the recipient joins the room or dismisses it.
 */
export interface GameInvite {
  roomId: string;
  code: string;
  fromUid: string;
  fromName: string;
  boardSize: BoardSize;
  createdAt: number;
}

export interface MatchmakingTicket {
  uid: string;
  displayName: string;
  enqueuedAt: number;
  /** Random matchmaking is fixed to 2 players. */
  boardSize: BoardSize;
  /**
   * Quick Match: match any waiting opponent on any board (the server picks the
   * agreed board). Omitted/false means a specific board — pair only with the same
   * size, or with a flexible player. Treated as `false` when absent.
   */
  flexible?: boolean;
}
