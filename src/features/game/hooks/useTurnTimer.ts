import { useEffect, useRef, useState } from 'react';

import { gameFunctions } from '@/services/firebase';
import type { GameState } from '@/types';

/**
 * Derives the live countdown for the active turn and asks the server to apply
 * the timeout once it expires.
 *
 * *Any* player may make that request — not just whoever's turn it is. That's the
 * whole point: when the active player is the one who dropped, they are precisely
 * the client who can't ask, so their opponent has to be able to, or the game
 * would sit forever waiting on someone who isn't there. It's safe to open up
 * because the server re-checks the deadline against its own clock, so no client
 * can rush the timer; the worst a spurious call can do is nothing.
 */
export function useTurnTimer(game: GameState | null) {
  const [remainingMs, setRemainingMs] = useState(0);
  const timeoutFired = useRef<string | null>(null);

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
      if (remaining === 0 && timeoutFired.current !== turnKey) {
        timeoutFired.current = turnKey;
        void gameFunctions.timeoutTurn(game.id);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game]);

  const totalMs = game?.turnDurationMs ?? 1;
  return { remainingMs, fraction: Math.max(0, Math.min(1, remainingMs / totalMs)) };
}
