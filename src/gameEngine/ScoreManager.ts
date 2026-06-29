import type { BoardState, PlayerId } from '@/types';

/**
 * Derives player scores from the authoritative box ownership map.
 * Score is always recomputed from board state (never tracked separately) so it
 * cannot drift from the source of truth.
 */
export class ScoreManager {
  static computeScores(board: BoardState, playerIds: PlayerId[]): Record<PlayerId, number> {
    const scores: Record<PlayerId, number> = {};
    for (const id of playerIds) scores[id] = 0;
    for (const owner of Object.values(board.boxes)) {
      if (scores[owner] !== undefined) scores[owner] += 1;
      else scores[owner] = 1;
    }
    return scores;
  }

  static scoreFor(board: BoardState, playerId: PlayerId): number {
    let count = 0;
    for (const owner of Object.values(board.boxes)) {
      if (owner === playerId) count += 1;
    }
    return count;
  }
}
