import type { GameState, PlayerId } from '@/types';

/**
 * Turns "old game -> new game" into the smallest set of RTDB paths that changed.
 *
 * This is the whole point of moving writes to the server. Previously every move
 * went through a whole-node transaction, so a ~3KB game was rewritten *and
 * re-broadcast to every subscriber* on each of the ~40 moves in a match. Writing
 * only the changed leaves takes that to a few hundred bytes, which at scale is
 * the difference between a four-figure monthly bill and a three-figure one.
 *
 * The diff is written out explicitly rather than derived by a generic deep-diff.
 * A generic walker is easy to get subtly wrong (deletions, empty maps, key
 * ordering), and silently dropping a field here would corrupt game state with no
 * error anywhere. Everything the engine can mutate is enumerated below, and
 * `gameDelta.test` proves that applying this diff to the previous state
 * reproduces the next state *exactly* — so a field added to the engine later
 * can't quietly go missing.
 */
export function diffGamePaths(
  gameId: string,
  prev: GameState,
  next: GameState,
): Record<string, unknown> {
  const root = `games/${gameId}`;
  const updates: Record<string, unknown> = {};

  // The concurrency token always advances on an authoritative write.
  if (next.version !== prev.version) updates[`${root}/version`] = next.version;

  // Turn / lifecycle scalars.
  if (next.phase !== prev.phase) updates[`${root}/phase`] = next.phase;
  if (next.currentTurn !== prev.currentTurn) updates[`${root}/currentTurn`] = next.currentTurn;
  if (next.turnStartedAt !== prev.turnStartedAt) {
    updates[`${root}/turnStartedAt`] = next.turnStartedAt;
  }
  if ((next.pendingBonusMoves ?? 0) !== (prev.pendingBonusMoves ?? 0)) {
    updates[`${root}/pendingBonusMoves`] = next.pendingBonusMoves ?? 0;
  }
  if (next.updatedAt !== prev.updatedAt) updates[`${root}/updatedAt`] = next.updatedAt;

  // The result is only ever written once, at the end, and is small — send it whole.
  if (next.result !== prev.result) updates[`${root}/result`] = next.result;

  // End-of-life bookkeeping. `resultsRecorded` must ride along in the same write
  // as the result itself, or a retried invocation could count a player's win twice.
  if (next.resultsRecorded !== prev.resultsRecorded) {
    updates[`${root}/resultsRecorded`] = next.resultsRecorded ?? null;
  }
  if (next.rematchGameId !== prev.rematchGameId) {
    updates[`${root}/rematchGameId`] = next.rematchGameId ?? null;
  }
  if (next.rematchOffers !== prev.rematchOffers) {
    updates[`${root}/rematchOffers`] = next.rematchOffers ?? null;
  }

  // Lines and boxes are only ever *added* (a drawn line is never undrawn), so a
  // key-by-key add is sufficient and no deletions are possible.
  for (const [key, owner] of Object.entries(next.board.lines)) {
    if (prev.board.lines[key] !== owner) updates[`${root}/board/lines/${key}`] = owner;
  }
  for (const [key, owner] of Object.entries(next.board.boxes)) {
    if (prev.board.boxes[key] !== owner) updates[`${root}/board/boxes/${key}`] = owner;
  }

  // Per-player scalars the engine can touch.
  for (const id of Object.keys(next.players) as PlayerId[]) {
    const a = prev.players[id];
    const b = next.players[id]!;
    const base = `${root}/players/${id}`;
    if (!a) {
      // A player appearing mid-game shouldn't happen, but write them whole
      // rather than silently lose them.
      updates[base] = b;
      continue;
    }
    if (a.score !== b.score) updates[`${base}/score`] = b.score;
    if (a.isEliminated !== b.isEliminated) updates[`${base}/isEliminated`] = b.isEliminated;
    if (a.consecutiveMisses !== b.consecutiveMisses) {
      updates[`${base}/consecutiveMisses`] = b.consecutiveMisses;
    }
  }

  return updates;
}
