import { useEffect } from 'react';

import { useGameStore } from '@/store';
import { useAuthStore } from '@/store';
import type { GameState, Line, Player, PlayerId } from '@/types';

export interface LiveGame {
  game: GameState | null;
  myPlayerId: PlayerId | null;
  isMyTurn: boolean;
  currentPlayer: Player | null;
  connection: ReturnType<typeof useGameStore.getState>['connection'];
  pendingLines: Set<string>;
  makeMove: (line: Line) => void;
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
  const game = useGameStore((s) => s.game);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const connection = useGameStore((s) => s.connection);
  const pendingLines = useGameStore((s) => s.pendingLines);
  const makeMove = useGameStore((s) => s.makeMove);

  useEffect(() => {
    if (!uid) return;
    connect(gameId, uid);
    return () => disconnect();
  }, [gameId, uid, connect, disconnect]);

  const currentPlayer = game ? (game.players[game.currentTurn] ?? null) : null;
  const isMyTurn =
    !!game && !!myPlayerId && game.currentTurn === myPlayerId && game.phase === 'playing';

  return {
    game,
    myPlayerId,
    isMyTurn,
    currentPlayer,
    connection,
    pendingLines,
    makeMove: (line) => void makeMove(line),
  };
}
