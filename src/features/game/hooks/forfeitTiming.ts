import { PresenceChecker } from '@/gameEngine';
import type { GameState, PlayerId } from '@/types';
import { RECONNECT_MAX_DELAY_MS } from '@/utils/constants';

export interface PendingForfeit {
  /** When this player was judged away — the grace period counts down from here. */
  disconnectedAt: number;
  remainingMs: number;
}

/**
 * Which peers (not me) are currently away-but-not-yet-eliminated, and how
 * long until their grace period elapses. Pure so the countdown math is
 * testable without mocking timers or Firebase.
 *
 * `isMyConnectionHealthy` must be false-y while *my own* connection is down.
 * Once I lose network, I stop receiving fresh proof that anyone else is still
 * around — their last-synced snapshot just sits there while my own clock
 * keeps advancing, which would otherwise make every peer look like they'd
 * gone stale purely because I can't hear from them, not because they left.
 * Without this guard, a real disconnect on either side makes *both* devices
 * independently conclude the other one is gone.
 */
export function computePendingForfeits(
  game: GameState | null,
  myPlayerId: PlayerId | null,
  now: number,
  isMyConnectionHealthy: boolean,
): Record<PlayerId, PendingForfeit> {
  const out: Record<PlayerId, PendingForfeit> = {};
  if (!game || game.phase !== 'playing' || !isMyConnectionHealthy) return out;

  for (const id of game.turnOrder) {
    if (id === myPlayerId) continue;
    const p = game.players[id];
    if (!p || p.isEliminated) continue;
    const awaySince = PresenceChecker.awaySince(p, now);
    if (awaySince == null) continue;
    out[id] = {
      disconnectedAt: awaySince,
      remainingMs: Math.max(0, awaySince + RECONNECT_MAX_DELAY_MS - now),
    };
  }
  return out;
}
