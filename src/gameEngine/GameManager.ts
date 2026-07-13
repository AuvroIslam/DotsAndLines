import type {
  BoardSize,
  GameEndReason,
  GameMode,
  GameState,
  Line,
  MoveResult,
  Player,
  PlayerId,
} from '@/types';
import { MAX_CONSECUTIVE_MISSES, TURN_DURATION_MS } from '@/utils/constants';

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
    for (const p of sorted) {
      players[p.id] = { ...p, score: 0, isEliminated: false, consecutiveMisses: 0 };
    }
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
      GameManager.activePlayerIds(state.turnOrder, state.players),
    );

    const scores = ScoreManager.computeScores(board, state.turnOrder);
    const players: Record<PlayerId, Player> = {};
    for (const id of state.turnOrder) {
      const p = state.players[id]!;
      // Playing clears your missed-turn streak: only a player who has actually
      // stopped participating carries a non-zero count, which is what lets the
      // timeout path tell a live opponent apart from an abandoned game.
      players[id] = {
        ...p,
        score: scores[id] ?? 0,
        consecutiveMisses: id === playerId ? 0 : p.consecutiveMisses,
      };
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
    const nextTurn = TurnManager.next(
      state.turnOrder,
      state.currentTurn,
      GameManager.activePlayerIds(state.turnOrder, state.players),
    );
    return { ...state, currentTurn: nextTurn, turnStartedAt: now, updatedAt: now };
  }

  static isGameOver(state: GameState): boolean {
    return WinChecker.isGameOver(state);
  }

  /**
   * Explicit leave — an outright concession, so whoever is left wins straight
   * away with no further conditions.
   */
  static forfeit(state: GameState, playerId: PlayerId, now: number = Date.now()): GameState {
    if (state.phase !== 'playing') return state;
    return GameManager.eliminate(state, playerId, now, 'forfeit');
  }

  /**
   * The active player let their turn clock run out. Counts the miss and passes
   * play on; once they reach `MAX_CONSECUTIVE_MISSES` they're eliminated, which
   * ends the match if nobody else is left.
   *
   * This is the single path by which an abandoned game resolves. A network
   * drop, a backgrounded app and a player who simply isn't looking at their
   * phone are indistinguishable to the server — so rather than guess, none of
   * them are punished directly: they just cost you turns, exactly like a shot
   * clock. A brief interruption costs a turn; genuinely leaving costs the match.
   */
  static timeoutTurn(state: GameState, now: number = Date.now()): GameState {
    if (state.phase !== 'playing') return state;
    const playerId = state.currentTurn;
    const player = state.players[playerId];
    if (!player || player.isEliminated) return GameManager.skipTurn(state, now);

    const misses = player.consecutiveMisses + 1;
    const withMiss: GameState = {
      ...state,
      players: { ...state.players, [playerId]: { ...player, consecutiveMisses: misses } },
    };

    return misses >= MAX_CONSECUTIVE_MISSES
      ? GameManager.eliminate(withMiss, playerId, now, 'timeout')
      : GameManager.skipTurn(withMiss, now);
  }

  /**
   * Permanently remove `playerId` from play. Ends the game immediately if at
   * most one active player remains — which is why a 2-player game resolves as
   * an instant win for the other side, with no special-casing by player count.
   * Otherwise play continues and turn rotation skips them from here on.
   */
  private static eliminate(
    state: GameState,
    playerId: PlayerId,
    now: number,
    reason: GameEndReason,
  ): GameState {
    const player = state.players[playerId];
    if (!player || player.isEliminated) return state;

    const players: Record<PlayerId, Player> = {
      ...state.players,
      [playerId]: { ...player, isEliminated: true },
    };
    const remaining = GameManager.activePlayerIds(state.turnOrder, players);

    if (remaining.length <= 1) {
      // The board hasn't changed, so each player's score is already current —
      // no need to re-derive it from board.boxes via ScoreManager.
      const scores: Record<PlayerId, number> = {};
      for (const id of state.turnOrder) scores[id] = players[id]!.score;

      // A timeout only awards the win to someone still actually playing (a
      // zero missed-turn streak, since any move resets it). If the last player
      // standing had also stopped responding, nobody wins — the match is a
      // no-contest, rather than handing victory to whoever merely happened to
      // run out of turns second.
      const winners =
        reason === 'timeout'
          ? remaining.filter((id) => players[id]!.consecutiveMisses === 0)
          : remaining;

      return {
        ...state,
        players,
        phase: 'finished',
        result: {
          phase: 'finished',
          winners,
          isDraw: winners.length !== 1,
          scores,
          reason,
        },
        updatedAt: now,
      };
    }

    const wasTheirTurn = state.currentTurn === playerId;
    return {
      ...state,
      players,
      currentTurn: wasTheirTurn
        ? TurnManager.next(state.turnOrder, playerId, remaining)
        : state.currentTurn,
      turnStartedAt: wasTheirTurn ? now : state.turnStartedAt,
      updatedAt: now,
    };
  }

  /** Players in `turnOrder` who haven't been eliminated, per `players`. */
  private static activePlayerIds(
    turnOrder: PlayerId[],
    players: Record<PlayerId, Player>,
  ): PlayerId[] {
    return turnOrder.filter((id) => !players[id]?.isEliminated);
  }
}
