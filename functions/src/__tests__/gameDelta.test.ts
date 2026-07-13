import { Board, GameManager } from '@/gameEngine';
import type { GameState, Line } from '@/types';
import { MAX_CONSECUTIVE_MISSES } from '@/utils/constants';

import { diffGamePaths } from '../gameDelta';

/**
 * The delta is what makes server-side moves affordable, but it is also the one
 * place a bug would be *silent*: a field the diff forgets is simply never
 * persisted, and the game quietly drifts from what the engine computed.
 *
 * So rather than assert on individual paths, every test here proves the real
 * invariant — applying the diff to the previous state reproduces the next state
 * exactly. If someone adds a field to the engine and forgets the diff, these
 * fail immediately.
 */

const GAME_ID = 'g1';

/** Rebuild a full game by applying only the diff's paths to the previous state. */
function applyDelta(prev: GameState, updates: Record<string, unknown>): GameState {
  // Deep clone so we mutate a copy, exactly as RTDB would apply a multi-path write.
  const next = JSON.parse(JSON.stringify(prev)) as GameState;

  for (const [path, value] of Object.entries(updates)) {
    const parts = path.replace(`games/${GAME_ID}/`, '').split('/');
    let node: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (const key of parts.slice(0, -1)) {
      node[key] ??= {};
      node = node[key] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = value;
  }
  return next;
}

/** Assert the diff is lossless for this transition. */
function expectLossless(prev: GameState, next: GameState) {
  const versioned: GameState = { ...next, version: prev.version + 1 };
  const updates = diffGamePaths(GAME_ID, prev, versioned);
  expect(applyDelta(prev, updates)).toEqual(versioned);
  return updates;
}

const newGame = (size: 3 | 4 | 5 = 3, count = 2): GameState =>
  GameManager.create({
    id: GAME_ID,
    mode: 'friend',
    size,
    players: Array.from({ length: count }, (_, i) => ({
      id: `P${i + 1}`,
      uid: `u${i + 1}`,
      index: i as 0 | 1 | 2 | 3,
      displayName: `P${i + 1}`,
      color: '#abc',
      isEliminated: false,
      consecutiveMisses: 0,
      score: 0,
    })),
    now: 1_000,
  });

const move = (state: GameState, line: Line, playerId: string): GameState => {
  const out = GameManager.applyMove(state, line, playerId, state.turnStartedAt + 1_000);
  if (!out.ok) throw new Error(`illegal test move: ${out.reason}`);
  return out.state;
};

describe('diffGamePaths', () => {
  it('is lossless for a plain move, and writes only the line + turn fields', () => {
    const prev = newGame();
    const next = move(prev, { orientation: 'horizontal', row: 0, col: 0 }, 'P1');

    const updates = expectLossless(prev, next);
    expect(updates).toEqual({
      [`games/${GAME_ID}/version`]: 1,
      [`games/${GAME_ID}/board/lines/h:0:0`]: 'P1',
      [`games/${GAME_ID}/currentTurn`]: 'P2',
      [`games/${GAME_ID}/turnStartedAt`]: next.turnStartedAt,
      [`games/${GAME_ID}/updatedAt`]: next.updatedAt,
    });
  });

  it('stays small — a move sends a handful of leaves, not the whole game', () => {
    // The entire point: a ~3KB game node used to be rewritten (and rebroadcast)
    // on every one of ~40 moves.
    const prev = newGame(5);
    const next = move(prev, { orientation: 'horizontal', row: 0, col: 0 }, 'P1');
    const bytes = JSON.stringify(diffGamePaths(GAME_ID, prev, { ...next, version: 1 })).length;
    const whole = JSON.stringify(prev).length;

    expect(bytes).toBeLessThan(whole / 3);
    expect(Object.keys(diffGamePaths(GAME_ID, prev, { ...next, version: 1 }))).toHaveLength(5);
  });

  it('is lossless when a move completes a box (score + extra turn + boxes)', () => {
    let g = newGame(3);
    // Close the box at (0,0): top, bottom, left, then right completes it.
    g = move(g, { orientation: 'horizontal', row: 0, col: 0 }, 'P1');
    g = move(g, { orientation: 'horizontal', row: 1, col: 0 }, 'P2');
    g = move(g, { orientation: 'vertical', row: 0, col: 0 }, 'P1');

    const prev = g;
    const next = move(prev, { orientation: 'vertical', row: 0, col: 1 }, 'P2');

    expect(next.players.P2!.score).toBe(1); // box completed
    expect(next.currentTurn).toBe('P2'); // extra turn

    const updates = expectLossless(prev, next);
    expect(updates[`games/${GAME_ID}/board/boxes/b:0:0`]).toBe('P2');
    expect(updates[`games/${GAME_ID}/players/P2/score`]).toBe(1);
  });

  it('is lossless for a turn timeout (miss counter)', () => {
    const prev = newGame();
    const next = GameManager.timeoutTurn(prev, prev.turnStartedAt + 30_000);

    const updates = expectLossless(prev, next);
    expect(updates[`games/${GAME_ID}/players/P1/consecutiveMisses`]).toBe(1);
  });

  it('is lossless for an elimination + terminal result', () => {
    let prev = newGame();
    for (let i = 0; i < MAX_CONSECUTIVE_MISSES - 1; i += 1) {
      prev = GameManager.timeoutTurn(prev, prev.turnStartedAt + 30_000);
      prev = move(prev, Board.getAllLines(3)[i]!, 'P2'); // P2 keeps playing
    }
    const next = GameManager.timeoutTurn(prev, prev.turnStartedAt + 30_000);
    expect(next.phase).toBe('finished');

    const updates = expectLossless(prev, next);
    expect(updates[`games/${GAME_ID}/phase`]).toBe('finished');
    expect(updates[`games/${GAME_ID}/players/P1/isEliminated`]).toBe(true);
    expect(updates[`games/${GAME_ID}/result`]).toEqual(next.result);
  });

  it('is lossless for a forfeit', () => {
    const prev = newGame(3, 4);
    const next = GameManager.forfeit(prev, 'P2', prev.turnStartedAt + 5_000);
    expectLossless(prev, next);
  });

  it('is lossless across a whole game played to completion', () => {
    // The strongest guard: replay an entire match and check every single
    // transition round-trips through the diff.
    let state = newGame(3);
    for (const line of Board.getAllLines(3)) {
      if (state.phase !== 'playing') break;
      const next = move(state, line, state.currentTurn);
      expectLossless(state, next);
      state = { ...next, version: state.version + 1 };
    }
    expect(state.phase).toBe('finished');
    expect(state.result).not.toBeNull();
  });

  it('writes nothing when nothing changed', () => {
    const g = newGame();
    expect(diffGamePaths(GAME_ID, g, g)).toEqual({});
  });
});
