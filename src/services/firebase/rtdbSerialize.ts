import type { BoardState, GameResult, GameState, Player, PlayerId } from '@/types';

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
 * Games written before `isEliminated`/`disconnectedAt`/`lastSeenAt`/
 * `consecutiveMisses` existed have those keys missing entirely (not
 * `false`/`null`/`0` — just absent, since RTDB drops falsy-empty values), so
 * default them here rather than let `undefined` leak into code that assumes the
 * type's booleans/numbers. `consecutiveMisses` especially: an `undefined + 1`
 * would poison the miss counter into `NaN` and the player could never be
 * eliminated.
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
      disconnectedAt: p.disconnectedAt ?? null,
      lastSeenAt: p.lastSeenAt ?? null,
      consecutiveMisses: p.consecutiveMisses ?? 0,
    };
  }
  return players;
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
