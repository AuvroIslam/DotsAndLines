import type { BoardSize, GameMode, GameState, Line, MoveResult, Player, PlayerId } from '@/types';
import { TURN_DURATION_MS } from '@/utils/constants';

import { Board } from './Board';
import { MoveValidator, type MoveRejectionReason, type ValidationResult } from './MoveValidator';
import { ScoreManager } from './ScoreManager';
import { TurnManager } from './TurnManager';
import { WinChecker } from './WinChecker';

export interface CreateGameParams {
  id: string;
  mode: GameMode;
  size: BoardSize;
  players: Player[];
  now?: number;
  turnDurationMs?: number;
}

export type ApplyMoveOutcome =
  { ok: true; state: GameState; result: MoveResult } | { ok: false; reason: MoveRejectionReason };

/**
 * Orchestrates a single game by composing the focused engine modules.
 *
 * Every method is a pure transformation: it takes a GameState (and inputs) and
 * returns a new GameState, never mutating its argument and never touching React
 * or Firebase. This is the *only* place the UI/network layer applies moves, so
 * client (optimistic) and server (authoritative) logic stay identical.
 */
export class GameManager {
  static create(params: CreateGameParams): GameState {
    const now = params.now ?? Date.now();
    const sorted = [...params.players].sort((a, b) => a.index - b.index);
    const players: Record<PlayerId, Player> = {};
    for (const p of sorted) players[p.id] = { ...p, score: 0 };
    const turnOrder = sorted.map((p) => p.id);

    return {
      id: params.id,
      mode: params.mode,
      phase: 'playing',
      board: Board.create(params.size),
      players,
      turnOrder,
      currentTurn: turnOrder[0]!,
      turnStartedAt: now,
      turnDurationMs: params.turnDurationMs ?? TURN_DURATION_MS,
      createdAt: now,
      updatedAt: now,
      result: null,
    };
  }

  static validateMove(state: GameState, line: Line, playerId: PlayerId): ValidationResult {
    return MoveValidator.validate(state, line, playerId);
  }

  /**
   * Apply a move. Returns the next immutable state plus a MoveResult describing
   * what happened, or an error reason if the move is illegal.
   */
  static applyMove(
    state: GameState,
    line: Line,
    playerId: PlayerId,
    now: number = Date.now(),
  ): ApplyMoveOutcome {
    const validation = MoveValidator.validate(state, line, playerId);
    if (!validation.valid) {
      return { ok: false, reason: validation.reason };
    }

    const { board, completedBoxes } = Board.applyLine(state.board, line, playerId);
    const { nextTurn, extraTurn } = TurnManager.resolveTurn(
      state.turnOrder,
      playerId,
      completedBoxes.length,
    );

    const scores = ScoreManager.computeScores(board, state.turnOrder);
    const players: Record<PlayerId, Player> = {};
    for (const id of state.turnOrder) {
      const p = state.players[id]!;
      players[id] = { ...p, score: scores[id] ?? 0 };
    }

    let next: GameState = {
      ...state,
      board,
      players,
      currentTurn: nextTurn,
      turnStartedAt: extraTurn ? state.turnStartedAt : now,
      updatedAt: now,
    };

    if (WinChecker.isGameOver(next)) {
      next = { ...next, phase: 'finished', result: WinChecker.getResult(next) };
    } else {
      // A fresh timer window starts whenever the active player changes.
      if (!extraTurn) next = { ...next, turnStartedAt: now };
    }

    const result: MoveResult = { line, completedBoxes, extraTurn };
    return { ok: true, state: next, result };
  }

  /**
   * Pass the turn (used when the turn timer expires). Treated as a no-box move.
   */
  static skipTurn(state: GameState, now: number = Date.now()): GameState {
    if (state.phase !== 'playing') return state;
    const nextTurn = TurnManager.next(state.turnOrder, state.currentTurn);
    return { ...state, currentTurn: nextTurn, turnStartedAt: now, updatedAt: now };
  }

  static isGameOver(state: GameState): boolean {
    return WinChecker.isGameOver(state);
  }
}
