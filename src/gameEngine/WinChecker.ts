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
    let highest = -1;
    for (const id of state.turnOrder) {
      const s = scores[id] ?? 0;
      if (s > highest) highest = s;
    }
    const winners = state.turnOrder.filter((id) => (scores[id] ?? 0) === highest);
    return {
      phase: 'finished',
      winners,
      isDraw: winners.length > 1,
      scores,
    };
  }
}
