import type { GameResult, GameState } from '@/types';

import { Board } from './Board';
import { ScoreManager } from './ScoreManager';

/**
 * Determines whether a game has ended and computes the final result.
 * A game ends when every box on the board is owned.
 */
export class WinChecker {
  static isGameOver(state: GameState): boolean {
    return Board.isFull(state.board);
  }

  static getResult(state: GameState): GameResult {
    const scores = ScoreManager.computeScores(state.board, state.turnOrder);
    // Eliminated players can never win, even if they hold the top score from
    // boxes claimed before they left — only currently-active players compete.
    const eligible = state.turnOrder.filter((id) => !state.players[id]?.isEliminated);
    const candidates = eligible.length > 0 ? eligible : state.turnOrder;
    let highest = -1;
    for (const id of candidates) {
      const s = scores[id] ?? 0;
      if (s > highest) highest = s;
    }
    const winners = candidates.filter((id) => (scores[id] ?? 0) === highest);
    return {
      phase: 'finished',
      winners,
      isDraw: winners.length > 1,
      scores,
    };
  }
}
