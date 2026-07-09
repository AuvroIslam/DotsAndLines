import type { PlayerId } from '@/types';

/**
 * Pure turn-rotation logic. In Dots & Boxes a player who completes one or more
 * boxes on their move takes another turn; otherwise play passes to the next
 * player in `turnOrder`.
 */
export class TurnManager {
  /**
   * The player who plays after `current` in the rotation, skipping anyone not
   * in `activeIds` (defaults to everyone). `current`'s position is always
   * located in the *original* `turnOrder` — not the filtered active list — so
   * that advancing away from a player just eliminated still lands on the
   * correct next player rather than wrapping to the first active one.
   */
  static next(turnOrder: PlayerId[], current: PlayerId, activeIds: PlayerId[] = turnOrder): PlayerId {
    if (turnOrder.length === 0) return current;
    const active = new Set(activeIds);
    const idx = turnOrder.indexOf(current);
    if (idx === -1) return turnOrder.find((id) => active.has(id)) ?? turnOrder[0]!;
    for (let step = 1; step <= turnOrder.length; step += 1) {
      const candidate = turnOrder[(idx + step) % turnOrder.length]!;
      if (active.has(candidate)) return candidate;
    }
    return current;
  }

  /**
   * Resolve whose turn it is after a move.
   * @param boxesCompleted number of boxes the move completed
   */
  static resolveTurn(
    turnOrder: PlayerId[],
    current: PlayerId,
    boxesCompleted: number,
    activeIds: PlayerId[] = turnOrder,
  ): { nextTurn: PlayerId; extraTurn: boolean } {
    if (boxesCompleted > 0) {
      return { nextTurn: current, extraTurn: true };
    }
    return { nextTurn: TurnManager.next(turnOrder, current, activeIds), extraTurn: false };
  }
}
