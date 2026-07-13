import type { Database, Reference } from 'firebase-admin/database';

import { GameManager, WinChecker } from '@/gameEngine';
import { normalizeGame } from '@/services/firebase/rtdbSerialize';
import type { GameState, Line } from '@/types';

import { diffGamePaths } from './gameDelta';

/**
 * The server is the only writer of `games/*`. Every change — a move, a turn
 * timeout, a forfeit — runs the *same pure engine* the client uses, so client
 * and server can never disagree about the rules, and nothing a client sends is
 * taken on trust: the board, the turn and the clock are all re-derived here from
 * authoritative state.
 *
 * Writes are guarded by a compare-and-swap on `version` rather than a whole-node
 * transaction. A transaction would have to rewrite (and re-broadcast) the entire
 * game on every move; CAS lets us persist only the handful of fields that
 * actually changed. Two racing invocations cannot both win the swap, so a
 * double-tap or a stale client is rejected instead of applied twice.
 *
 * There is deliberately no presence-based forfeit: a network drop, a
 * backgrounded app and an idle player are indistinguishable from here, so none
 * of them end a match directly. They cost the player turns, and a player who
 * misses enough in a row is eliminated.
 */

export type ActionOutcome = 'ok' | 'not_member' | 'noop' | 'rejected' | 'conflict';

export interface AuthResult {
  outcome: ActionOutcome;
  state: GameState | null;
}

/** Safety bound so a long-abandoned game can never spin the catch-up loop. */
const MAX_CATCHUP_TURNS = 32;
/** How many times to re-read and retry when another invocation wins the swap. */
const MAX_CAS_ATTEMPTS = 4;

/** A pure transition. Return the next state, or null to abort with no write. */
type Mutate = (state: GameState) => GameState | null;

/**
 * The Admin SDK first calls a transaction's update fn with the *locally cached*
 * value, and if nothing keeps that cache warm it is `null` — so an abort on that
 * first pass would fire before the server value was ever read. Holding a live
 * listener across the transaction keeps the current value synced into the cache.
 */
async function casVersion(ref: Reference, expected: number): Promise<boolean> {
  const listener = ref.on('value', () => {});
  try {
    await ref.once('value');
    const res = await ref.transaction((current: number | null) => {
      if ((current ?? 0) !== expected) return undefined; // someone else moved first
      return expected + 1;
    });
    return res.committed;
  } finally {
    ref.off('value', listener);
  }
}

/**
 * Read → apply the engine → compare-and-swap the version → persist the delta.
 *
 * The deadline index is updated in the *same* multi-path write as the game, so
 * the two can never drift apart: a game is in `activeGames` exactly while it is
 * playable, and leaves the instant it ends.
 */
export async function applyAuthoritative(
  db: Database,
  gameId: string,
  mutate: Mutate,
): Promise<{ committed: boolean; state: GameState | null; conflict: boolean }> {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const snap = await db.ref(`games/${gameId}`).get();
    const state = normalizeGame(snap.val() as GameState | null);
    if (!state) return { committed: false, state: null, conflict: false };

    const next = mutate(state);
    if (!next) return { committed: false, state, conflict: false }; // caller aborted

    const versioned: GameState = { ...next, version: state.version + 1 };

    // Claim the write. Losing here means another invocation committed between
    // our read and now, so our engine result is stale — re-read and recompute.
    if (!(await casVersion(db.ref(`games/${gameId}/version`), state.version))) continue;

    const updates = diffGamePaths(gameId, state, versioned);
    delete updates[`games/${gameId}/version`]; // the CAS already wrote it

    // Re-arm (or clear) the due-index atomically with the game itself.
    updates[`activeGames/${gameId}`] =
      versioned.phase === 'playing' ? versioned.turnStartedAt + versioned.turnDurationMs : null;

    await db.ref().update(updates);
    return { committed: true, state: versioned, conflict: false };
  }

  return { committed: false, state: null, conflict: true };
}

/** Find the player this uid controls in the game, if any. */
const playerOf = (state: GameState, uid: string) =>
  Object.values(state.players).find((p) => p.uid === uid);

/**
 * Apply a move. The line, the turn, the board and the player's eligibility are
 * all validated server-side by the engine, so a client cannot draw out of turn,
 * redraw a line, play for someone else, or invent board state.
 *
 * If the move completes the board, this same call writes the final result — the
 * game can never be left sitting complete-but-unfinished.
 */
