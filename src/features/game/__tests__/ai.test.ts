import { Board } from '@/gameEngine';
import type { BoardSize, GameState, Line, Player } from '@/types';

import { chooseMoveAI } from '../ai';

function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `P${i + 1}`,
    uid: `uid${i + 1}`,
    index: i as Player['index'],
    displayName: `Player ${i + 1}`,
    color: '#fff',
    isConnected: true,
    score: 0,
  }));
}

function buildState(size: BoardSize, drawnLines: Line[]): GameState {
  let board = Board.create(size);
  for (const line of drawnLines) board = Board.applyLine(board, line, 'P1').board;
  const ps = players(2);
  return {
    id: 'test',
    mode: 'friend',
    phase: 'playing',
    board,
    players: Object.fromEntries(ps.map((p) => [p.id, p])),
    turnOrder: ps.map((p) => p.id),
    currentTurn: 'P1',
    turnStartedAt: 0,
    turnDurationMs: 30_000,
    createdAt: 0,
    updatedAt: 0,
    result: null,
  };
}

describe('chooseMoveAI', () => {
  it('takes a completing move when one is available', () => {
    // box(0,0) has 3 edges drawn; only the right edge remains.
    const state = buildState(3, [
      { orientation: 'horizontal', row: 0, col: 0 }, // top
      { orientation: 'horizontal', row: 1, col: 0 }, // bottom
      { orientation: 'vertical', row: 0, col: 0 }, // left
    ]);
    const move = chooseMoveAI(state, 'P1', 'medium', () => 0);
    expect(move).toEqual({ orientation: 'vertical', row: 0, col: 1 });
  });

  it('prefers a safe move over one that gives away a box', () => {
    // box(0,0) has 2 edges drawn (top, left); drawing its bottom would leave
    // only the right edge, handing the box to the opponent next turn.
    const state = buildState(3, [
      { orientation: 'horizontal', row: 0, col: 0 }, // top
      { orientation: 'vertical', row: 0, col: 0 }, // left
    ]);
    const unsafe: Line = { orientation: 'horizontal', row: 1, col: 0 }; // box(0,0) bottom

    const move = chooseMoveAI(state, 'P1', 'medium', () => 0)!;
    expect(move).not.toEqual(unsafe);

    const probeBoard = Board.applyLine(state.board, move, 'P1').board;
    const exposesABox = Board.getAdjacentBoxes(move, 3).some(
      (box) =>
        !Board.isBoxOwned(probeBoard, box) &&
        Board.getBoxEdges(box).filter((e) => Board.isLineDrawn(probeBoard, e)).length === 3,
    );
    expect(exposesABox).toBe(false);
  });

  it('always returns one of the legal remaining lines', () => {
    const state = buildState(3, []);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const move = chooseMoveAI(state, 'P1', difficulty, () => 0.5)!;
      expect(Board.isLineDrawn(state.board, move)).toBe(false);
      expect(Board.isLineInBounds(move, 3)).toBe(true);
    }
  });

  it('returns null when no lines remain', () => {
    const state = buildState(3, Board.getAllLines(3));
    expect(chooseMoveAI(state, 'P1', 'medium')).toBeNull();
  });

  it('on hard, sacrifices the shortest chain when every move is unsafe', () => {
    // A 3x3 board where only two regions have undrawn edges:
    // - a 3-box chain across the top row (boxes (0,0)-(0,1)-(0,2)), each at
    //   2/4 edges drawn — opening it anywhere hands the opponent all 3 boxes.
    // - an isolated box (2,2), also at 2/4 edges drawn — opening it hands
    //   the opponent exactly 1 box.
    // Every other box is already fully drawn/owned, so these 6 lines are the
    // only legal moves and all of them are "unsafe".
    const drawn: Line[] = [
      { orientation: 'horizontal', row: 0, col: 0 },
      { orientation: 'horizontal', row: 0, col: 1 },
      { orientation: 'horizontal', row: 0, col: 2 },
      { orientation: 'horizontal', row: 1, col: 0 },
      { orientation: 'horizontal', row: 1, col: 1 },
      { orientation: 'horizontal', row: 1, col: 2 },
      { orientation: 'horizontal', row: 2, col: 0 },
      { orientation: 'horizontal', row: 2, col: 1 },
      { orientation: 'horizontal', row: 2, col: 2 },
      { orientation: 'horizontal', row: 3, col: 0 },
      { orientation: 'horizontal', row: 3, col: 1 },
      { orientation: 'vertical', row: 1, col: 0 },
      { orientation: 'vertical', row: 1, col: 1 },
      { orientation: 'vertical', row: 1, col: 2 },
      { orientation: 'vertical', row: 1, col: 3 },
      { orientation: 'vertical', row: 2, col: 0 },
      { orientation: 'vertical', row: 2, col: 1 },
      { orientation: 'vertical', row: 2, col: 2 },
    ];
    const state = buildState(3, drawn);

    const available = Board.getAllLines(3).filter((l) => !Board.isLineDrawn(state.board, l));
    expect(available).toHaveLength(6);

    const cheapSacrifices: Line[] = [
      { orientation: 'horizontal', row: 3, col: 2 },
      { orientation: 'vertical', row: 2, col: 3 },
    ];

    for (let i = 0; i < 10; i += 1) {
      const move = chooseMoveAI(state, 'P1', 'hard', Math.random)!;
      expect(cheapSacrifices).toContainEqual(move);
    }
  });

  it('is deterministic for a fixed rng', () => {
    const state = buildState(3, []);
    const rng = () => 0.3;
    const a = chooseMoveAI(state, 'P1', 'medium', rng);
    const b = chooseMoveAI(state, 'P1', 'medium', rng);
    expect(a).toEqual(b);
  });
});
