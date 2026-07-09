import type { Player } from '@/types';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

/**
 * Judges whether a player is currently "away", combining two independent
 * signals so a departure is caught quickly either way:
 *  - `isConnected === false`: RTDB's `onDisconnect` fired — fast, but only
 *    reliable for a graceful close (app killed); a silent network loss can
 *    leave the server's connection-tracking unaware for a long time.
 *  - a stale `lastSeenAt` heartbeat: catches that silent-network-loss case in
 *    bounded time, since it's judged by the *observer's* clock rather than
 *    waiting on the server to notice the dead connection on its own.
 * Both the client-side countdown display and the server-side elimination
 * transaction call this same logic, so they always agree.
 */
export class PresenceChecker {
  static isAway(player: Player, now: number): boolean {
    if (!player.isConnected) return true;
    return player.lastSeenAt != null && now - player.lastSeenAt > HEARTBEAT_STALE_MS;
  }

  /** The instant `player` is considered to have gone away, or null while present. */
  static awaySince(player: Player, now: number): number | null {
    if (!PresenceChecker.isAway(player, now)) return null;
    if (!player.isConnected && player.disconnectedAt != null) return player.disconnectedAt;
    return player.lastSeenAt != null ? player.lastSeenAt + HEARTBEAT_STALE_MS : now;
  }
}
