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

/** Network / reconnect tuning. */
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 15_000;
export const PRESENCE_HEARTBEAT_MS = 4_000;
/**
 * A player is considered "away" if their heartbeat hasn't refreshed within
 * this window (~2.5 missed beats of tolerance). This is what actually catches
 * a silent network loss (WiFi/airplane mode) in bounded time — RTDB's
 * `onDisconnect` alone can take a long time (sometimes minutes) to fire for a
 * connection that dies without a graceful close, since it relies on the
 * server's own keepalive timeout rather than an immediate signal.
 */
export const HEARTBEAT_STALE_MS = PRESENCE_HEARTBEAT_MS * 2.5;

/** Randomized "thinking" delay before a local AI opponent plays its move. */
export const AI_MOVE_MIN_DELAY_MS = 500;
export const AI_MOVE_MAX_DELAY_MS = 900;
