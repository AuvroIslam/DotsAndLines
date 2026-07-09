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

  /** No real network here, so just reflect connected/disconnected synchronously. */
  trackConnection(gameId: string, playerId: PlayerId): () => void {
    const setConnected = (isConnected: boolean) => {
      games.transaction(gameId, (current) => {
        if (!current?.players[playerId]) return undefined;
        return {
          ...current,
          players: {
            ...current.players,
            [playerId]: {
              ...current.players[playerId]!,
              isConnected,
              disconnectedAt: isConnected ? null : Date.now(),
              lastSeenAt: isConnected ? Date.now() : current.players[playerId]!.lastSeenAt,
            },
          },
          updatedAt: Date.now(),
        };
      });
    };
    setConnected(true);
    return () => setConnected(false);
  },

  /** Refresh this player's heartbeat (see the firebase impl's doc comment for why). */
  async heartbeat(gameId: string, playerId: PlayerId): Promise<void> {
    games.transaction(gameId, (current) => {
      if (!current?.players[playerId]) return undefined;
      return {
        ...current,
        players: {
          ...current.players,
          [playerId]: { ...current.players[playerId]!, lastSeenAt: Date.now() },
        },
      };
    });
  },

  async deleteGame(gameId: string): Promise<void> {
    games.delete(gameId);
  },
};
