import { create } from 'zustand';

import { GameManager } from '@/gameEngine';
import { gameRepository } from '@/services/firebase';
import type { GameState, Line, Player, PlayerId } from '@/types';
import { lineToKey } from '@/utils';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

interface GameStoreState {
  gameId: string | null;
  game: GameState | null;
  myUid: string | null;
  myPlayerId: PlayerId | null;
  connection: ConnectionStatus;
  /** Line keys submitted optimistically and awaiting server confirmation. */
  pendingLines: Set<string>;
  error: string | null;

  connect: (gameId: string, uid: string) => void;
  disconnect: () => void;
  makeMove: (line: Line) => Promise<void>;
  setConnection: (status: ConnectionStatus) => void;
}

let unsubscribe: (() => void) | null = null;

function resolveMyPlayerId(game: GameState | null, uid: string | null): PlayerId | null {
  if (!game || !uid) return null;
  const me = Object.values(game.players).find((p: Player) => p.uid === uid);
  return me?.id ?? null;
}

/**
 * Drives a single live game. Renders authoritative RTDB state, but applies the
 * local player's own move optimistically (via the pure engine) for zero-latency
 * feedback; the next server snapshot reconciles — confirming or silently
 * correcting — so we never diverge from the source of truth.
 */
export const useGameStore = create<GameStoreState>((set, get) => ({
  gameId: null,
  game: null,
  myUid: null,
  myPlayerId: null,
  connection: 'connecting',
  pendingLines: new Set(),
  error: null,

  connect: (gameId, uid) => {
    if (get().gameId === gameId && unsubscribe) return;
    unsubscribe?.();
    set({
      gameId,
      myUid: uid,
      game: null,
      myPlayerId: null,
      connection: 'connecting',
      pendingLines: new Set(),
      error: null,
    });

    unsubscribe = gameRepository.subscribe(gameId, (game) => {
      set((s) => ({
        game,
        myPlayerId: resolveMyPlayerId(game, s.myUid),
        connection: 'online',
        // Server snapshot is authoritative: clear any optimistic lines it now reflects.
        pendingLines: new Set(),
      }));
    });
  },

  disconnect: () => {
    unsubscribe?.();
    unsubscribe = null;
    set({
      gameId: null,
      game: null,
      myUid: null,
      myPlayerId: null,
      pendingLines: new Set(),
      connection: 'connecting',
    });
  },

  makeMove: async (line) => {
    const { game, myPlayerId, gameId } = get();
    if (!game || !myPlayerId || !gameId) return;

    // Local legality gate — avoids a pointless round trip and bad optimistic UI.
    const validation = GameManager.validateMove(game, line, myPlayerId);
    if (!validation.valid) {
      set({ error: validation.reason });
      return;
    }

    const optimistic = GameManager.applyMove(game, line, myPlayerId);
    if (optimistic.ok) {
      const key = lineToKey(line);
      set((s) => ({
        game: optimistic.state,
        pendingLines: new Set(s.pendingLines).add(key),
        error: null,
      }));
    }

    const res = await gameRepository.applyMove(gameId, line, myPlayerId);
    if (!res.ok) {
      // Roll back to authoritative state; the live subscription will also refresh.
      const fresh = await gameRepository.getGame(gameId);
      set({ game: fresh, pendingLines: new Set(), error: 'move_rejected' });
    }
  },

  setConnection: (status) => set({ connection: status }),
}));
