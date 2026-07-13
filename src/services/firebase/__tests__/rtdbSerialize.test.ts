import type { GameResult, GameState } from '@/types';

import { normalizeGame, normalizePlayers, normalizeResult } from '../rtdbSerialize';

/**
 * RTDB drops empty maps and arrays, and omits keys that didn't exist when a
 * game was written. Everything downstream assumes well-formed engine state, so
 * these defaults are what stop `undefined` leaking into `.includes()`,
 * `.length` and arithmetic.
 */
describe('rtdbSerialize', () => {
  describe('normalizeResult', () => {
    it('restores winners dropped by RTDB on a no-contest result', () => {
      // A voided match has `winners: []`, which RTDB stores by omitting the key.
      const raw = { phase: 'finished', isDraw: true, reason: 'timeout' } as never;
      const result = normalizeResult(raw)!;
      expect(result.winners).toEqual([]);
      expect(result.scores).toEqual({});
      // The crash this guards against:
      expect(() => result.winners.includes('P1')).not.toThrow();
      expect(result.winners.length).toBe(0);
    });

    it('leaves a populated result untouched', () => {
      const raw: GameResult = {
        phase: 'finished',
        winners: ['P2'],
        isDraw: false,
        scores: { P1: 3, P2: 6 },
        reason: 'timeout',
      };
      expect(normalizeResult(raw)).toEqual(raw);
    });

    it('passes null through', () => {
      expect(normalizeResult(null)).toBeNull();
    });
  });

  describe('normalizePlayers', () => {
    it('defaults presence and miss fields absent from older games', () => {
      const raw = {
        P1: { id: 'P1', uid: 'u1', index: 0, displayName: 'A', color: '#fff', isConnected: true, score: 0 },
      } as never;
      const p = normalizePlayers(raw).P1!;
      expect(p.isEliminated).toBe(false);
      expect(p.disconnectedAt).toBeNull();
      expect(p.lastSeenAt).toBeNull();
      // A missing counter must not poison the miss arithmetic into NaN.
      expect(p.consecutiveMisses).toBe(0);
      expect(p.consecutiveMisses + 1).toBe(1);
    });
  });

  describe('normalizeGame', () => {
    it('rebuilds the empty board maps and turn order RTDB omitted', () => {
      const raw = {
        id: 'g',
        board: { size: 3 },
        players: {},
      } as unknown as GameState;
      const g = normalizeGame(raw)!;
      expect(g.board.lines).toEqual({});
      expect(g.board.boxes).toEqual({});
      expect(g.turnOrder).toEqual([]);
      expect(g.result).toBeNull();
    });
  });
});
