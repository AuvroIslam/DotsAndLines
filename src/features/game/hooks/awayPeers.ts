import { PresenceChecker } from '@/gameEngine';
import type { GameState, PlayerId } from '@/types';

/**
 * Which peers (not me) currently look away, for the "reconnecting…" banner.
 *
 * This is *cosmetic only*. Nothing here decides a result: an away player is
 * never forfeited for being away — they simply miss their turns, and the server
 * eliminates them once they've missed enough in a row (see `GameManager`). So
 * this is purely "who should we show as reconnecting", and a wrong answer costs
 * nothing but a misleading banner.
 *
 * `isMyConnectionHealthy` must be false-y while *my own* connection is down.
 * Once I lose network I stop receiving fresh proof that anyone else is still
 * around — their last-synced snapshot just sits there while my own clock keeps
 * advancing, which would otherwise make every peer look away purely because I
 * can't hear from them.
 */
export function computeAwayPeers(
  game: GameState | null,
  myPlayerId: PlayerId | null,
  now: number,
  isMyConnectionHealthy: boolean,
): PlayerId[] {
  if (!game || game.phase !== 'playing' || !isMyConnectionHealthy) return [];

  return game.turnOrder.filter((id) => {
    if (id === myPlayerId) return false;
    const p = game.players[id];
    if (!p || p.isEliminated) return false;
    return PresenceChecker.isAway(p, now);
  });
}
