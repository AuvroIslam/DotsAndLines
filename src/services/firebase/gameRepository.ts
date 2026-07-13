import { get, onValue, ref, serverTimestamp, set, update } from 'firebase/database';

import type { GamePresence, GameState, PlayerId } from '@/types';

import { trackRefConnection } from './connectionTracking';
import { realtimeDb } from './config';
import { RtdbPaths } from './paths';
import { normalizeGame, normalizePresence } from './rtdbSerialize';

const deadlineOf = (state: GameState) => state.turnStartedAt + state.turnDurationMs;

/**
 * Read-side access to a game, plus presence.
 *
 * Clients can no longer *write* game state at all — security rules allow only
 * the creation of a pristine, unplayed game, and nothing after that. Every
 * change (moves included) goes through a Cloud Function, so the board, the
 * scores and the turn order cannot be forged. See `gameFunctions`.
 *
 * Two things deliberately live outside the game node:
 *  - presence (`gamePresence/…`), because heartbeats would otherwise rewrite the
 *    game every few seconds and push a snapshot to every subscriber;
 *  - the turn-deadline index (`activeGames/…`), so the server can find overdue
 *    games without reading every live one.
 */
export const gameRepository = {
  async createGame(state: GameState): Promise<void> {
    // Membership index lets RTDB security rules authorize writers by uid
    // without iterating the players map.
    const memberUids: Record<string, boolean> = {};
    for (const p of Object.values(state.players)) memberUids[p.uid] = true;
    await set(ref(realtimeDb, `gameMembers/${state.id}`), memberUids);
    await set(ref(realtimeDb, RtdbPaths.game(state.id)), state);
    await set(ref(realtimeDb, RtdbPaths.activeGame(state.id)), deadlineOf(state));
  },

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
