import type { BoardState, GameState } from '@/types';

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

export function normalizeGame(raw: GameState | null | undefined): GameState | null {
  if (!raw) return null;
  return {
    ...raw,
    board: normalizeBoard(raw.board, raw.board?.size ?? 3),
    players: raw.players ?? {},
    turnOrder: raw.turnOrder ?? [],
    result: raw.result ?? null,
  };
}