export async function playMoveByUid(
  db: Database,
  gameId: string,
  uid: string,
  line: Line,
  now: number,
): Promise<AuthResult> {
  let outcome: ActionOutcome = 'noop';

  const res = await applyAuthoritative(db, gameId, (state) => {
    const me = playerOf(state, uid);
    if (!me) {
      outcome = 'not_member';
      return null;
    }
    const applied = GameManager.applyMove(state, line, me.id, now);
    if (!applied.ok) {
      outcome = 'rejected'; // illegal: not their turn, already drawn, eliminated…
      return null;
    }
    outcome = 'ok';
    return applied.state; // already carries phase:'finished' + result if the board filled
  });

  if (res.conflict) return { outcome: 'conflict', state: null };
  return { outcome, state: res.state };
}

/**
 * Apply every turn whose clock has already expired, attributing each missed turn
 * to the player it belonged to. Replaying elapsed windows (rather than advancing
 * once) means a game nobody is connected to still resolves on the next sweep,
 * instead of creeping forward one turn per minute.
 */
function catchUpExpiredTurns(state: GameState, now: number): GameState | null {
  let next = state;
  let changed = false;

  for (let i = 0; i < MAX_CATCHUP_TURNS; i += 1) {
    if (next.phase !== 'playing') break;
    // A completed board is finished, not idle — never charge a miss for it.
    if (WinChecker.isGameOver(next)) break;

    const deadline = next.turnStartedAt + next.turnDurationMs;
    if (deadline > now) break;

    // Time the miss at the instant the clock actually ran out, so the following
    // turn's window starts from there rather than from "whenever we noticed".
    next = GameManager.timeoutTurn(next, deadline);
    changed = true;
  }

  return changed ? next : null;
}

/** Turn-clock enforcement for the sweep (no caller to authorize). */
export async function timeoutExpiredTurns(
  db: Database,
  gameId: string,
  now: number,
): Promise<AuthResult> {
  const res = await applyAuthoritative(db, gameId, (state) =>
    state.phase === 'playing' ? catchUpExpiredTurns(state, now) : null,
  );
  return { outcome: res.committed ? 'ok' : 'noop', state: res.state };
}

/**
 * Turn-clock enforcement requested by a player. Any member may ask — the server
 * re-checks the deadline against its own clock, so nobody can rush it. It is
 * deliberately not limited to the player whose turn it is: when the active
 * player is the one who dropped, they are exactly the client who cannot ask.
 */
export async function timeoutExpiredTurnsByMember(
  db: Database,
  gameId: string,
  uid: string,
  now: number,
): Promise<AuthResult> {
  let outcome: ActionOutcome = 'noop';

  const res = await applyAuthoritative(db, gameId, (state) => {
    if (!playerOf(state, uid)) {
      outcome = 'not_member';
      return null;
    }
    if (state.phase !== 'playing') {
      outcome = 'noop';
      return null;
    }
    const next = catchUpExpiredTurns(state, now);
    outcome = next ? 'ok' : 'noop'; // noop: nothing was actually overdue
    return next;
  });

  if (res.conflict) return { outcome: 'conflict', state: null };
  return { outcome, state: res.state };
}

/** Explicit leave — a concession, so whoever is left simply wins. */
export async function forfeitByUid(
  db: Database,
  gameId: string,
  uid: string,
  now: number,
): Promise<AuthResult> {
  let outcome: ActionOutcome = 'noop';

  const res = await applyAuthoritative(db, gameId, (state) => {
    const me = playerOf(state, uid);
    if (!me) {
      outcome = 'not_member';
      return null;
    }
    if (state.phase !== 'playing' || me.isEliminated) {
      outcome = 'noop';
      return null;
    }
    outcome = 'ok';
    return GameManager.forfeit(state, me.id, now);
  });

  if (res.conflict) return { outcome: 'conflict', state: null };
  return { outcome, state: res.state };
}

/**
 * Backstop only. `playMoveByUid` finalizes a completed board in the same call,
 * so this should never find work — it exists so a game written by an older
 * client, or left behind by a crash, still can't hang forever.
 */
export async function finalizeIfComplete(
  db: Database,
  gameId: string,
  now: number,
): Promise<AuthResult> {
  const res = await applyAuthoritative(db, gameId, (state) => {
    if (state.phase !== 'playing' || !WinChecker.isGameOver(state)) return null;
    return { ...state, phase: 'finished', result: WinChecker.getResult(state), updatedAt: now };
  });
  return { outcome: res.committed ? 'ok' : 'noop', state: res.state };
}
