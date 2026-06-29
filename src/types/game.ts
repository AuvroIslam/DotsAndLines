/**
 * Core domain types for the Dots & Boxes game.
 * These are pure data contracts shared by the (framework-agnostic) game engine,
 * the realtime services, and the UI. No React or Firebase types belong here.
 */

export type BoardSize = 3 | 4 | 5;

export type LineOrientation = 'horizontal' | 'vertical';

/** Unique id for a player within a single game (P1..P4). */
export type PlayerId = string;

/** Index of a player slot in the game (0-based). */
export type PlayerIndex = 0 | 1 | 2 | 3;

export type GamePhase = 'waiting' | 'playing' | 'finished';

export type GameMode = 'friend' | 'random';

/**
 * A line (edge) between two adjacent dots.
 * For a board with `size` boxes per row, there are `size + 1` dots per row.
 * - Horizontal line at (row, col): connects dot(row, col) -> dot(row, col + 1).
 * - Vertical line at (row, col):   connects dot(row, col) -> dot(row + 1, col).
 */
export interface Line {
  orientation: LineOrientation;
  row: number;
  col: number;
}

/** Stable string key for a line, used as a map key in board state. */
export type LineKey = string;

/** A box (cell) on the board, identified by its top-left dot coordinate. */
export interface Box {
  row: number;
  col: number;
}

export interface Player {
  id: PlayerId;
  uid: string;
  index: PlayerIndex;
  displayName: string;
  color: string;
  isConnected: boolean;
  score: number;
}

/**
 * Serializable snapshot of the board.
 * `lines` maps a LineKey -> the PlayerId who drew it.
 * `boxes` maps a box key -> the PlayerId who completed it.
 */
export interface BoardState {
  size: BoardSize;
  lines: Record<LineKey, PlayerId>;
  boxes: Record<LineKey, PlayerId>;
}

export interface MoveResult {
  /** The move that was applied. */
  line: Line;
  /** Boxes completed by this move (0, 1, or 2). */
  completedBoxes: Box[];
  /** Whether the same player moves again (true when >=1 box completed). */
  extraTurn: boolean;
}

export interface GameResult {
  phase: 'finished';
  winners: PlayerId[];
  isDraw: boolean;
  scores: Record<PlayerId, number>;
}

/** Full game snapshot as stored in Realtime Database. */
export interface GameState {
  id: string;
  mode: GameMode;
  phase: GamePhase;
  board: BoardState;
  players: Record<PlayerId, Player>;
  /** Ordered list of PlayerIds defining turn rotation. */
  turnOrder: PlayerId[];
  currentTurn: PlayerId;
  turnStartedAt: number;
  turnDurationMs: number;
  createdAt: number;
  updatedAt: number;
  result: GameResult | null;
}
