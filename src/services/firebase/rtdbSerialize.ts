import type {
  BoardState,
  GamePresence,
  GameResult,
  GameState,
  Player,
  PlayerId,
} from '@/types';

/**
 * Realtime Database omits empty objects/arrays (they read back as `null`).
 * These helpers keep our domain objects well-formed when crossing that boundary
 * so the rest of the app never has to null-check engine state.
 */

export function normalizeBoard(
  raw: Partial<BoardState> | null | undefined,
  size: BoardState['size'],
): BoardState {
  return {
    size: raw?.size ?? size,
    lines: raw?.lines ?? {},
    boxes: raw?.boxes ?? {},
  };
}

/**
 * RTDB omits keys that were absent when a game was written, so default them
 * rather than let `undefined` leak into code that assumes the type's
 * booleans/numbers. `consecutiveMisses` especially: an `undefined + 1` would
 * poison the miss counter into `NaN` and the player could never be eliminated.
 */
export function normalizePlayers(
  raw: Record<PlayerId, Player> | null | undefined,
): Record<PlayerId, Player> {
  if (!raw) return {};
  const players: Record<PlayerId, Player> = {};
  for (const [id, p] of Object.entries(raw)) {
    players[id] = {
      ...p,
      isEliminated: p.isEliminated ?? false,
      consecutiveMisses: p.consecutiveMisses ?? 0,
    };
  }
  return players;
}

/**
 * Presence lives in its own node, and a player who has never connected simply
 * has no entry — so absence means "nothing reported", not "offline".
 */
export function normalizePresence(raw: GamePresence | null | undefined): GamePresence {
  if (!raw) return {};
  const out: GamePresence = {};
  for (const [id, p] of Object.entries(raw)) {
    out[id] = {
      isConnected: p?.isConnected ?? false,
      disconnectedAt: p?.disconnectedAt ?? null,
      lastSeenAt: p?.lastSeenAt ?? null,
    };
  }
  return out;
}

/**
 * RTDB omits empty maps *and* empty arrays, so a no-contest result (nobody won,
 * `winners: []`) reads back with `winners` missing entirely. Callers reasonably
 * treat it as an array — `winners.includes(me)`, `winners.length` — so leaving
 * it `undefined` would crash the very screen that reports the void match.
 */
export function normalizeResult(raw: GameResult | null | undefined): GameResult | null {
  if (!raw) return null;
  return { ...raw, winners: raw.winners ?? [], scores: raw.scores ?? {} };
}

export function normalizeGame(raw: GameState | null | undefined): GameState | null {
  if (!raw) return null;
  return {
    ...raw,
    board: normalizeBoard(raw.board, raw.board?.size ?? 3),
    players: normalizePlayers(raw.players),
    turnOrder: raw.turnOrder ?? [],
    result: normalizeResult(raw.result),
  };
}
