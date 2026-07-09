import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { onValueWritten } from 'firebase-functions/v2/database';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import type { GameState } from '@/types';

// Deploy every function in the same region as the Realtime Database instance
// (dotsandboxes-185bb-default-rtdb lives in asia-southeast1). A 2nd-gen RTDB
// trigger MUST be co-located with its database, and the client resolves
// callables from this same region (see `getFunctions` in services/firebase/config).
setGlobalOptions({ region: 'asia-southeast1' });

import {
  finalizeIfComplete,
  forfeitByUid,
  forfeitTimedOutPlayers,
  skipExpiredTurn,
} from './authority';

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

const db = () => getDatabase();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One pass over every in-progress game, forfeiting players past their grace period. */
async function runSweep(): Promise<void> {
  const snap = await db().ref('games').orderByChild('phase').equalTo('playing').once('value');
  const games = snap.val() as Record<string, GameState> | null;
  if (!games) return;

  await Promise.all(
    Object.keys(games).map(async (gameId) => {
      try {
        const changed = await forfeitTimedOutPlayers(db().ref(`games/${gameId}`), Date.now());
        if (changed) logger.info('disconnect forfeit applied', { gameId });
      } catch (err) {
        logger.error('sweep failed', { gameId, err });
      }
    }),
  );
}

/**
 * Authoritative disconnect→forfeit. Cloud Scheduler's finest cadence is one
 * minute, so a single invocation runs two passes 30s apart to give ~30s
 * disconnect-detection granularity without a second scheduled job.
 */
export const sweepDisconnects = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 120, memory: '256MiB' },
  async () => {
    await runSweep();
    await sleep(30_000);
    await runSweep();
  },
);

/**
 * Writes the terminal state for a normally-completed board. Scoped to the board
 * node so it fires on moves only (not on the frequent presence/heartbeat writes),
 * and aborts unless the board is genuinely full — so clients never persist a
 * `finished`/`result` state themselves.
 */
export const finalizeGame = onValueWritten('games/{gameId}/board', async (event) => {
  const gameRef = event.data.after.ref.parent; // games/{gameId}
  if (!gameRef) return;
  await finalizeIfComplete(gameRef, Date.now());
});

/** Explicit leave. Only a player in the game may forfeit themselves. */
export const forfeitGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const outcome = await forfeitByUid(db().ref(`games/${gameId}`), uid, Date.now());
  if (outcome === 'not_member') throw new HttpsError('permission-denied', 'Not a player in this game.');
  return { ok: outcome === 'ok' };
});

/** Turn-timeout skip, validated server-side against the turn deadline. */
export const requestSkipTurn = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const outcome = await skipExpiredTurn(db().ref(`games/${gameId}`), uid, Date.now());
  if (outcome === 'not_member') throw new HttpsError('permission-denied', 'Not a player in this game.');
  return { ok: outcome === 'ok' };
});
