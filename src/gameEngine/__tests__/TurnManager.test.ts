import { TurnManager } from '../TurnManager';

describe('TurnManager', () => {
  const order = ['P1', 'P2', 'P3'];

  it('rotates to the next player', () => {
    expect(TurnManager.next(order, 'P1')).toBe('P2');
    expect(TurnManager.next(order, 'P3')).toBe('P1'); // wraps
  });

  it('keeps the turn on box completion', () => {
    expect(TurnManager.resolveTurn(order, 'P2', 1)).toEqual({
      nextTurn: 'P2',
      extraTurn: true,
      pendingBonusMoves: 0,
    });
  });

  it('advances the turn with no completion', () => {
    expect(TurnManager.resolveTurn(order, 'P2', 0)).toEqual({
      nextTurn: 'P3',
      extraTurn: false,
      pendingBonusMoves: 0,
    });
  });

  it('is resilient to an unknown current player', () => {
    expect(TurnManager.next(order, 'PX')).toBe('P1');
  });

  it('skips an inactive middle player', () => {
    expect(TurnManager.next(order, 'P1', ['P1', 'P3'])).toBe('P3');
  });

  it('advances past the current-turn holder when they were just eliminated, without wrapping to the first active player', () => {
    const fourPlayer = ['P1', 'P2', 'P3', 'P4'];
    // Regression: a naive "filter to active, then indexOf(current)" implementation
    // loses P3's position once P3 is removed from the active list, incorrectly
    // wrapping to P1 instead of correctly advancing to P4.
    expect(TurnManager.next(fourPlayer, 'P3', ['P1', 'P2', 'P4'])).toBe('P4');
  });

  it('wraps around to the first active player past the end of turnOrder', () => {
    expect(TurnManager.next(order, 'P3', ['P1', 'P3'])).toBe('P1');
  });

  it('returns current when no one else is active', () => {
    expect(TurnManager.next(order, 'P2', ['P2'])).toBe('P2');
  });

  it('resolveTurn advances only among active players when no box is completed', () => {
    expect(TurnManager.resolveTurn(order, 'P1', 0, ['P1', 'P3'])).toEqual({
      nextTurn: 'P3',
      extraTurn: false,
      pendingBonusMoves: 0,
    });
  });

  describe('resolveTurn with an owed bonus move (anti-stall)', () => {
    const pair = ['P1', 'P2'];

    it('carries the bonus through a box completion (box rule takes precedence)', () => {
      expect(TurnManager.resolveTurn(pair, 'P1', 1, pair, 1)).toEqual({
        nextTurn: 'P1',
        extraTurn: true,
        pendingBonusMoves: 1,
      });
    });

    it('spends one bonus and keeps the turn on a no-box move', () => {
      expect(TurnManager.resolveTurn(pair, 'P1', 0, pair, 1)).toEqual({
        nextTurn: 'P1',
        extraTurn: true,
        pendingBonusMoves: 0,
      });
    });

    it('passes play on once the bonus is spent', () => {
      expect(TurnManager.resolveTurn(pair, 'P1', 0, pair, 0)).toEqual({
        nextTurn: 'P2',
        extraTurn: false,
        pendingBonusMoves: 0,
      });
    });
  });
});
