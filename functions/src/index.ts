import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import type { Line } from '@/types';

import {
  finalizeIfComplete,
  forfeitByUid,
  playMoveByUid,
  timeoutExpiredTurns,
  timeoutExpiredTurnsByMember,
  type ActionOutcome,
} from './authority';

// Callables must resolve from the region the client asks for (see `getFunctions`
// in services/firebase/config). There are deliberately no RTDB triggers: a
// trigger on the game node would fire on every single move, so all server work
// is driven by the sweep and by explicit, authenticated requests instead.
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

/** How many overdue games one sweep will process. Bounds a single run's work. */
const SWEEP_BATCH = 250;

/** Shared auth/argument checking for every callable. */
function requireCaller(auth: { uid: string } | undefined, gameId: unknown): [string, string] {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (typeof gameId !== 'string' || !gameId) {
    throw new HttpsError('invalid-argument', 'gameId is required.');
  }
  return [auth.uid, gameId];
}

/** Map a refusal from the authority layer onto the right error for the caller. */
function rejectIf(outcome: ActionOutcome): void {
  if (outcome === 'not_member') {
    throw new HttpsError('permission-denied', 'Not a player in this game.');
  }
  if (outcome === 'conflict') {
    throw new HttpsError('aborted', 'The game changed underneath you — try again.');
  }
}

/**
 * Play a move. This is the *only* way game state ever changes: clients cannot
 * write to `games/*` at all, so the board, the scores and the turn order are no
 * longer forgeable. The engine re-validates everything here — whose turn it is,
 * whether the line is free, whether the player is still in the game — and if the
 * move completes the board, the result is written in this same call.
 */
export const playMove = onCall<{ gameId?: string; line?: Line }>(async (request) => {
  const [uid, gameId] = requireCaller(request.auth, request.data?.gameId);
  const line = request.data?.line;
  if (!line || typeof line.row !== 'number' || typeof line.col !== 'number') {
    throw new HttpsError('invalid-argument', 'A line {orientation,row,col} is required.');
  }
  if (line.orientation !== 'horizontal' && line.orientation !== 'vertical') {
    throw new HttpsError('invalid-argument', 'line.orientation must be horizontal or vertical.');
  }

  const res = await playMoveByUid(db(), gameId, uid, line, Date.now());
  rejectIf(res.outcome);
  // A rejected move is a normal outcome (a stale tap, a raced line), not an
  // error — the client simply rolls back to the authoritative state.
  return { ok: res.outcome === 'ok', reason: res.outcome };
});

/**
 * Turn-clock enforcement. Any player in the game may ask — the server checks the
 * deadline against its own clock, so nobody can rush it. Crucially it is *not*
 * limited to the player whose turn it is: when the active player is the one who
 * dropped, they are exactly the client who cannot ask.
 */
export const requestTurnTimeout = onCall<{ gameId?: string }>(async (request) => {
  const [uid, gameId] = requireCaller(request.auth, request.data?.gameId);
  const res = await timeoutExpiredTurnsByMember(db(), gameId, uid, Date.now());
  rejectIf(res.outcome);
  return { ok: res.outcome === 'ok' };
});

/** Explicit leave — a concession. Only a player in the game may forfeit themselves. */
export const forfeitGame = onCall<{ gameId?: string }>(async (request) => {
  const [uid, gameId] = requireCaller(request.auth, request.data?.gameId);
  const res = await forfeitByUid(db(), gameId, uid, Date.now());
  rejectIf(res.outcome);
  return { ok: res.outcome === 'ok' };
});

/**
 * Backstop for games nobody is connected to.
 *
 * While a player is present their client asks for a timeout the moment a clock
 * runs out, so this is not the fast path — it exists for when *everyone* has
 * gone and no client is left to ask.
 *
 * It reads the `activeGames` due-index (`gameId -> turn deadline`) and pulls only
 * the games actually overdue, rather than every live game. Sweep cost therefore
 * tracks the number of *overdue* games, not the number of *active* ones, so a
 * thousand healthy games in progress cost essentially nothing to sweep past.
 */
export const sweepAbandonedGames = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const due = await db()
      .ref('activeGames')
      .orderByValue()
      .endAt(Date.now())
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
          // With server-side moves this should never fire, but a game left
          // behind by an older client still must not hang.
          const finalized = await finalizeIfComplete(db(), gameId, Date.now());
          if (finalized.outcome === 'ok') {
            logger.info('finalized a completed board', { gameId });
            return;
          }
          const timed = await timeoutExpiredTurns(db(), gameId, Date.now());
          if (timed.outcome === 'ok') logger.info('applied overdue turn timeouts', { gameId });
        } catch (err) {
          logger.error('sweep failed', { gameId, err });
        }
      }),
    );
  },
);
