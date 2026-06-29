import { lineToKey } from '@/utils/lineKey';

import { Board } from '../Board';

describe('Board geometry', () => {
  it('counts lines and boxes for each size', () => {
    expect(Board.totalBoxes(3)).toBe(9);
    expect(Board.totalLines(3)).toBe(24); // (3+1)*3*2
    expect(Board.totalBoxes(5)).toBe(25);
  });

  it('validates line bounds', () => {
    expect(Board.isLineInBounds({ orientation: 'horizontal', row: 3, col: 2 }, 3)).toBe(true);
    expect(Board.isLineInBounds({ orientation: 'horizontal', row: 4, col: 0 }, 3)).toBe(false);
    expect(Board.isLineInBounds({ orientation: 'vertical', row: 2, col: 3 }, 3)).toBe(true);
    expect(Board.isLineInBounds({ orientation: 'vertical', row: 3, col: 0 }, 3)).toBe(false);
    expect(Board.isLineInBounds({ orientation: 'horizontal', row: -1, col: 0 }, 3)).toBe(false);
  });

  it('finds adjacent boxes (1 for edges, 2 for interior)', () => {
    const edge = Board.getAdjacentBoxes({ orientation: 'horizontal', row: 0, col: 0 }, 3);
    expect(edge).toHaveLength(1);
    const interior = Board.getAdjacentBoxes({ orientation: 'horizontal', row: 1, col: 0 }, 3);
    expect(interior).toHaveLength(2);
  });

  it('completes a box only when all four edges are drawn', () => {
    let board = Board.create(3);
    const edges = Board.getBoxEdges({ row: 0, col: 0 });
    // draw first three edges — no completion
    for (let i = 0; i < 3; i += 1) {
      const res = Board.applyLine(board, edges[i]!, 'P1');
      board = res.board;
      expect(res.completedBoxes).toHaveLength(0);
    }
    // fourth edge completes exactly one box
    const final = Board.applyLine(board, edges[3], 'P1');
    expect(final.completedBoxes).toHaveLength(1);
    expect(final.board.boxes['b:0:0']).toBe('P1');
  });

  it('can complete two boxes with a single shared edge', () => {
    let board = Board.create(3);
    // Surround the shared vertical edge v(0,1) between boxes (0,0) and (0,1).
    const draw = (key: string) => {
      board = Board.applyLine(board, decode(key), 'P1').board;
    };
    // box (0,0): top h0:0, bottom h1:0, left v0:0  (leave right v0:1)
    draw('h:0:0');
    draw('h:1:0');
    draw('v:0:0');
    // box (0,1): top h0:1, bottom h1:1, right v0:2  (leave left v0:1)
    draw('h:0:1');
    draw('h:1:1');
    draw('v:0:2');
    // Now drawing the shared edge v0:1 should complete BOTH boxes.
    const res = Board.applyLine(board, decode('v:0:1'), 'P1');
    expect(res.completedBoxes).toHaveLength(2);
  });
});

function decode(key: string) {
  const [o, r, c] = key.split(':');
  return {
    orientation: o === 'h' ? ('horizontal' as const) : ('vertical' as const),
    row: Number(r),
    col: Number(c),
  };
}

// guard against accidental key-format drift
test('lineToKey format', () => {
  expect(lineToKey({ orientation: 'horizontal', row: 1, col: 2 })).toBe('h:1:2');
  expect(lineToKey({ orientation: 'vertical', row: 0, col: 3 })).toBe('v:0:3');
});
