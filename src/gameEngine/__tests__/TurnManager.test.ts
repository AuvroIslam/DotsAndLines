import { TurnManager } from '../TurnManager';

describe('TurnManager', () => {
  const order = ['P1', 'P2', 'P3'];

  it('rotates to the next player', () => {
    expect(TurnManager.next(order, 'P1')).toBe('P2');
    expect(TurnManager.next(order, 'P3')).toBe('P1'); // wraps
  });

  it('keeps the turn on box completion', () => {
    expect(TurnManager.resolveTurn(order, 'P2', 1)).toEqual({ nextTurn: 'P2', extraTurn: true });
  });

  it('advances the turn with no completion', () => {
    expect(TurnManager.resolveTurn(order, 'P2', 0)).toEqual({ nextTurn: 'P3', extraTurn: false });
  });

  it('is resilient to an unknown current player', () => {
    expect(TurnManager.next(order, 'PX')).toBe('P1');
  });
});
