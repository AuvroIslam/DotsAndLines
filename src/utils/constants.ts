import type { BoardSize } from '@/types';

/** Default turn timer (ms) before a move is auto-skipped / flagged. */
export const TURN_DURATION_MS = 30_000;

/** Allowed board sizes surfaced in the UI. */
export const BOARD_SIZES: BoardSize[] = [3, 4, 5];

/** Player count options per game mode. */
export const FRIEND_PLAYER_COUNTS = [2, 3, 4] as const;
export const RANDOM_PLAYER_COUNT = 2 as const;

/** Length of generated room join codes. */
export const ROOM_CODE_LENGTH = 6;

/**
 * How many turns a player may let expire back-to-back before they're
 * eliminated and the match ends. This is the *only* thing that ends an
 * abandoned game: a network drop, a backgrounded app and an idle player are
 * indistinguishable to the server, so all three are treated the same way —
 * they cost you turns, not the match outright. With the 30s turn timer above,
 * an abandoning player loses after ~90s, while a brief interruption (a phone
 * call, a tunnel) costs at most a turn or two and is fully recoverable.
 */
export const MAX_CONSECUTIVE_MISSES = 3;

/** Network / reconnect tuning. */
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const PRESENCE_HEARTBEAT_MS = 4_000;
/**
 * A player is considered "away" if their heartbeat hasn't refreshed within
 * this window (~2.5 missed beats of tolerance). Presence is *cosmetic only* —
 * it drives the "opponent is reconnecting…" banner and nothing else. It never
 * decides a winner, so it cannot be gamed by faking a connection state.
 */
export const HEARTBEAT_STALE_MS = PRESENCE_HEARTBEAT_MS * 2.5;

/** Randomized "thinking" delay before a local AI opponent plays its move. */
export const AI_MOVE_MIN_DELAY_MS = 500;
export const AI_MOVE_MAX_DELAY_MS = 900;
