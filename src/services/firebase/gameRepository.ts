import { get, onValue, ref, serverTimestamp, update } from 'firebase/database';

import type { GamePresence, GameState, PlayerId } from '@/types';

import { realtimeDb } from './config';
import { trackRefConnection } from './connectionTracking';
import { RtdbPaths } from './paths';
import { normalizeGame, normalizePresence } from './rtdbSerialize';


/**
 * Read-side access to a game, plus presence.
 *
 * Clients cannot write game state at all — not a move, not a result, not even
 * the game itself: security rules deny `games/*` outright, and creation is a
 * server call. Every change goes through a Cloud Function, so the board, the
 * scores, the turn order and the clock cannot be forged. See `gameFunctions`.
 *
 * Two things deliberately live outside the game node:
 *  - presence (`gamePresence/…`), because heartbeats would otherwise rewrite the
 *    game every few seconds and push a snapshot to every subscriber;
 *  - the turn-deadline index (`activeGames/…`), so the server can find overdue
 *    games without reading every live one.
 */
export const gameRepository = {
  async getGame(gameId: string): Promise<GameState | null> {
    const snap = await get(ref(realtimeDb, RtdbPaths.game(gameId)));
    return normalizeGame(snap.val() as GameState | null);
  },

  subscribe(gameId: string, cb: (state: GameState | null) => void): () => void {
    const node = ref(realtimeDb, RtdbPaths.game(gameId));
    return onValue(node, (snap) => cb(normalizeGame(snap.val() as GameState | null)));
  },

  /**
   * Presence is watched separately from the game so the high-churn heartbeat
   * stream never invalidates the game subscription.
   */
  subscribePresence(gameId: string, cb: (presence: GamePresence) => void): () => void {
    const node = ref(realtimeDb, RtdbPaths.gamePresence(gameId));
    return onValue(node, (snap) => cb(normalizePresence(snap.val() as GamePresence | null)));
  },

  /**
   * Track this client's connection for one player within one game, using
   * `.info/connected` + `onDisconnect` so a graceful disconnect (app kill) is
   * reflected server-side with no client action needed. Writes to the separate
   * presence node, so none of this touches game state. Returns a teardown for a
   * graceful unmount.
   */
  trackConnection(gameId: string, playerId: PlayerId): () => void {
    const node = ref(realtimeDb, RtdbPaths.gamePlayerPresence(gameId, playerId));
    return trackRefConnection(
      node,
      { isConnected: true, disconnectedAt: null, lastSeenAt: serverTimestamp() },
      { isConnected: false, disconnectedAt: serverTimestamp() },
    );
  },

  /**
   * Refresh this player's heartbeat. `onDisconnect` alone can take a long time
   * to notice a silent network loss (no graceful close for the server to react
   * to), so peers judge presence by how stale this timestamp is instead.
   */
  async heartbeat(gameId: string, playerId: PlayerId): Promise<void> {
    await update(ref(realtimeDb, RtdbPaths.gamePlayerPresence(gameId, playerId)), {
      lastSeenAt: serverTimestamp(),
    });
  },

};
