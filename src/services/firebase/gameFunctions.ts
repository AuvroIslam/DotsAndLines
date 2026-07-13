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
const requestTurnTimeoutFn = httpsCallable<{ gameId: string }, ActionResult>(
  functions,
  'requestTurnTimeout',
);

export const gameFunctions = {
  /** Ask the server to forfeit the calling player (explicit leave — an outright concession). */
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
