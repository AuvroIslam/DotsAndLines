import type { Line } from '@/types';

import { callable, type CallResult } from './callable';

/**
 * Every write to a game goes through here.
 *
 * Clients have no write access to `games/*` at all — the security rules deny it
 * outright, and even creating a game is a server call. Moves, timeouts, forfeits
 * and rematches are all *requests*, re-validated against authoritative state with
 * the same engine the client renders from. A client can propose, never decide: it
 * cannot draw out of turn, redraw a line, forge a board, rig a turn clock, or
 * hand itself a win.
 *
 * These never throw — see `callable`. A refusal is an ordinary outcome in a
 * turn-based game (a tap that lost a race), so it is returned, not raised.
 */

interface ActionResult {
  ok: boolean;
  reason?: string;
}
interface CreatedGame {
  gameId: string;
}

const playMoveFn = callable<{ gameId: string; line: Line }, ActionResult>('playMove');
const forfeitGameFn = callable<{ gameId: string }, ActionResult>('forfeitGame');
const requestTurnTimeoutFn = callable<{ gameId: string }, ActionResult>('requestTurnTimeout');
const createGameFn = callable<
  { source: 'room' | 'match' | 'rematch'; roomId?: string; opponentUid?: string; fromGameId?: string },
  CreatedGame
>('createGame');

/** Did the server accept the request, and if not, why? */
const accepted = (res: CallResult<ActionResult>) => res.ok && res.data.ok === true;

export const gameFunctions = {
  /**
   * Ask the server to draw `line`. It re-checks whose turn it is, whether the
   * line is a real edge and still free, and whether the player is still in the
   * game — and if the move completes the board, it writes the final result in the
   * same call.
   */
  async playMove(gameId: string, line: Line): Promise<CallResult<ActionResult>> {
    return playMoveFn({ gameId, line });
  },

  /** Explicit leave — an outright concession. */
  async forfeit(gameId: string): Promise<CallResult<ActionResult>> {
    return forfeitGameFn({ gameId });
  },

  /**
   * Ask the server to apply an expired turn clock: the active player misses the
   * turn, and is eliminated once they've missed enough in a row. Any player may
   * ask; the server re-checks the deadline, so an early or duplicate call is a
   * harmless no-op.
   */
  async timeoutTurn(gameId: string): Promise<CallResult<ActionResult>> {
    return requestTurnTimeoutFn({ gameId });
  },

  /**
   * Start a game. The client says which room, opponent or finished game it means
   * — never what the game *is*. Board size, clock and starting player are chosen
   * by the server from state the client cannot write.
   */
  async startFromRoom(roomId: string): Promise<CallResult<CreatedGame>> {
    return createGameFn({ source: 'room', roomId });
  },
  async startFromMatch(opponentUid: string): Promise<CallResult<CreatedGame>> {
    return createGameFn({ source: 'match', opponentUid });
  },
  async startRematch(fromGameId: string): Promise<CallResult<CreatedGame>> {
    return createGameFn({ source: 'rematch', fromGameId });
  },

  accepted,
};
