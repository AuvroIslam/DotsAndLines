import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

type SubscribeCb = (game: GameState | null) => void;

let subscribeCb: SubscribeCb | null = null;

jest.mock('@/services/firebase', () => ({
  gameRepository: {
    subscribe: jest.fn((_gameId: string, cb: SubscribeCb) => {
      subscribeCb = cb;
      return () => {
        subscribeCb = null;
      };
    }),
    subscribePresence: jest.fn(() => () => {}),
    getGame: jest.fn(async () => null),
  },
  gameFunctions: {
    playMove: jest.fn(),
    forfeit: jest.fn(),
    accepted: jest.fn(),
  },
}));

function baseGame(overrides: Partial<GameState>): GameState {
  return {
    id: 'g1',
    version: 0,
    mode: 'friend',
    phase: 'playing',
    board: { size: 3, lines: {}, boxes: {} },
    players: {
      P1: {
        id: 'P1',
        uid: 'uid1',
        index: 0,
        displayName: 'P1',
        color: '#abc',
        isEliminated: false,
        consecutiveMisses: 0,
        score: 0,
      },
      P2: {
        id: 'P2',
        uid: 'uid2',
        index: 1,
        displayName: 'P2',
        color: '#def',
        isEliminated: false,
        consecutiveMisses: 0,
        score: 0,
      },
    },
    turnOrder: ['P1', 'P2'],
    currentTurn: 'P1',
    turnStartedAt: 0,
    turnDurationMs: 30_000,
    createdAt: 0,
    updatedAt: 0,
    result: null,
    ...overrides,
  } as GameState;
}

describe('gameStore reconciliation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useGameStore.getState().disconnect();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never applies a torn intermediate snapshot from one server write', () => {
    const seenGames: (GameState | null)[] = [];
    const unsub = useGameStore.subscribe((s) => seenGames.push(s.game));

    useGameStore.getState().connect('g1', 'uid1');
    expect(subscribeCb).not.toBeNull();

    // Initial sync.
    subscribeCb!(baseGame({ version: 0 }));
    jest.advanceTimersByTime(80);
    expect(useGameStore.getState().game?.version).toBe(0);
    seenGames.length = 0;

    // Reproduces the observed RTDB behaviour for a multi-path update(): the
    // client's onValue listener fired with `version` already bumped but
    // `board`/`currentTurn` still stale, 31ms before the fully-consistent
    // snapshot — a torn read of one atomic server write.
    const torn = baseGame({ version: 1, currentTurn: 'P1' }); // board still empty
    const settled = baseGame({
      version: 1,
      currentTurn: 'P2',
      board: { size: 3, lines: { 'h:0:0': 'P1' }, boxes: {} },
    });

    subscribeCb!(torn);
    jest.advanceTimersByTime(31);
    subscribeCb!(settled);
    jest.advanceTimersByTime(80);

    // The torn read must never have reached rendered state.
    const everSawTorn = seenGames.some(
      (g) => g?.version === 1 && Object.keys(g.board.lines).length === 0,
    );
    expect(everSawTorn).toBe(false);

    // Exactly one reconciliation applied for the whole burst, with the
    // fully-settled data.
    const applied = seenGames.filter((g) => g?.version === 1);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.board.lines).toEqual({ 'h:0:0': 'P1' });
    expect(applied[0]?.currentTurn).toBe('P2');

    unsub();
  });

  it('never lets a drawn line disappear even if a stale read slips past the debounce', () => {
    useGameStore.getState().connect('g1', 'uid1');
    subscribeCb!(baseGame({ board: { size: 3, lines: { 'h:0:0': 'P1' }, boxes: {} }, version: 1 }));
    jest.advanceTimersByTime(80);
    expect(useGameStore.getState().game?.board.lines).toEqual({ 'h:0:0': 'P1' });

    // A late, stale snapshot with an older/incomplete board must not erase
    // the line already known to be drawn.
    subscribeCb!(baseGame({ board: { size: 3, lines: {}, boxes: {} }, version: 1 }));
    jest.advanceTimersByTime(80);

    expect(useGameStore.getState().game?.board.lines).toEqual({ 'h:0:0': 'P1' });
  });
});
