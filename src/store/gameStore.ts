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
  /** Resolves true if the server accepted the forfeit. Never throws. */
  forfeit: () => Promise<boolean>;
  setConnection: (status: ConnectionStatus) => void;
}

let unsubscribe: (() => void) | null = null;
let unsubscribePresence: (() => void) | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A Cloud Function's multi-path `update()` commits atomically on the server,
 * but the client's `onValue` listener is not guaranteed to observe it as one
 * event: a move has been measured to arrive as a *torn* read (e.g. `version`
 * already bumped, `board`/`currentTurn` still the old values), followed by
 * the fully-consistent snapshot ~30ms later. Applying every fire verbatim
 * flashes the just-drawn line back to blank and then redraws it — the same
 * move rendered twice. A short quiet window collapses a burst of fires from
 * one write into a single, self-consistent update.
 */
const RECONCILE_DEBOUNCE_MS = 80;

/**
 * Belt-and-braces on top of the debounce above: lines and boxes are only ever
 * *added* during a game (see `gameDelta.ts`), so a snapshot can never
 * legitimately un-draw one. Union rather than replace, so a torn read that
 * slips past the debounce still can't make the board regress.
 */
function mergeIncoming(current: GameState | null, incoming: GameState | null): GameState | null {
  if (!incoming || !current || current.id !== incoming.id) return incoming;
  return {
    ...incoming,
    board: {
      ...incoming.board,
      lines: { ...current.board.lines, ...incoming.board.lines },
      boxes: { ...current.board.boxes, ...incoming.board.boxes },
    },
  };
}

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
    if (reconcileTimer) clearTimeout(reconcileTimer);
    reconcileTimer = null;
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

    unsubscribe = gameRepository.subscribe(gameId, (incoming) => {
      // Coalesce a burst of fires from one server write (see RECONCILE_DEBOUNCE_MS
      // above) so a torn intermediate read never reaches the UI.
      if (reconcileTimer) clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        set((s) => ({
          game: mergeIncoming(s.game, incoming),
          myPlayerId: resolveMyPlayerId(incoming, s.myUid),
          connection: 'online',
          // Server snapshot is authoritative: clear any optimistic lines it now reflects.
          pendingLines: new Set(),
        }));
      }, RECONCILE_DEBOUNCE_MS);
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
    if (reconcileTimer) clearTimeout(reconcileTimer);
    reconcileTimer = null;
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

    let res = await gameFunctions.playMove(gameId, line);

    // `aborted` means another write landed between our read and our swap — the
    // opponent moved, or the clock timed us out. That's ordinary contention in a
    // live game, not a failure, so re-read and try once more before giving up.
    if (!res.ok && res.code === 'aborted') {
      res = await gameFunctions.playMove(gameId, line);
    }

    if (!gameFunctions.accepted(res)) {
      // Refused (a stale tap, a line someone else took first) or unreachable.
      // Either way the optimistic line must not stay on the board: roll back to
      // authoritative state. The subscription will also refresh us.
      const fresh = await gameRepository.getGame(gameId);
      set({
        game: fresh,
        pendingLines: new Set(),
        error: res.ok ? 'move_rejected' : res.code,
      });
    }
  },

  forfeit: async () => {
    const { gameId, myPlayerId } = get();
    if (!gameId || !myPlayerId) return false;
    // Server-authoritative: the client only requests the forfeit; the Cloud
    // Function is the sole writer of the resulting terminal state.
    const res = await gameFunctions.forfeit(gameId);
    return gameFunctions.accepted(res);
  },

  setConnection: (status) => set({ connection: status }),
}));
