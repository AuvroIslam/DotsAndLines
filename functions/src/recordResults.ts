import { getFirestore } from 'firebase-admin/firestore';

import { applyOutcome, emptyStatistics, opponentsOf, outcomeFor } from '@/gameEngine/MatchResult';
import type { GameState, MatchHistoryEntry, UserStatistics } from '@/types';

/**
 * Records the outcome of a finished game for every player.
 *
 * This used to be done by each client for itself, which made the leaderboard
 * free money: `statistics/{uid}` was owner-writable, so anyone could simply write
 * themselves nine thousand wins without playing a game at all. Cheat-proof moves
 * are worth very little next to a forgeable win record, so the server writes the
 * record and clients can only read it.
 *
 * Idempotency matters here — statistics are a running total, and double-counting
 * a win is not something a player would ever report. Two guards:
 *  - the history document is keyed by `gameId`, so a re-run overwrites rather
 *    than appends;
 *  - `resultsRecorded` is set on the game in the same delta as the result, so a
 *    retried invocation skips this entirely.
 */
export async function recordGameResults(game: GameState): Promise<void> {
  if (!game.result) return;

  const db = getFirestore();
  const playedAt = game.updatedAt || Date.now();

  await Promise.all(
    game.turnOrder.map(async (playerId) => {
      const me = game.players[playerId];
      if (!me) return;

      const outcome = outcomeFor(game.result!, playerId);

      const entry: MatchHistoryEntry = {
        // Keyed by game, not a random id: replaying this write is then a no-op
        // rather than a duplicate row in the player's history.
        id: game.id,
        gameId: game.id,
        mode: game.mode,
        boardSize: game.board.size,
        playerCount: game.turnOrder.length,
        outcome,
        myScore: me.score,
        opponents: opponentsOf(game, playerId),
        playedAt,
      };

      const historyRef = db.doc(`users/${me.uid}/matchHistory/${game.id}`);
      const statsRef = db.doc(`statistics/${me.uid}`);

      await db.runTransaction(async (tx) => {
        // If this game is already in the player's history, its statistics were
        // folded in on that same pass — don't count it twice.
        const existing = await tx.get(historyRef);
        if (existing.exists) return;

        const snap = await tx.get(statsRef);
        const prev = (snap.data() as UserStatistics | undefined) ?? emptyStatistics(me.uid);

        tx.set(historyRef, entry);
        tx.set(statsRef, applyOutcome(prev, outcome, me.score));
      });
    }),
  );
}
