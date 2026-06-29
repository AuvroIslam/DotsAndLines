import { get, onValue, ref, remove, runTransaction, serverTimestamp, set } from 'firebase/database';

import { GameManager } from '@/gameEngine';
import type { GameState, Line, PlayerId } from '@/types';

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
      return outcome.state;
    });

    if (!tx.committed) {
      const exists = (await get(node)).exists();
      return { ok: false, reason: exists ? 'rejected' : 'not_found' };
    }
    return { ok: true, state: normalizeGame(tx.snapshot.val() as GameState)! };
  },

  /** Advance the turn when the timer expires (validated against the current turn). */
  async skipTurn(gameId: string, expectedTurn: PlayerId): Promise<boolean> {
    const node = ref(realtimeDb, RtdbPaths.game(gameId));
    const now = Date.now();
    const tx = await runTransaction(node, (current: GameState | null) => {
      const state = normalizeGame(current);
      if (!state || state.phase !== 'playing') return current;
      if (state.currentTurn !== expectedTurn) return current; // already moved on
      return GameManager.skipTurn(state, now);
    });
    return tx.committed;
  },

  /** Mark a player's connection state (used by reconnect / presence in-game). */
  async setPlayerConnection(
    gameId: string,
    playerId: PlayerId,
    isConnected: boolean,
  ): Promise<void> {
    await set(
      ref(realtimeDb, `${RtdbPaths.game(gameId)}/players/${playerId}/isConnected`),
      isConnected,
    );
    await set(ref(realtimeDb, `${RtdbPaths.game(gameId)}/updatedAt`), serverTimestamp());
  },

  async deleteGame(gameId: string): Promise<void> {
    await remove(ref(realtimeDb, RtdbPaths.game(gameId)));
  },
};
