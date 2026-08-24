import type { PlayerPresence } from '@/types';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

/**
 * Judges whether a player currently looks "away", combining two independent
 * signals so a departure is spotted quickly either way:
 *  - `isConnected === false`: RTDB's `onDisconnect` fired — fast, but only
 *    reliable for a graceful close (app killed); a silent network loss can
 *    leave the server's connection-tracking unaware for a long time.
 *  - a stale `lastSeenAt` heartbeat: catches that silent-network-loss case in
 *    bounded time, since it's judged by the *observer's* clock rather than
 *    waiting on the server to notice the dead connection on its own.
 *
 * This is cosmetic — it only decides who to show as "reconnecting…". No result
 * depends on it: an away player is never forfeited for being away, they simply
 * miss turns like anyone else who isn't playing. So a wrong answer here costs a
 * misleading banner, never a match.
 */
export class PresenceChecker {
  static isAway(presence: PlayerPresence | undefined, now: number): boolean {
    if (!presence) return false; // nothing reported yet — assume present
    if (!presence.isConnected) return true;
    return presence.lastSeenAt != null && now - presence.lastSeenAt > HEARTBEAT_STALE_MS;
  }
}
