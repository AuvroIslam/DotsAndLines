import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { normalizeGame } from '@/services/firebase/rtdbSerialize';
import type { GameState, Line } from '@/types';

import {
  forfeitByUid,
  playMoveByUid,
  settleResults,
  timeoutExpiredTurns,
  timeoutExpiredTurnsByMember,
  type ActionOutcome,
} from './authority';
import { createGameFromMatch, createGameFromRoom, createRematch } from './createGame';

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

/** How many entries one sweep will process from each due-index. */
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
 * Create a game.
 *
 * The client says which room it wants to start, which opponent it claimed, or
 * which finished game to rematch — never *what the game is*. The board size,
 * clock, starting player and player list are all derived here from state the
 * client cannot write, which is what stops a host from handing themselves a
 * forced win by shipping a one-second turn clock.
 */
export const createGame = onCall<{
  source?: 'room' | 'match' | 'rematch';
  roomId?: string;
  opponentUid?: string;
  fromGameId?: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { source, roomId, opponentUid, fromGameId } = request.data ?? {};
  let res;

  if (source === 'room' && roomId) {
    res = await createGameFromRoom(db(), uid, roomId);
  } else if (source === 'match' && opponentUid) {
    res = await createGameFromMatch(db(), uid, opponentUid);
  } else if (source === 'rematch' && fromGameId) {
    res = await createRematch(db(), uid, fromGameId);
  } else {
    throw new HttpsError('invalid-argument', 'A valid source and its target are required.');
  }

  if (!res.ok) {
    if (res.reason === 'not_allowed') {
      throw new HttpsError('permission-denied', 'Not allowed to start this game.');
    }
    if (res.reason === 'not_found') throw new HttpsError('not-found', 'Nothing to start.');
    throw new HttpsError('failed-precondition', res.reason);
  }

  logger.info('game created', { gameId: res.gameId, source, uid });
  return { gameId: res.gameId };
});

/**
 * Play a move. This is the *only* way game state ever changes: clients cannot
 * write to `games/*` at all, so the board, the scores and the turn order are not
 * forgeable. The engine re-validates everything here — whose turn it is, whether
 * the line is a real edge and still free, whether the player is still in the
 * game — and if the move completes the board, the result is written in this same
 * call.
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

  // Note: coordinates are *not* range/integer-checked here on purpose. The
  // engine's MoveValidator is the single source of legality shared with the
  // client, so a duplicate check here could drift out of step with it.
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

/** Read the ids currently due in one of the lifecycle indexes. */
async function dueIn(index: string, by: number): Promise<string[]> {
  const snap = await db()
    .ref(index)
    .orderByValue()
    .endAt(by)
    .limitToFirst(SWEEP_BATCH)
    .once('value');
  return Object.keys((snap.val() as Record<string, number> | null) ?? {});
}

/**
 * The janitor. Everything time-based that no client is around to drive.
 *
 * Each step reads a due-index rather than scanning games, so the cost tracks the
 * work actually outstanding — a thousand healthy games in progress cost nothing
 * to sweep past.
 */
export const sweepAbandonedGames = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const now = Date.now();

    // 1. Abandoned games. The fast path is a present player's client asking for
    //    the timeout the moment a clock runs out; this is for when everyone has
    //    gone and there is no client left to ask.
    const overdue = await dueIn('activeGames', now);
    if (overdue.length) logger.info('sweeping overdue games', { count: overdue.length });
    await Promise.all(
      overdue.map(async (gameId) => {
        try {
          const res = await timeoutExpiredTurns(db(), gameId, Date.now());
          if (res.outcome === 'ok') logger.info('applied overdue turn timeouts', { gameId });
        } catch (err) {
          logger.error('timeout sweep failed', { gameId, err });
        }
      }),
    );

    // 2. Results owed. Normally written the instant a game ends; this catches a
    //    game whose invocation died between finishing and recording, so nobody
    //    silently loses a win.
    const owed = await dueIn('pendingResults', now);
    if (owed.length) logger.info('settling owed results', { count: owed.length });
    await Promise.all(
      owed.map(async (gameId) => {
        try {
          const game = normalizeGame(
            (await db().ref(`games/${gameId}`).get()).val() as GameState | null,
          );
          if (!game?.result) {
            await db().ref(`pendingResults/${gameId}`).remove(); // nothing to record
            return;
          }
          await settleResults(db(), gameId, game);
          logger.info('settled results', { gameId });
        } catch (err) {
          logger.error('result settling failed', { gameId, err });
        }
      }),
    );

    // 3. Expired games. Without this, every game ever played is kept forever.
    const expired = await dueIn('finishedGames', now);
    if (expired.length) logger.info('deleting expired games', { count: expired.length });
    await Promise.all(
      expired.map(async (gameId) => {
        try {
          await db().ref().update({
            [`games/${gameId}`]: null,
            [`gameMembers/${gameId}`]: null,
            [`gamePresence/${gameId}`]: null,
            [`activeGames/${gameId}`]: null,
            [`pendingResults/${gameId}`]: null,
            [`finishedGames/${gameId}`]: null,
          });
        } catch (err) {
          logger.error('game deletion failed', { gameId, err });
        }
      }),
    );
  },
);
