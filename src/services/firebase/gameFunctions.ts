import { httpsCallable } from 'firebase/functions';

import type { Line } from '@/types';

import { functions } from './config';

/**
 * Every write to a game goes through here.
 *
 * Clients have no write access to `games/*` at all — the security rules permit
 * only the creation of a pristine, unplayed game and nothing after that. Moves,
 * timeouts and forfeits are all requests to the server, which re-validates them
 * against authoritative state with the same engine the client renders from. So
 * a client can propose, but never decide: it cannot draw out of turn, redraw a
 * line, forge a board, or hand itself a win.
 */

interface ActionResult {
  ok: boolean;
  /** Why a legal-looking request was refused (e.g. 'rejected' for a raced move). */
  reason?: string;
}

const playMoveFn = httpsCallable<{ gameId: string; line: Line }, ActionResult>(
  functions,
  'playMove',
);
const forfeitGameFn = httpsCallable<{ gameId: string }, ActionResult>(functions, 'forfeitGame');
const requestTurnTimeoutFn = httpsCallable<{ gameId: string }, ActionResult>(
  functions,
  'requestTurnTimeout',
);

export const gameFunctions = {
  /**
   * Ask the server to draw `line`. It re-checks whose turn it is, whether the
   * line is free and whether the player is still in the game — and if the move
   * completes the board, it writes the final result in the same call.
   *
   * Returns false for a legitimately refused move (a stale tap, or a line another
   * player took first); the caller should roll back its optimistic state.
   */
  async playMove(gameId: string, line: Line): Promise<boolean> {
    const res = await playMoveFn({ gameId, line });
    return res.data.ok;
  },

  /** Ask the server to forfeit the calling player (explicit leave — a concession). */
  async forfeit(gameId: string): Promise<boolean> {
    const res = await forfeitGameFn({ gameId });
    return res.data.ok;
  },

  /**
   * Ask the server to apply an expired turn clock: the active player misses the
   * turn, and is eliminated once they've missed enough in a row. Any player may
   * ask; the server re-checks the deadline, so an early or duplicate call is a
   * harmless no-op.
   */
  async timeoutTurn(gameId: string): Promise<boolean> {
    const res = await requestTurnTimeoutFn({ gameId });
    return res.data.ok;
  },
};
