import { create } from 'zustand';

import { GameManager, WinChecker } from '@/gameEngine';
import { gameFunctions, gameRepository } from '@/services/firebase';
import type { GamePresence, GameState, Line, Player, PlayerId } from '@/types';
import { lineToKey } from '@/utils';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

interface GameStoreState {
  gameId: string | null;
  game: GameState | null;
  /** Live connection state, streamed separately from the game (see `PlayerPresence`). */
  presence: GamePresence;
  myUid: string | null;
  myPlayerId: PlayerId | null;
  connection: ConnectionStatus;
  /** Line keys submitted optimistically and awaiting server confirmation. */
  pendingLines: Set<string>;
  error: string | null;

  connect: (gameId: string, uid: string) => void;
  disconnect: () => void;
  makeMove: (line: Line) => Promise<void>;
  forfeit: () => Promise<void>;
  setConnection: (status: ConnectionStatus) => void;
}

let unsubscribe: (() => void) | null = null;
let unsubscribePresence: (() => void) | null = null;

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
  presence: {},
  myUid: null,
  myPlayerId: null,
  connection: 'connecting',
  pendingLines: new Set(),
  error: null,

  connect: (gameId, uid) => {
    if (get().gameId === gameId && unsubscribe) return;
    unsubscribe?.();
    unsubscribePresence?.();
    set({
      gameId,
      myUid: uid,
      game: null,
      presence: {},
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

    // Presence streams on its own node so the heartbeat traffic never touches
    // the game subscription above — which now only fires on real moves.
    unsubscribePresence = gameRepository.subscribePresence(gameId, (presence) => {
      set({ presence });
    });
  },

  disconnect: () => {
    unsubscribe?.();
    unsubscribePresence?.();
    unsubscribe = null;
    unsubscribePresence = null;
    set({
      gameId: null,
      game: null,
      presence: {},
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
    // Not a security check: the server re-validates everything regardless.
    const validation = GameManager.validateMove(game, line, myPlayerId);
    if (!validation.valid) {
      set({ error: validation.reason });
      return;
    }

    // Show the move immediately through the same engine the server will run, so
    // routing writes through a Cloud Function costs no perceived latency. The
    // authoritative snapshot reconciles a moment later — confirming this, or
    // silently correcting it if the server disagreed.
    const optimistic = GameManager.applyMove(game, line, myPlayerId);
    if (optimistic.ok) {
      set((s) => ({
        game: optimistic.state,
        pendingLines: new Set(s.pendingLines).add(lineToKey(line)),
        error: null,
      }));
    }

    const accepted = await gameFunctions.playMove(gameId, line);
    if (!accepted) {
      // The server refused it — a stale tap, or someone took the line first.
      // Roll back to authoritative state; the subscription will also refresh.
      const fresh = await gameRepository.getGame(gameId);
      set({ game: fresh, pendingLines: new Set(), error: 'move_rejected' });
    }
  },

  forfeit: async () => {
    const { gameId, myPlayerId } = get();
    if (!gameId || !myPlayerId) return;
    // Server-authoritative: the client only requests the forfeit; the Cloud
    // Function is the sole writer of the resulting terminal state.
    await gameFunctions.forfeit(gameId);
  },

  setConnection: (status) => set({ connection: status }),
}));
