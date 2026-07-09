import { useEffect, useState } from 'react';

import type { ConnectionStatus } from '@/store';
import type { GameState, PlayerId } from '@/types';

import { computePendingForfeits, type PendingForfeit } from './forfeitTiming';

/**
 * Display-only reconnect countdown for the "opponent reconnecting… Ns" banner.
 *
 * This is purely cosmetic — the *server* (a scheduled Cloud Function) is the
 * sole authority that actually forfeits a disconnected player once their grace
 * period elapses. The client no longer eliminates anyone; it just mirrors the
 * same grace-period math so players see a countdown that matches the eventual
 * server verdict. When the server does forfeit, the authoritative snapshot
 * arrives via the game subscription and ends the match.
 *
 * Keeps ticking while nobody is pending, because a peer's heartbeat going stale
 * (silent network loss) is a time-based condition with no RTDB push to react to.
 * The `setState` below is a no-op (same reference) whenever nothing changed, so
 * it doesn't re-render on every tick.
 *
 * `connection` gates the whole thing: while *my own* connection isn't 'online',
 * every peer's last-known presence is frozen from my point of view, so I have no
 * reliable basis to judge anyone away — see `forfeitTiming.ts`.
 */
export function usePeerDisconnectStatus(
  game: GameState | null,
  myPlayerId: PlayerId | null,
  connection: ConnectionStatus,
): { pendingForfeits: Record<PlayerId, PendingForfeit> } {
  const [pendingForfeits, setPendingForfeits] = useState<Record<PlayerId, PendingForfeit>>({});

  useEffect(() => {
    const tick = () => {
      const pending = computePendingForfeits(game, myPlayerId, Date.now(), connection === 'online');
      setPendingForfeits((prev) =>
        Object.keys(prev).length === 0 && Object.keys(pending).length === 0 ? prev : pending,
      );
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game, myPlayerId, connection]);

  return { pendingForfeits };
}
