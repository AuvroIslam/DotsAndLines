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
   *
   * Two ways to keep the turn, checked in order:
   *  1. the move completed a box — the normal "go again" rule; any owed bonus is
   *     left untouched, to be spent once the chain ends;
   *  2. no box, but the player is owed a bonus move from an opponent's timeout —
   *     keep the turn and spend one.
   * Otherwise play passes to the next active player.
   *
   * @param boxesCompleted number of boxes the move completed
   * @param pendingBonus   extra moves owed to `current` (see `pendingBonusMoves`)
   */
  static resolveTurn(
    turnOrder: PlayerId[],
    current: PlayerId,
    boxesCompleted: number,
    activeIds: PlayerId[] = turnOrder,
    pendingBonus = 0,
  ): { nextTurn: PlayerId; extraTurn: boolean; pendingBonusMoves: number } {
    if (boxesCompleted > 0) {
      return { nextTurn: current, extraTurn: true, pendingBonusMoves: pendingBonus };
    }
    if (pendingBonus > 0) {
      return { nextTurn: current, extraTurn: true, pendingBonusMoves: pendingBonus - 1 };
    }
    return {
      nextTurn: TurnManager.next(turnOrder, current, activeIds),
      extraTurn: false,
      pendingBonusMoves: 0,
    };
  }
}
