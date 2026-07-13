import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import type { GameState } from '@/types';

import {
  finalizeByMember,
  finalizeIfComplete,
  forfeitByUid,
  timeoutExpiredTurns,
  timeoutExpiredTurnsByMember,
  type TxResult,
} from './authority';

// Callables must resolve from the region the client asks for (see `getFunctions`
// in services/firebase/config). There are deliberately no RTDB triggers here —
// a trigger on the game node would fire on every single move, so all server work
// is driven by the sweep and by explicit, server-validated requests instead.
setGlobalOptions({ region: 'asia-southeast1' });

// In production `initializeApp()` picks up the correct default RTDB instance
// (`<project>-default-rtdb`) from FIREBASE_CONFIG. Under the emulator with a
// `demo-` project the auto-derived URL drops the `-default-rtdb` suffix, so
// realign it; production is unaffected.
const emulatorDbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
initializeApp(
  emulatorDbHost
    ? { databaseURL: `http://${emulatorDbHost}/?ns=${process.env.GCLOUD_PROJECT}-default-rtdb` }
    : undefined,
);

const db = () => getDatabase();
const gameRef = (gameId: string) => db().ref(`games/${gameId}`);
const activeRef = (gameId: string) => db().ref(`activeGames/${gameId}`);

/** How many overdue games one sweep will process. Bounds a single run's work. */
const SWEEP_BATCH = 250;

/**
 * Keep the due-index in step with the game we just wrote: re-arm it with the new
 * turn deadline, or drop the game from the index once it's over. Finished games
 * must leave the index, otherwise the sweep would keep rediscovering them
 * forever and the index would grow without bound.
 */
async function syncDueIndex(gameId: string, state: GameState | null): Promise<void> {
  if (!state || state.phase !== 'playing') {
    await activeRef(gameId).remove();
    return;
  }
  await activeRef(gameId).set(state.turnStartedAt + state.turnDurationMs);
}

/** Apply an authority write and immediately reconcile the index with its result. */
async function commitAndSync(gameId: string, res: TxResult): Promise<TxResult> {
  await syncDueIndex(gameId, res.state);
  return res;
}

/**
 * Backstop for games nobody is connected to.
 *
 * While at least one player is present their client asks for a timeout the
 * moment a clock runs out, so this is not the fast path — it exists for the case
 * where *everyone* has gone and there is no client left to ask.
 *
 * It reads the `activeGames` due-index (`gameId -> turn deadline`) and pulls only
 * the games actually overdue, rather than downloading every live game every
 * minute. That is the whole scalability story: sweep cost tracks the number of
 * *overdue* games, not the number of *active* ones, so a thousand healthy games
 * in progress cost essentially nothing to sweep past.
 *
 * The index is only a hint — every game it surfaces is re-validated against its
 * real state before anything is written, so a stale or tampered entry can waste
 * a lookup but never produce a wrong result.
 */
export const sweepAbandonedGames = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const now = Date.now();
    const due = await db()
      .ref('activeGames')
      .orderByValue()
      .endAt(now)
      .limitToFirst(SWEEP_BATCH)
      .once('value');

    const overdue = due.val() as Record<string, number> | null;
    if (!overdue) return;

    const ids = Object.keys(overdue);
    logger.info('sweeping overdue games', { count: ids.length });

    await Promise.all(
      ids.map(async (gameId) => {
        try {
          // Finalize first: a full board is a finished game, not an idle one.
          const finalized = await finalizeIfComplete(gameRef(gameId), Date.now());
          if (finalized.committed) {
            await syncDueIndex(gameId, finalized.state);
            logger.info('finalized a completed board', { gameId });
            return;
          }
          const timed = await timeoutExpiredTurns(gameRef(gameId), Date.now());
          await syncDueIndex(gameId, timed.state);
          if (timed.committed) logger.info('applied overdue turn timeouts', { gameId });
        } catch (err) {
          logger.error('sweep failed', { gameId, err });
        }
      }),
    );
  },
);

/**
 * Finalize a completed board.
 *
 * The client calls this the instant it sees the last box filled, purely so the
 * result lands immediately instead of waiting for the sweep. Its claim carries
 * no weight: the server re-reads the authoritative board and re-derives
 * completeness with the same engine the game runs on, and refuses to write
 * anything if the board isn't genuinely full. A client asking early, twice, or
 * maliciously gets a no-op.
 */
export const finalizeGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const res = await finalizeByMember(gameRef(gameId), uid, Date.now());
  if (res.outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  await commitAndSync(gameId, res);
  return { ok: res.outcome === 'ok' };
});

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

  const res = await timeoutExpiredTurnsByMember(gameRef(gameId), uid, Date.now());
  if (res.outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  await commitAndSync(gameId, res);
  return { ok: res.outcome === 'ok' };
});

/** Explicit leave — a concession. Only a player in the game may forfeit themselves. */
export const forfeitGame = onCall<{ gameId?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const gameId = request.data?.gameId;
  if (!gameId) throw new HttpsError('invalid-argument', 'gameId is required.');

  const res = await forfeitByUid(gameRef(gameId), uid, Date.now());
  if (res.outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  await commitAndSync(gameId, res);
  return { ok: res.outcome === 'ok' };
});
