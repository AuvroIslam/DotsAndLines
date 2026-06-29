import type { PlayerId } from '@/types';

/**
 * Pure turn-rotation logic. In Dots & Boxes a player who completes one or more
 * boxes on their move takes another turn; otherwise play passes to the next
 * player in `turnOrder`.
 */
export class TurnManager {
  /** The player who plays after `current` in the rotation. */
  static next(turnOrder: PlayerId[], current: PlayerId): PlayerId {
    if (turnOrder.length === 0) return current;
    const idx = turnOrder.indexOf(current);
    if (idx === -1) return turnOrder[0]!;
    return turnOrder[(idx + 1) % turnOrder.length]!;
  }

  /**
   * Resolve whose turn it is after a move.
   * @param boxesCompleted number of boxes the move completed
   */
  static resolveTurn(
    turnOrder: PlayerId[],
    current: PlayerId,
    boxesCompleted: number,
  ): { nextTurn: PlayerId; extraTurn: boolean } {
    if (boxesCompleted > 0) {
      return { nextTurn: current, extraTurn: true };
    }
    return { nextTurn: TurnManager.next(turnOrder, current), extraTurn: false };
  }
}
