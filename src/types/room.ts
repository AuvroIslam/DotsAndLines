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
  createdAt: number;
  updatedAt: number;
}

export interface MatchmakingTicket {
  uid: string;
  displayName: string;
  enqueuedAt: number;
  /** Random matchmaking is fixed to 2 players. */
  boardSize: BoardSize;
}
