import { GameManager } from '@/gameEngine';
import type { GamePresence, GameState, Line, PlayerId } from '@/types';

import { LocalCollection } from './store';

export type ApplyMoveResult =
  { ok: true; state: GameState } | { ok: false; reason: 'rejected' | 'not_found' };

const games = new LocalCollection<GameState>();
/** Presence is kept apart from game state, mirroring the firebase layout. */
const presences = new LocalCollection<GamePresence>();

/**
 * In-memory game store used by tests and offline play.
 *
 * This is deliberately *not* a mirror of `services/firebase/gameRepository` any
 * more. The firebase one is read-only now — creating a game and applying a move
 * are Cloud Function calls, because a client that can author game state can rig
 * the match. Here there is no server and no adversary, so it keeps `createGame`
 * and `applyMove` locally. Moves still run through `GameManager`, so the rules
 * themselves are never duplicated.
 */
export const gameRepository = {
  async createGame(state: GameState): Promise<void> {
    games.set(state.id, state);
  },

  async getGame(gameId: string): Promise<GameState | null> {
    return games.get(gameId);
  },

  subscribe(gameId: string, cb: (state: GameState | null) => void): () => void {
    return games.subscribe(gameId, cb);
  },

  async applyMove(gameId: string, line: Line, playerId: PlayerId): Promise<ApplyMoveResult> {
    const now = Date.now();
    const tx = games.transaction(gameId, (current) => {
      if (!current) return undefined; // abort: no game to play on
      const outcome = GameManager.applyMove(current, line, playerId, now);
      if (!outcome.ok) return undefined; // abort: illegal move
      return outcome.state;
    });

    if (!tx.committed) {
      const exists = games.get(gameId) !== null;
      return { ok: false, reason: exists ? 'rejected' : 'not_found' };
    }
    return { ok: true, state: games.get(gameId)! };
  },

  subscribePresence(gameId: string, cb: (presence: GamePresence) => void): () => void {
    return presences.subscribe(gameId, (p) => cb(p ?? {}));
  },

  /**
   * Presence lives outside the game (as in the firebase impl), so none of this
   * touches game state. No real network here, so reflect it synchronously.
   */
  trackConnection(gameId: string, playerId: PlayerId): () => void {
    const setConnected = (isConnected: boolean) => {
      presences.transaction(gameId, (current) => ({
        ...(current ?? {}),
        [playerId]: {
          isConnected,
          disconnectedAt: isConnected ? null : Date.now(),
          lastSeenAt: isConnected ? Date.now() : (current?.[playerId]?.lastSeenAt ?? null),
        },
      }));
    };
    setConnected(true);
    return () => setConnected(false);
  },

  /** Refresh this player's heartbeat (see the firebase impl's doc comment for why). */
  async heartbeat(gameId: string, playerId: PlayerId): Promise<void> {
    presences.transaction(gameId, (current) => ({
      ...(current ?? {}),
      [playerId]: {
        isConnected: current?.[playerId]?.isConnected ?? true,
        disconnectedAt: current?.[playerId]?.disconnectedAt ?? null,
        lastSeenAt: Date.now(),
      },
    }));
  },

  async deleteGame(gameId: string): Promise<void> {
    games.delete(gameId);
    presences.delete(gameId);
  },
};
