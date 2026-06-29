import type { BoardSize, BoardState, Box, Line, PlayerId } from '@/types';
import { boxToKey, lineToKey } from '@/utils/lineKey';

/**
 * Geometry and immutable state operations for the Dots & Boxes grid.
 *
 * For a board of `size` boxes per side there are `size + 1` dots per side.
 * - Horizontal lines: rows 0..size,     cols 0..size-1  → (size+1) * size edges
 * - Vertical lines:   rows 0..size-1,   cols 0..size    → size * (size+1) edges
 * - Boxes:            rows 0..size-1,   cols 0..size-1   → size * size cells
 *
 * A box at (r, c) is bordered by:
 *   top    = horizontal(r,   c)
 *   bottom = horizontal(r+1, c)
 *   left   = vertical(r,   c)
 *   right  = vertical(r,   c+1)
 *
 * All methods are pure: they never mutate the input state.
 */
export class Board {
  static create(size: BoardSize): BoardState {
    return { size, lines: {}, boxes: {} };
  }

  static totalLines(size: BoardSize): number {
    return (size + 1) * size * 2;
  }

  static totalBoxes(size: BoardSize): number {
    return size * size;
  }

  static isLineInBounds(line: Line, size: BoardSize): boolean {
    const { orientation, row, col } = line;
    if (row < 0 || col < 0) return false;
    if (orientation === 'horizontal') {
      // rows 0..size, cols 0..size-1
      return row <= size && col <= size - 1;
    }
    // vertical: rows 0..size-1, cols 0..size
    return row <= size - 1 && col <= size;
  }

  static isLineDrawn(state: BoardState, line: Line): boolean {
    return state.lines[lineToKey(line)] !== undefined;
  }

  /** The 4 edges that border a given box. */
  static getBoxEdges(box: Box): [Line, Line, Line, Line] {
    const { row, col } = box;
    return [
      { orientation: 'horizontal', row, col }, // top
      { orientation: 'horizontal', row: row + 1, col }, // bottom
      { orientation: 'vertical', row, col }, // left
      { orientation: 'vertical', row, col: col + 1 }, // right
    ];
  }

  /** Boxes that border a given line (1 for edge lines, 2 for interior lines). */
  static getAdjacentBoxes(line: Line, size: BoardSize): Box[] {
    const { orientation, row, col } = line;
    const candidates: Box[] =
      orientation === 'horizontal'
        ? [
            { row: row - 1, col }, // box above
            { row, col }, // box below
          ]
        : [
            { row, col: col - 1 }, // box to the left
            { row, col }, // box to the right
          ];
    return candidates.filter((b) => b.row >= 0 && b.col >= 0 && b.row < size && b.col < size);
  }

  static isBoxComplete(state: BoardState, box: Box): boolean {
    return Board.getBoxEdges(box).every((edge) => Board.isLineDrawn(state, edge));
  }

  static isBoxOwned(state: BoardState, box: Box): boolean {
    return state.boxes[boxToKey(box)] !== undefined;
  }

  /**
   * Return a new BoardState with `line` drawn by `playerId` and any boxes that
   * become complete assigned to that player. Does not validate — call
   * MoveValidator first.
   */
  static applyLine(
    state: BoardState,
    line: Line,
    playerId: PlayerId,
  ): { board: BoardState; completedBoxes: Box[] } {
    const nextLines = { ...state.lines, [lineToKey(line)]: playerId };
    const nextBoxes = { ...state.boxes };
    const completedBoxes: Box[] = [];

    const probe: BoardState = { ...state, lines: nextLines };
    for (const box of Board.getAdjacentBoxes(line, state.size)) {
      if (!Board.isBoxOwned(probe, box) && Board.isBoxComplete(probe, box)) {
        nextBoxes[boxToKey(box)] = playerId;
        completedBoxes.push(box);
      }
    }

    return {
      board: { ...state, lines: nextLines, boxes: nextBoxes },
      completedBoxes,
    };
  }

  static drawnLineCount(state: BoardState): number {
    return Object.keys(state.lines).length;
  }

  static completedBoxCount(state: BoardState): number {
    return Object.keys(state.boxes).length;
  }

  static isFull(state: BoardState): boolean {
    return Board.completedBoxCount(state) === Board.totalBoxes(state.size);
  }
}
