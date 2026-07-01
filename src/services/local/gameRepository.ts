import { GameManager } from '@/gameEngine';
import type { GameState, Line, PlayerId } from '@/types';

import { LocalCollection } from './store';

export type ApplyMoveResult =
  { ok: true; state: GameState } | { ok: false; reason: 'rejected' | 'not_found' };

const games = new LocalCollection<GameState>();

/**
 * In-memory replica of `services/firebase/gameRepository` — same method
 * signatures, no network. Moves still go through `GameManager`, so game
 * logic is never duplicated.
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

  /** Advance the turn when the timer expires (validated against the current turn). */
  async skipTurn(gameId: string, expectedTurn: PlayerId): Promise<boolean> {
    const now = Date.now();
    const tx = games.transaction(gameId, (current) => {
      if (!current || current.phase !== 'playing') return undefined;
      if (current.currentTurn !== expectedTurn) return undefined; // already moved on
      return GameManager.skipTurn(current, now);
    });
    return tx.committed;
  },

  /** Mark a player's connection state (used by reconnect / presence in-game). */
  async setPlayerConnection(
    gameId: string,
    playerId: PlayerId,
    isConnected: boolean,
  ): Promise<void> {
    games.transaction(gameId, (current) => {
      if (!current) return undefined;
      return {
        ...current,
        players: {
          ...current.players,
          [playerId]: { ...current.players[playerId]!, isConnected },
        },
        updatedAt: Date.now(),
      };
    });
  },

  async deleteGame(gameId: string): Promise<void> {
    games.delete(gameId);
  },
};
