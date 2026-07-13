import { useEffect, useState } from 'react';

import type { ConnectionStatus } from '@/store';
import type { GameState, PlayerId } from '@/types';

import { computeAwayPeers } from './awayPeers';

/**
 * Which opponents to show as "reconnecting…". Display only — an away player is
 * never forfeited for being away; they just miss turns, and the server ends the
 * match once someone has missed enough of them. So this hook decides nothing,
 * and there is deliberately no countdown to show: how long an absent player has
 * left is a function of the turn clock, not of their connection.
 *
 * Keeps ticking even while nobody is away, because a peer's heartbeat going
 * stale (a silent network loss) is a purely time-based condition with no RTDB
 * push to react to. The state update below returns the previous array when
 * nothing changed, so this doesn't re-render on every tick.
 */
export function usePeerDisconnectStatus(
  game: GameState | null,
  myPlayerId: PlayerId | null,
  connection: ConnectionStatus,
): { awayPeers: PlayerId[] } {
  const [awayPeers, setAwayPeers] = useState<PlayerId[]>([]);

  useEffect(() => {
    const tick = () => {
      const next = computeAwayPeers(game, myPlayerId, Date.now(), connection === 'online');
      setAwayPeers((prev) =>
        prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next,
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [game, myPlayerId, connection]);

  return { awayPeers };
}
