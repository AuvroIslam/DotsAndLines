import type { Player } from '@/types';

import { Board } from '../Board';
import { GameManager } from '../GameManager';

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

describe('GameManager', () => {
  it('creates a playing game with P1 to move', () => {
    const g = GameManager.create({ id: 'g1', mode: 'friend', size: 3, players: players(2) });
    expect(g.phase).toBe('playing');
    expect(g.currentTurn).toBe('P1');
    expect(g.turnOrder).toEqual(['P1', 'P2']);
  });

  it('rejects an out-of-turn move', () => {
    const g = GameManager.create({ id: 'g1', mode: 'friend', size: 3, players: players(2) });
    const out = GameManager.applyMove(g, { orientation: 'horizontal', row: 0, col: 0 }, 'P2');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('not_your_turn');
  });

  it('passes the turn when no box is completed', () => {
    const g = GameManager.create({ id: 'g1', mode: 'friend', size: 3, players: players(2) });
    const out = GameManager.applyMove(g, { orientation: 'horizontal', row: 0, col: 0 }, 'P1');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.extraTurn).toBe(false);
      expect(out.state.currentTurn).toBe('P2');
    }
  });

  it('grants an extra turn when a box is completed', () => {
    let g = GameManager.create({ id: 'g1', mode: 'friend', size: 3, players: players(2) });
    const apply = (
      line: { orientation: 'horizontal' | 'vertical'; row: number; col: number },
      p: string,
    ) => {
      const out = GameManager.applyMove(g, line, p);
      if (out.ok) g = out.state;
      return out;
    };
    // P1 draws three edges of box (0,0); P2 plays in-bounds neutral edges between.
    apply({ orientation: 'horizontal', row: 0, col: 0 }, 'P1'); // box(0,0) top   -> P2
    apply({ orientation: 'horizontal', row: 3, col: 0 }, 'P2'); // neutral        -> P1
    apply({ orientation: 'horizontal', row: 1, col: 0 }, 'P1'); // box(0,0) bottom-> P2
    apply({ orientation: 'horizontal', row: 3, col: 1 }, 'P2'); // neutral        -> P1
    apply({ orientation: 'vertical', row: 0, col: 0 }, 'P1'); // box(0,0) left  -> P2
    apply({ orientation: 'horizontal', row: 3, col: 2 }, 'P2'); // neutral        -> P1
    const closing = apply({ orientation: 'vertical', row: 0, col: 1 }, 'P1'); // closes box (0,0)
    expect(closing.ok).toBe(true);
    if (closing.ok) {
      expect(closing.result.completedBoxes).toHaveLength(1);
      expect(closing.result.extraTurn).toBe(true);
      expect(closing.state.currentTurn).toBe('P1'); // P1 goes again
      expect(closing.state.players.P1!.score).toBe(1);
    }
  });

  it('finishes and resolves a winner when the board fills (1x1)', () => {
    // 1 is not a valid BoardSize for the UI, but the engine is size-agnostic;
    // use the smallest fully-playable case via a 3x3 played to completion is heavy,
    // so we assert finish detection on a contrived full board through repeated moves.
    let g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
    // Play every legal edge in order; whoever closes boxes keeps going. We just
    // need the terminal state to be 'finished' with a valid result.
    const allLines = Board.getAllLines(3);
    for (const line of allLines) {
      const mover = g.currentTurn;
      const out = GameManager.applyMove(g, line, mover);
      if (out.ok) g = out.state;
    }
    expect(g.phase).toBe('finished');
    expect(g.result).not.toBeNull();
    const totalBoxes = (g.result!.scores.P1 ?? 0) + (g.result!.scores.P2 ?? 0);
    expect(totalBoxes).toBe(9);
  });
});
