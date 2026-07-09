import { useEffect, useRef, useState } from 'react';

import { gameFunctions } from '@/services/firebase';
import type { GameState } from '@/types';

/**
 * Derives the live countdown for the active turn and auto-skips when it expires.
 * Only the *current* player's client requests the skip; the server re-validates
 * the turn deadline against its own clock before advancing, so the timer can't
 * be raced early by any client.
 */
export function useTurnTimer(game: GameState | null, isMyTurn: boolean) {
  const [remainingMs, setRemainingMs] = useState(0);
  const skipFired = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.phase !== 'playing') {
      setRemainingMs(0);
      return;
    }
    const deadline = game.turnStartedAt + game.turnDurationMs;
    const turnKey = `${game.currentTurn}:${game.turnStartedAt}`;

    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0 && isMyTurn && skipFired.current !== turnKey) {
        skipFired.current = turnKey;
        void gameFunctions.skipTurn(game.id);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game, isMyTurn]);

  const totalMs = game?.turnDurationMs ?? 1;
  return { remainingMs, fraction: Math.max(0, Math.min(1, remainingMs / totalMs)) };
}
