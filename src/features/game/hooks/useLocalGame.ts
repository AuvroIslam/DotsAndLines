import { useCallback, useState } from 'react';

import { GameManager } from '@/gameEngine';
import type { BoardSize, GameState, Line, PlayerIndex } from '@/types';

export interface LocalPlayer {
  id: string;
  displayName: string;
  color: string;
}

export interface UseLocalGameReturn {
  game: GameState | null;
  makeMove: (line: Line) => void;
  skipTurn: () => void;
  reset: () => void;
  startGame: (size: BoardSize, players: [LocalPlayer, LocalPlayer]) => void;
}

export function useLocalGame(): UseLocalGameReturn {
  const [game, setGame] = useState<GameState | null>(null);

  const startGame = useCallback((size: BoardSize, players: [LocalPlayer, LocalPlayer]) => {
    const state = GameManager.create({
      id: `local-${Date.now()}`,
      mode: 'friend',
      size,
      players: players.map((p, i) => ({
        id: p.id,
        uid: p.id,
        index: i as PlayerIndex,
        displayName: p.displayName,
        color: p.color,
        isConnected: true,
        score: 0,
      })),
    });
    setGame(state);
  }, []);

  const makeMove = useCallback((line: Line) => {
    setGame((prev) => {
      if (!prev) return prev;
      const outcome = GameManager.applyMove(prev, line, prev.currentTurn);
      return outcome.ok ? outcome.state : prev;
    });
  }, []);

  const skipTurn = useCallback(() => {
    setGame((prev) => (prev ? GameManager.skipTurn(prev) : prev));
  }, []);

  const reset = useCallback(() => setGame(null), []);

  return { game, makeMove, skipTurn, reset, startGame };
}
