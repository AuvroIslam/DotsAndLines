import { httpsCallable } from 'firebase/functions';

import { functions } from './config';

/**
 * Thin client wrappers around the server-authoritative game-ending callables.
 * These replace the former client-side RTDB writes for forfeit/skip: the client
 * only *requests* the action and the Cloud Function is the sole writer of any
 * terminal state, so no device can decide a winner on its own.
 */

interface ActionResult {
  ok: boolean;
}

const forfeitGameFn = httpsCallable<{ gameId: string }, ActionResult>(functions, 'forfeitGame');
const requestSkipTurnFn = httpsCallable<{ gameId: string }, ActionResult>(functions, 'requestSkipTurn');

export const gameFunctions = {
  /** Ask the server to forfeit the calling player (explicit leave). */
  async forfeit(gameId: string): Promise<boolean> {
    const res = await forfeitGameFn({ gameId });
    return res.data.ok;
  },

  /** Ask the server to advance the turn once the active player's timer has expired. */
  async skipTurn(gameId: string): Promise<boolean> {
    const res = await requestSkipTurnFn({ gameId });
    return res.data.ok;
  },
};
