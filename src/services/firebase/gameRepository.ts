import {
  get,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';

import { GameManager } from '@/gameEngine';
import type { GameState, Line, PlayerId } from '@/types';

import { trackRefConnection } from './connectionTracking';
import { realtimeDb } from './config';
import { RtdbPaths } from './paths';
import { normalizeGame } from './rtdbSerialize';

export type ApplyMoveResult =
  { ok: true; state: GameState } | { ok: false; reason: 'rejected' | 'not_found' };

/**
 * Authoritative game state lives in Realtime Database. Moves are applied through
 * a transaction that re-runs the *same pure engine* the client uses optimistically,
 * so the server is the single source of truth and illegal/raced moves are rejected
 * atomically (only one of two simultaneous edits to the same line can win).
 */
export const gameRepository = {
  async createGame(state: GameState): Promise<void> {
    // Membership index lets RTDB security rules authorize writers by uid
    // without iterating the players map.
    const memberUids: Record<string, boolean> = {};
    for (const p of Object.values(state.players)) memberUids[p.uid] = true;
    await set(ref(realtimeDb, `gameMembers/${state.id}`), memberUids);
    await set(ref(realtimeDb, RtdbPaths.game(state.id)), state);
  },

  async getGame(gameId: string): Promise<GameState | null> {
    const snap = await get(ref(realtimeDb, RtdbPaths.game(gameId)));
    return normalizeGame(snap.val() as GameState | null);
  },

  subscribe(gameId: string, cb: (state: GameState | null) => void): () => void {
    const node = ref(realtimeDb, RtdbPaths.game(gameId));
    const unsub = onValue(node, (snap) => cb(normalizeGame(snap.val() as GameState | null)));
    return unsub;
  },

  async applyMove(gameId: string, line: Line, playerId: PlayerId): Promise<ApplyMoveResult> {
    const node = ref(realtimeDb, RtdbPaths.game(gameId));
    const now = Date.now();

    const tx = await runTransaction(node, (current: GameState | null) => {
      const state = normalizeGame(current);
      if (!state) return current; // abort: nothing to play on
      const outcome = GameManager.applyMove(state, line, playerId, now);
      if (!outcome.ok) return; // abort transaction (undefined) on illegal move
      // A client never persists a terminal state — the `finalizeGame` Cloud
      // Function is the sole writer of `finished`/`result`. Persist the
      // completing move but leave the phase 'playing'; the server flips it to
      // 'finished' within ~1s (and RTDB rules reject a client 'finished' write).
      if (outcome.state.phase === 'finished') {
        return { ...outcome.state, phase: 'playing', result: null };
      }
      return outcome.state;
    });

    if (!tx.committed) {
      const exists = (await get(node)).exists();
      return { ok: false, reason: exists ? 'rejected' : 'not_found' };
    }
    return { ok: true, state: normalizeGame(tx.snapshot.val() as GameState)! };
  },

  /**
   * Track this client's connection for one player within one game, using the
   * same `.info/connected` + `onDisconnect` mechanism as global presence, so a
   * graceful disconnect (app kill) is reflected server-side with no client
   * action needed. Also stamps an initial heartbeat immediately on (re)connect
   * — see `heartbeat` for why that alone isn't enough. Returns a teardown for
   * a graceful unmount.
   */
  trackConnection(gameId: string, playerId: PlayerId): () => void {
    const playerRef = ref(realtimeDb, RtdbPaths.gamePlayer(gameId, playerId));
    return trackRefConnection(
      playerRef,
      { isConnected: true, disconnectedAt: null, lastSeenAt: serverTimestamp() },
      { isConnected: false, disconnectedAt: serverTimestamp() },
    );
  },

  /**
   * Refresh this player's heartbeat. Called periodically while connected —
   * `onDisconnect` alone can take a long time to notice a silent network loss
   * (no graceful close for the server to react to), so peers instead judge a
   * departure by how stale this timestamp is on their own clock.
   */
  async heartbeat(gameId: string, playerId: PlayerId): Promise<void> {
    await update(ref(realtimeDb, RtdbPaths.gamePlayer(gameId, playerId)), {
      lastSeenAt: serverTimestamp(),
    });
  },

  async deleteGame(gameId: string): Promise<void> {
    await remove(ref(realtimeDb, RtdbPaths.game(gameId)));
  },
};
