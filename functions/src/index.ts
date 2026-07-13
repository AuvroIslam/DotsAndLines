import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onValueWritten } from 'firebase-functions/v2/database';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import type { GameState } from '@/types';

import {
  finalizeIfComplete,
  forfeitByUid,
  timeoutExpiredTurns,
  timeoutExpiredTurnsByMember,
} from './authority';

// Deploy every function in the same region as the Realtime Database instance
// (dotsandboxes-185bb-default-rtdb lives in asia-southeast1). A 2nd-gen RTDB
// trigger MUST be co-located with its database, and the client resolves
// callables from this same region (see `getFunctions` in services/firebase/config).
setGlobalOptions({ region: 'asia-southeast1' });

// In production `initializeApp()` picks up the correct default RTDB instance
// (`<project>-default-rtdb`) from FIREBASE_CONFIG. Under the emulator with a
// `demo-` project, however, the auto-derived database URL drops the
// `-default-rtdb` suffix while the RTDB *triggers* still bind to it — so a
// manually built `getDatabase().ref()` would point at a different (empty)
// namespace than the triggers. This branch (only taken when the emulator env
// var is present) realigns them; production is unaffected.
const emulatorDbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
initializeApp(
  emulatorDbHost
    ? { databaseURL: `http://${emulatorDbHost}/?ns=${process.env.GCLOUD_PROJECT}-default-rtdb` }
    : undefined,
);

/**
 * A 2nd-gen RTDB trigger must live in the same region as its database or it
 * silently never fires — no error, it just doesn't run. The real instance is in
 * asia-southeast1, but the *emulated* database always reports us-central1, so
 * pinning the trigger to the production region would make it untestable
 * locally (and a finalize path that can't be exercised is one that breaks
 * unnoticed). Track whichever database we're actually pointed at.
 */
const DATABASE_REGION = emulatorDbHost ? 'us-central1' : 'asia-southeast1';

const db = () => getDatabase();
const gameRef = (gameId: string) => db().ref(`games/${gameId}`);

/**
 * Backstop for games nobody is connected to.
 *
 * While at least one player is present, their client nudges `requestTurnTimeout`
 * the moment a turn clock runs out, so timeouts land in about a second. But if
 * *everyone* has gone, there's no client left to nudge — this sweep is what
 * still resolves the match. It replays every elapsed turn window at once, so an
 * abandoned game finishes on the very next run rather than creeping forward one
 * turn per minute. It also finalizes any completed-but-unfinalized board, so a
 * game can't hang if the `finalizeGame` trigger ever misses.
 */
export const sweepAbandonedGames = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    const snap = await db().ref('games').orderByChild('phase').equalTo('playing').once('value');
    const games = snap.val() as Record<string, GameState> | null;
    if (!games) return;

    await Promise.all(
      Object.keys(games).map(async (gameId) => {
        try {
          const now = Date.now();
          // Finalize first: a full board is a finished game, not an idle one.
          if (await finalizeIfComplete(gameRef(gameId), now)) {
            logger.info('finalized a completed board', { gameId });
            return;
          }
          if (await timeoutExpiredTurns(gameRef(gameId), now)) {
            logger.info('applied overdue turn timeouts', { gameId });
          }
        } catch (err) {
          logger.error('sweep failed', { gameId, err });
        }
      }),
    );
  },
);

/**
 * Writes the terminal state for a normally-completed board. Scoped to the board
 * node so it fires on moves only (not on the frequent presence/heartbeat writes),
 * and aborts unless the board is genuinely full — so clients never persist a
 * `finished`/`result` state themselves.
 */
export const finalizeGame = onValueWritten(
  { ref: 'games/{gameId}/board', region: DATABASE_REGION },
  async (event) => {
    const gameNode = event.data.after.ref.parent; // games/{gameId}
    if (!gameNode) return;
    await finalizeIfComplete(gameNode, Date.now());
  },
);

/**
 * Turn-clock enforcement. Any player in the game may ask — the server checks the
 * deadline against its own clock, so nobody can rush it. Crucially it is *not*
 * limited to the player whose turn it is: when the active player is the one who
 * dropped, they are exactly the client who cannot ask, so their opponent has to
 * be able to.
 */
export const requestTurnTimeout = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const outcome = await timeoutExpiredTurnsByMember(gameRef(gameId), uid, Date.now());
  if (outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  return { ok: outcome === 'ok' };
});

/** Explicit leave — a concession. Only a player in the game may forfeit themselves. */
export const forfeitGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const outcome = await forfeitByUid(gameRef(gameId), uid, Date.now());
  if (outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  return { ok: outcome === 'ok' };
});
