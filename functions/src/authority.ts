import type { Reference } from 'firebase-admin/database';

import { GameManager, PresenceChecker, WinChecker } from '@/gameEngine';
import { normalizeGame } from '@/services/firebase/rtdbSerialize';
import type { GameState } from '@/types';
import { RECONNECT_MAX_DELAY_MS } from '@/utils/constants';

/**
 * Server-side game-ending logic. Every function here runs the *same pure engine*
 * the client uses, inside an RTDB transaction, so the server is the single
 * authority for any terminal state while staying rule-for-rule identical to the
 * optimistic client. All game-ending writes (disconnect forfeit, explicit
 * forfeit, turn-timeout skip, normal completion) flow through this module.
 *
 * Each `transaction` update fn returns `undefined` to abort (no write) — the
 * same convention the client repository uses — so a no-op or an invalid state
 * never rewrites the node.
 */

export type ActionOutcome = 'ok' | 'not_member' | 'noop';

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
 * Forfeit every non-eliminated player whose away-grace period has elapsed.
 * Away-status is re-derived from the *current* server state inside the
 * transaction (not trusted from the caller), so a reconnect-then-away-again
 * race can't fire a stale verdict. Returns true if the game state changed.
 */
export async function forfeitTimedOutPlayers(ref: Reference, now: number): Promise<boolean> {
  const res = await primedTransaction(ref, (current) => {
    const state = normalizeGame(current);
    if (!state || state.phase !== 'playing') return undefined;

    let next = state;
    let changed = false;
    for (const id of state.turnOrder) {
      const p = next.players[id];
      if (!p || p.isEliminated) continue;
      const awaySince = PresenceChecker.awaySince(p, now);
      if (awaySince == null) continue;
      if (awaySince + RECONNECT_MAX_DELAY_MS > now) continue; // still within grace
      next = GameManager.forfeit(next, id, now);
      changed = true;
      if (next.phase !== 'playing') break; // game already ended
    }
    return changed ? next : undefined;
  });
  return res.committed;
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

/** Explicit leave. Verifies the caller is a player in the game, then forfeits them. */
export async function forfeitByUid(ref: Reference, uid: string, now: number): Promise<ActionOutcome> {
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

/**
 * Advance the turn when the active player's timer has genuinely expired. Any
 * player in the game may request it; the server validates the deadline against
 * its own clock, so no client can race the timer early.
 */
export async function skipExpiredTurn(ref: Reference, uid: string, now: number): Promise<ActionOutcome> {
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
    if (state.turnStartedAt + state.turnDurationMs > now) {
      outcome = 'noop'; // not expired yet
      return undefined;
    }
    outcome = 'ok';
    return GameManager.skipTurn(state, now);
  });
  return outcome;
}
