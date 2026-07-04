import { act, renderHook } from '@testing-library/react-native';

import type { LocalPlayer } from '../useLocalGame';
import { useLocalGame } from '../useLocalGame';

const HUMAN_VS_HUMAN: [LocalPlayer, LocalPlayer] = [
  { id: 'local-1', displayName: 'Player 1', color: '#e74c3c' },
  { id: 'local-2', displayName: 'Player 2', color: '#3498db' },
];

const HUMAN_VS_AI: [LocalPlayer, LocalPlayer] = [
  { id: 'local-1', displayName: 'Player 1', color: '#e74c3c' },
  { id: 'local-2', displayName: 'AI', color: '#3498db', isAI: true, aiDifficulty: 'easy' },
];

describe('useLocalGame', () => {
  it('starts with no game until startGame is called', () => {
    const { result } = renderHook(() => useLocalGame());
    expect(result.current.game).toBeNull();
  });

  it('creates a game with the given size and players', () => {
    const { result } = renderHook(() => useLocalGame());
    act(() => result.current.startGame(3, HUMAN_VS_HUMAN));

    expect(result.current.game?.board.size).toBe(3);
    expect(result.current.game?.turnOrder).toEqual(['local-1', 'local-2']);
    expect(result.current.game?.currentTurn).toBe('local-1');
  });

  it('applies a legal move and advances the turn', () => {
    const { result } = renderHook(() => useLocalGame());
    act(() => result.current.startGame(3, HUMAN_VS_HUMAN));

    act(() => result.current.makeMove({ orientation: 'horizontal', row: 0, col: 0 }));

    expect(result.current.game?.board.lines['h:0:0']).toBe('local-1');
    expect(result.current.game?.currentTurn).toBe('local-2');
  });

  it('ignores an illegal move (line already drawn)', () => {
    const { result } = renderHook(() => useLocalGame());
    act(() => result.current.startGame(3, HUMAN_VS_HUMAN));

    act(() => result.current.makeMove({ orientation: 'horizontal', row: 0, col: 0 }));
    const afterFirst = result.current.game;

    act(() => result.current.makeMove({ orientation: 'horizontal', row: 0, col: 0 }));

    expect(result.current.game).toBe(afterFirst);
  });

  it('skipTurn passes the turn without drawing a line', () => {
    const { result } = renderHook(() => useLocalGame());
    act(() => result.current.startGame(3, HUMAN_VS_HUMAN));

    act(() => result.current.skipTurn());

    expect(result.current.game?.currentTurn).toBe('local-2');
    expect(Object.keys(result.current.game?.board.lines ?? {})).toHaveLength(0);
  });

  it('reset clears the current game', () => {
    const { result } = renderHook(() => useLocalGame());
    act(() => result.current.startGame(3, HUMAN_VS_HUMAN));
    act(() => result.current.reset());

    expect(result.current.game).toBeNull();
    expect(result.current.aiThinking).toBe(false);
  });

  it('schedules and plays an AI move automatically on its turn', () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useLocalGame());
      act(() => result.current.startGame(3, HUMAN_VS_AI));

      // Hand the turn to the AI player.
      act(() => result.current.skipTurn());
      expect(result.current.game?.currentTurn).toBe('local-2');
      expect(result.current.aiThinking).toBe(true);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.aiThinking).toBe(false);
      expect(Object.keys(result.current.game?.board.lines ?? {})).toHaveLength(1);
      expect(result.current.game?.currentTurn).toBe('local-1');
    } finally {
      jest.useRealTimers();
    }
  });
});
