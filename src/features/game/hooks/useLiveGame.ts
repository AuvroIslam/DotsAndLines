import { useEffect } from 'react';

import { useGameStore } from '@/store';
import { useAuthStore } from '@/store';
import type { GamePresence, GameState, Line, Player, PlayerId } from '@/types';

export interface LiveGame {
  game: GameState | null;
  /** Live connection state, streamed apart from the game. Cosmetic only. */
  presence: GamePresence;
  myPlayerId: PlayerId | null;
  isMyTurn: boolean;
  currentPlayer: Player | null;
  connection: ReturnType<typeof useGameStore.getState>['connection'];
  pendingLines: Set<string>;
  makeMove: (line: Line) => void;
  forfeit: () => Promise<boolean>;
}

/**
 * Binds a screen to one live game: opens the realtime subscription on mount,
 * tears it down on unmount, and exposes a thin, derived view for rendering.
 * All game rules stay in the engine; all networking stays in the store.
 */
export function useLiveGame(gameId: string): LiveGame {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const storeGame = useGameStore((s) => s.game);
  const presence = useGameStore((s) => s.presence);
  const storeMyPlayerId = useGameStore((s) => s.myPlayerId);
  const connection = useGameStore((s) => s.connection);
  const pendingLines = useGameStore((s) => s.pendingLines);
  const makeMove = useGameStore((s) => s.makeMove);
  const forfeit = useGameStore((s) => s.forfeit);

  useEffect(() => {
    if (!uid) return;
    connect(gameId, uid);
    // Scoped to this game id: if this screen is torn down after the next game has
    // already connected, that teardown must not disconnect the new subscription.
    return () => disconnect(gameId);
  }, [gameId, uid, connect, disconnect]);

  // `connect` runs in an effect, so for one render after navigating between two
  // games the route's `gameId` is already the new one while the store still holds
  // the *previous* game. Handing that mismatch out is not merely a cosmetic flash:
  // a rematch rotates the turn order, so the stale `myPlayerId` is very often a
  // slot that now belongs to the opponent — and the presence write for it is
  // rejected by the security rules (an uncaught PERMISSION_DENIED). Report
  // nothing until the store is actually on the game we were asked for.
  const isCurrent = storeGame?.id === gameId;
  const game = isCurrent ? storeGame : null;
  const myPlayerId = isCurrent ? storeMyPlayerId : null;

  const currentPlayer = game ? (game.players[game.currentTurn] ?? null) : null;
  const isMyTurn =
    !!game && !!myPlayerId && game.currentTurn === myPlayerId && game.phase === 'playing';

  return {
    game,
    presence,
    myPlayerId,
    isMyTurn,
    currentPlayer,
    connection,
    pendingLines,
    makeMove: (line) => void makeMove(line),
    forfeit,
  };
}
