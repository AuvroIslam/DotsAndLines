import type { BoardState, GameState, Player, PlayerId } from '@/types';

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
 * Games written before `isEliminated`/`disconnectedAt`/`lastSeenAt` existed
 * have those keys missing entirely (not `false`/`null` — just absent), so
 * default them here rather than let `undefined` leak into code that assumes
 * the type's booleans/numbers.
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
    };
  }
  return players;
}

export function normalizeGame(raw: GameState | null | undefined): GameState | null {
  if (!raw) return null;
  return {
    ...raw,
    board: normalizeBoard(raw.board, raw.board?.size ?? 3),
    players: normalizePlayers(raw.players),
    turnOrder: raw.turnOrder ?? [],
    result: raw.result ?? null,
  };
}
