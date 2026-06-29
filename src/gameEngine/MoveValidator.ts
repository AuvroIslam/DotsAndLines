import type { GameState, Line, PlayerId } from '@/types';

import { Board } from './Board';

export type MoveRejectionReason =
  'game_not_playing' | 'not_your_turn' | 'out_of_bounds' | 'already_drawn' | 'unknown_player';

export type ValidationResult = { valid: true } | { valid: false; reason: MoveRejectionReason };

/**
 * Stateless validation of a proposed move against a game snapshot.
 * The single source of truth for legality, used by both the local engine
 * and the authoritative server-side flow.
 */
export class MoveValidator {
  static validate(state: GameState, line: Line, playerId: PlayerId): ValidationResult {
    if (state.phase !== 'playing') {
      return { valid: false, reason: 'game_not_playing' };
    }
    if (state.players[playerId] === undefined) {
      return { valid: false, reason: 'unknown_player' };
    }
    if (state.currentTurn !== playerId) {
      return { valid: false, reason: 'not_your_turn' };
    }
    if (!Board.isLineInBounds(line, state.board.size)) {
      return { valid: false, reason: 'out_of_bounds' };
    }
    if (Board.isLineDrawn(state.board, line)) {
      return { valid: false, reason: 'already_drawn' };
    }
    return { valid: true };
  }

  static isValid(state: GameState, line: Line, playerId: PlayerId): boolean {
    return MoveValidator.validate(state, line, playerId).valid;
  }
}
