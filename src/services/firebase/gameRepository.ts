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
import type { GamePresence, GameState, Line, PlayerId } from '@/types';

import { trackRefConnection } from './connectionTracking';
import { realtimeDb } from './config';
import { RtdbPaths } from './paths';
import { normalizeGame, normalizePresence } from './rtdbSerialize';

export type ApplyMoveResult =
  { ok: true; state: GameState } | { ok: false; reason: 'rejected' | 'not_found' };

const deadlineOf = (state: GameState) => state.turnStartedAt + state.turnDurationMs;

/**
 * Authoritative game state lives in Realtime Database. Moves are applied through
 * a transaction that re-runs the *same pure engine* the client uses optimistically,
 * so the server is the single source of truth and illegal/raced moves are rejected
 * atomically (only one of two simultaneous edits to the same line can win).
 *
 * Three things deliberately live *outside* the game node:
 *  - presence (`gamePresence/…`), because heartbeats would otherwise rewrite the
 *    game every few seconds and push a snapshot to every subscriber;
 *  - the turn-deadline index (`activeGames/…`), so the server can find overdue
 *    games without reading every live one;
 *  - any terminal state, which only Cloud Functions may write.
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

  async applyMove(gameId: string, line: Line, playerId: PlayerId): Promise<ApplyMoveResult> {
    const node = ref(realtimeDb, RtdbPaths.game(gameId));
    const now = Date.now();

    const tx = await runTransaction(node, (current: GameState | null) => {
      const state = normalizeGame(current);
      if (!state) return current; // abort: nothing to play on
      const outcome = GameManager.applyMove(state, line, playerId, now);
      if (!outcome.ok) return; // abort transaction (undefined) on illegal move
      // A client never persists a terminal state — the server's `finalizeGame`
      // is the sole writer of `finished`/`result`. Persist the completing move
      // but leave the phase 'playing' (RTDB rules reject anything else); the
      // store then asks the server to finalize, which re-checks the board itself.
      if (outcome.state.phase === 'finished') {
        return { ...outcome.state, phase: 'playing', result: null };
      }
      return outcome.state;
    });

    if (!tx.committed) {
      const exists = (await get(node)).exists();
      return { ok: false, reason: exists ? 'rejected' : 'not_found' };
    }

    const state = normalizeGame(tx.snapshot.val() as GameState)!;
    // Refresh the due-index so the sweep knows when this turn expires. Only a
    // hint — the server re-derives the real deadline before acting on it — so a
    // failure here can't corrupt a result, it just delays a backstop.
    void set(ref(realtimeDb, RtdbPaths.activeGame(gameId)), deadlineOf(state));
    return { ok: true, state };
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

  async deleteGame(gameId: string): Promise<void> {
    await remove(ref(realtimeDb, RtdbPaths.game(gameId)));
    await remove(ref(realtimeDb, RtdbPaths.activeGame(gameId)));
    await remove(ref(realtimeDb, RtdbPaths.gamePresence(gameId)));
  },
};
