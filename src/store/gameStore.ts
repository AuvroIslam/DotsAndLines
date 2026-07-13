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
 * Clients never *persist* a terminal state — `finalizeGame` on the server owns
 * that — so the winning move lands as a full board that is still `playing` for
 * the second or so until the server catches up. Rendering that literally would
 * flash the game-over screen away and back again, so present a complete board
 * as finished right now. The result is derived from the board by the very same
 * engine the server runs, so this can't disagree with what lands moments later;
 * it's a display projection, never written back.
 */
function withDerivedFinish(game: GameState | null): GameState | null {
  if (!game || game.phase !== 'playing' || !WinChecker.isGameOver(game)) return game;
  return { ...game, phase: 'finished', result: WinChecker.getResult(game) };
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

    unsubscribe = gameRepository.subscribe(gameId, (server) => {
      const game = withDerivedFinish(server);
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
      return;
    }

    // That move may have filled the board. Clients can't write a terminal state,
    // so ask the server to finalize — purely so the result lands now instead of
    // waiting for the sweep. The server re-derives completeness from the real
    // board and ignores us if we're wrong, so this is a hint, never a claim.
    if (WinChecker.isGameOver(res.state)) {
      void gameFunctions.finalize(gameId);
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
