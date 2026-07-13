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
  /** Permanently out of the match (forfeited or timed out). */
  isEliminated: boolean;
  /**
   * Turns this player has let expire back-to-back, reset to 0 the moment they
   * play. This — not their connection state — is what ends an abandoned match:
   * a disconnect, a backgrounded app and plain idling are indistinguishable to
   * the server, so all three simply cost you turns. At
   * `MAX_CONSECUTIVE_MISSES` the player is eliminated (see `GameManager`).
   */
  consecutiveMisses: number;
  score: number;
}

/**
 * A player's live connection state, stored *outside* the game (see
 * `RtdbPaths.gamePresence`) and deliberately not part of `GameState`.
 *
 * Presence is high-churn — a heartbeat every few seconds per player — while
 * game state only changes when someone actually moves. Keeping them in one node
 * would mean every heartbeat rewrote the game and pushed a fresh snapshot to
 * every subscriber, which is the difference between O(moves) and O(players/sec)
 * traffic once there are many concurrent games.
 *
 * It is also purely cosmetic: it drives the "reconnecting…" banner and the
 * offline dot, and decides nothing. Being away never loses you a match —
 * missing turns does.
 */
export interface PlayerPresence {
  isConnected: boolean;
  /** Server timestamp of the current disconnect episode, or null while connected. */
  disconnectedAt: number | null;
  /**
   * Server timestamp of this player's last heartbeat. A stale value is what
   * detects a silent network loss (see `HEARTBEAT_STALE_MS`) — `onDisconnect`
   * alone can take a long time to notice one, since it depends on the server's
   * own connection timeout rather than an immediate signal.
   */
  lastSeenAt: number | null;
}

/** Presence for every player in one game, keyed by PlayerId. */
export type GamePresence = Record<PlayerId, PlayerPresence>;

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

/**
 * Why a game ended early:
 *  - `forfeit`: someone explicitly left (an outright concession).
 *  - `timeout`: someone was eliminated for missing too many turns in a row —
 *    which is how a disconnect, a backgrounded app, or an idle player all end.
 * A `timeout` ending with no winners is a no-contest: everyone stopped playing.
 */
export type GameEndReason = 'forfeit' | 'timeout';

export interface GameResult {
  phase: 'finished';
  winners: PlayerId[];
  isDraw: boolean;
  scores: Record<PlayerId, number>;
  /** Set when the game ended early rather than by a completed board. */
  reason?: GameEndReason;
}

/** Full game snapshot as stored in Realtime Database. */
export interface GameState {
  id: string;
  /**
   * Optimistic-concurrency token, bumped by the server on every authoritative
   * write. Purely a persistence concern — the engine never reads it.
   *
   * Writes used to be guarded by a whole-node RTDB transaction, which is exactly
   * what forced every move to rewrite (and re-broadcast) the entire game. The
   * server now compare-and-swaps this instead, then persists only the fields
   * that actually changed. Two racing moves cannot both win the swap, so a
   * double-tap or a stale client is rejected rather than applied twice.
   */
  version: number;
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
