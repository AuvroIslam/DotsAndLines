import type { Reference } from 'firebase-admin/database';

import { GameManager, WinChecker } from '@/gameEngine';
import { normalizeGame } from '@/services/firebase/rtdbSerialize';
import type { GameState } from '@/types';

/**
 * Server-side game-ending logic. Every function here runs the *same pure engine*
 * the client uses, inside an RTDB transaction, so the server is the single
 * authority for any terminal state while staying rule-for-rule identical to the
 * optimistic client. All game-ending writes (turn timeout, explicit forfeit,
 * normal completion) flow through this module.
 *
 * Note there is deliberately no presence-based forfeit: a network drop, a
 * backgrounded app and an idle player look identical from here, so none of them
 * end a match directly. They simply cost the player turns, and a player who
 * misses enough turns in a row is eliminated. Presence (`isConnected`,
 * heartbeats) is cosmetic — it drives the "reconnecting…" banner and nothing
 * else, so it can never be gamed to steal or stall a result.
 *
 * Each `transaction` update fn returns `undefined` to abort (no write) — the
 * same convention the client repository uses — so a no-op or an invalid state
 * never rewrites the node.
 */

export type ActionOutcome = 'ok' | 'not_member' | 'noop';

/** Safety bound so a long-abandoned game can never spin the catch-up loop. */
const MAX_CATCHUP_TURNS = 32;

/**
 * The Admin SDK first calls a transaction's update fn with the *locally cached*
 * value, and if nothing keeps that cache warm it is `null` — so returning
 * `undefined` (our abort convention) on that first pass aborts before the
 * server value is ever read, silently dropping a legitimate action. Holding a
 * live `on('value')` listener across the transaction keeps the current state
 * synced into the cache, so the first update-fn call sees the real value.
 */
async function primedTransaction(
  ref: Reference,
  update: (current: GameState | null) => GameState | undefined,
): Promise<{ committed: boolean }> {
  const listener = ref.on('value', () => {});
  try {
    await ref.once('value'); // wait for the listener to sync current data
    const res = await ref.transaction(update);
    return { committed: res.committed };
  } finally {
    ref.off('value', listener);
  }
}

/**
 * Apply every turn whose clock has already expired, attributing each missed
 * turn to the player it belonged to. Replaying elapsed windows (rather than
 * just advancing once) means a game nobody is connected to still resolves
 * correctly on the next sweep, instead of creeping forward one turn per minute.
 *
 * Returns the next state, or `undefined` if nothing was due.
 */
function catchUpExpiredTurns(state: GameState, now: number): GameState | undefined {
  let next = state;
  let changed = false;

  for (let i = 0; i < MAX_CATCHUP_TURNS; i += 1) {
    if (next.phase !== 'playing') break;
    // A completed board is finished, not idle — never charge a miss for the
    // gap between the winning move and `finalizeGame` writing the result.
    if (WinChecker.isGameOver(next)) break;

    const deadline = next.turnStartedAt + next.turnDurationMs;
    if (deadline > now) break;

    // Time the miss at the instant the clock actually ran out, so the following
    // turn's window starts from there rather than from "whenever we noticed".
    next = GameManager.timeoutTurn(next, deadline);
    changed = true;
  }

  return changed ? next : undefined;
}

/**
 * Turn-clock enforcement — the mechanism that ends abandoned games. Safe for
 * any member to request and for the scheduled sweep to run: the deadline is
 * always re-checked against the server's own clock, so no client can rush it.
 */
export async function timeoutExpiredTurns(ref: Reference, now: number): Promise<boolean> {
  const res = await primedTransaction(ref, (current) => {
    const state = normalizeGame(current);
    if (!state || state.phase !== 'playing') return undefined;
    return catchUpExpiredTurns(state, now);
  });
  return res.committed;
}

/** As above, but for a callable: verifies the requester actually plays in this game. */
export async function timeoutExpiredTurnsByMember(
  ref: Reference,
  uid: string,
  now: number,
): Promise<ActionOutcome> {
  let outcome: ActionOutcome = 'noop';
  await primedTransaction(ref, (current) => {
    const state = normalizeGame(current);
    if (!state || state.phase !== 'playing') {
      outcome = 'noop';
      return undefined;
    }
    if (!Object.values(state.players).some((p) => p.uid === uid)) {
      outcome = 'not_member';
      return undefined;
    }
    const next = catchUpExpiredTurns(state, now);
    outcome = next ? 'ok' : 'noop'; // noop: nothing was actually overdue
    return next;
  });
  return outcome;
}

/**
 * Write the terminal state for a normally-completed board. Runs after any board
 * write; aborts unless the board is actually full and the game is still playing,
 * so clients can persist the winning move without ever writing `finished`/`result`.
 */
export async function finalizeIfComplete(ref: Reference, now: number): Promise<boolean> {
  const res = await primedTransaction(ref, (current) => {
    const state = normalizeGame(current);
    if (!state || state.phase !== 'playing') return undefined;
    if (!WinChecker.isGameOver(state)) return undefined;
    return { ...state, phase: 'finished', result: WinChecker.getResult(state), updatedAt: now };
  });
  return res.committed;
}

/**
 * Explicit leave. Verifies the caller is a player in the game, then forfeits
 * them outright — quitting is a concession, so whoever is left simply wins.
 */
export async function forfeitByUid(
  ref: Reference,
  uid: string,
  now: number,
): Promise<ActionOutcome> {
  let outcome: ActionOutcome = 'noop';
  await primedTransaction(ref, (current) => {
    const state = normalizeGame(current);
    if (!state) {
      outcome = 'noop';
      return undefined;
    }
    const me = Object.values(state.players).find((p) => p.uid === uid);
    if (!me) {
      outcome = 'not_member';
      return undefined;
    }
    if (state.phase !== 'playing' || me.isEliminated) {
      outcome = 'noop';
      return undefined;
    }
    outcome = 'ok';
    return GameManager.forfeit(state, me.id, now);
  });
  return outcome;
}
