import { players } from '@/testUtils/players';
import { MAX_CONSECUTIVE_MISSES } from '@/utils/constants';

import { Board } from '../Board';
import { GameManager } from '../GameManager';

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

  describe('forfeit', () => {
    it('ends a 2-player game immediately, awarding the other player the win', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const next = GameManager.forfeit(g, 'P1');
      expect(next.phase).toBe('finished');
      expect(next.result?.reason).toBe('forfeit');
      expect(next.result?.winners).toEqual(['P2']);
      expect(next.result?.isDraw).toBe(false);
      expect(next.players.P1?.isEliminated).toBe(true);
    });

    it('continues a 4-player game, advancing the turn when the eliminated player held it', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      const next = GameManager.forfeit(g, 'P1'); // P1 held the turn
      expect(next.phase).toBe('playing');
      expect(next.players.P1?.isEliminated).toBe(true);
      expect(next.currentTurn).toBe('P2');
    });

    it('continues a 4-player game, leaving currentTurn untouched when the eliminated player did not hold it', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      const next = GameManager.forfeit(g, 'P3'); // currentTurn is P1
      expect(next.phase).toBe('playing');
      expect(next.currentTurn).toBe('P1');
      expect(next.players.P3?.isEliminated).toBe(true);
    });

    it('ends the game once sequential eliminations leave exactly one active player', () => {
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      g = GameManager.forfeit(g, 'P1');
      g = GameManager.forfeit(g, 'P2');
      expect(g.phase).toBe('playing'); // P3 and P4 still active
      g = GameManager.forfeit(g, 'P3');
      expect(g.phase).toBe('finished');
      expect(g.result?.winners).toEqual(['P4']);
      expect(g.result?.reason).toBe('forfeit');
    });

    it('produces a no-contest draw for a contrived state where the last active player also forfeits', () => {
      // This shape can't arise from sequential forfeit() calls in practice — the
      // game always ends the instant only one player remains — but directly
      // exercises the defensive "everyone eliminated" branch.
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const contrived = {
        ...g,
        players: { ...g.players, P1: { ...g.players.P1!, isEliminated: true, isConnected: false } },
      };
      const next = GameManager.forfeit(contrived, 'P2');
      expect(next.phase).toBe('finished');
      expect(next.result?.winners).toEqual([]);
      expect(next.result?.isDraw).toBe(true);
      expect(next.result?.reason).toBe('forfeit');
    });

    it('is a no-op once the game is already finished', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const finished = GameManager.forfeit(g, 'P1');
      const again = GameManager.forfeit(finished, 'P2');
      expect(again).toBe(finished);
    });

    it('awards the win on an explicit leave even if the other player has missed turns', () => {
      // Quitting is a concession, so it is not subject to the "still playing"
      // check that a timeout elimination applies.
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const rusty = {
        ...g,
        players: { ...g.players, P2: { ...g.players.P2!, consecutiveMisses: 2 } },
      };
      const next = GameManager.forfeit(rusty, 'P1');
      expect(next.result?.winners).toEqual(['P2']);
      expect(next.result?.isDraw).toBe(false);
    });

    it('is a no-op for an already-eliminated player', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      const once = GameManager.forfeit(g, 'P2');
      const again = GameManager.forfeit(once, 'P2');
      expect(again).toBe(once);
    });

    it('is a no-op for an unknown player', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const next = GameManager.forfeit(g, 'PX');
      expect(next).toBe(g);
    });

    it('keeps skipping the eliminated player across multiple subsequent turns', () => {
      // (kept in the forfeit block: same elimination path, different trigger)
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      g = GameManager.forfeit(g, 'P2'); // not P2's turn — currentTurn stays P1
      expect(g.currentTurn).toBe('P1');

      let out = GameManager.applyMove(g, { orientation: 'horizontal', row: 0, col: 0 }, 'P1');
      expect(out.ok).toBe(true);
      if (out.ok) g = out.state;
      expect(g.currentTurn).toBe('P3'); // skips P2

      out = GameManager.applyMove(g, { orientation: 'horizontal', row: 5, col: 0 }, 'P3');
      expect(out.ok).toBe(true);
      if (out.ok) g = out.state;
      expect(g.currentTurn).toBe('P4');

      out = GameManager.applyMove(g, { orientation: 'horizontal', row: 5, col: 1 }, 'P4');
      expect(out.ok).toBe(true);
      if (out.ok) g = out.state;
      expect(g.currentTurn).toBe('P1'); // wraps, skipping P2 again
    });

    it('rejects a move attempted by an eliminated player', () => {
      const g0 = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      const g = GameManager.forfeit(g0, 'P2');
      const out = GameManager.applyMove(g, { orientation: 'horizontal', row: 0, col: 0 }, 'P2');
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.reason).toBe('eliminated');
    });

    it('excludes an eliminated player from winners on a normal board-full finish, even with the highest score', () => {
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(3) });
      const allLines = Board.getAllLines(3);
      let i = 0;
      // Play until someone has actually completed at least one box.
      while (i < allLines.length && Object.keys(g.board.boxes).length === 0) {
        const out = GameManager.applyMove(g, allLines[i]!, g.currentTurn);
        if (out.ok) g = out.state;
        i += 1;
      }
      expect(Object.keys(g.board.boxes).length).toBeGreaterThan(0);

      const leaderId = g.turnOrder.reduce((a, b) =>
        (g.players[a]!.score >= g.players[b]!.score ? a : b),
      );
      const leaderScoreBeforeElimination = g.players[leaderId]!.score;
      expect(leaderScoreBeforeElimination).toBeGreaterThan(0);

      g = GameManager.forfeit(g, leaderId);
      expect(g.phase).toBe('playing'); // 2 players remain

      for (; i < allLines.length; i += 1) {
        if (g.phase !== 'playing') break;
        const out = GameManager.applyMove(g, allLines[i]!, g.currentTurn);
        if (out.ok) g = out.state;
      }

      expect(g.phase).toBe('finished');
      expect(g.result?.winners).not.toContain(leaderId);
      expect(g.result?.scores[leaderId]).toBe(leaderScoreBeforeElimination);
    });
  });

  describe('timeoutTurn', () => {
    it('counts a miss and passes play on, without ending the game', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const next = GameManager.timeoutTurn(g);
      expect(next.phase).toBe('playing');
      expect(next.players.P1?.consecutiveMisses).toBe(1);
      expect(next.players.P1?.isEliminated).toBe(false);
      expect(next.currentTurn).toBe('P2');
    });

    it('eliminates a player on their MAX_CONSECUTIVE_MISSES-th straight miss, and the opponent wins', () => {
      // P1 never plays; P2 answers every turn, so P2's streak stays at 0.
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const lines = Board.getAllLines(3);
      let li = 0;

      for (let miss = 1; miss < MAX_CONSECUTIVE_MISSES; miss += 1) {
        g = GameManager.timeoutTurn(g); // P1 misses
        expect(g.phase).toBe('playing');
        expect(g.players.P1?.consecutiveMisses).toBe(miss);

        const out = GameManager.applyMove(g, lines[li++]!, 'P2'); // P2 plays on
        if (out.ok) g = out.state;
        expect(g.players.P2?.consecutiveMisses).toBe(0);
      }

      g = GameManager.timeoutTurn(g); // P1's final miss
      expect(g.players.P1?.isEliminated).toBe(true);
      expect(g.phase).toBe('finished');
      expect(g.result?.reason).toBe('timeout');
      expect(g.result?.winners).toEqual(['P2']);
      expect(g.result?.isDraw).toBe(false);
    });

    it('playing again resets the streak, so an interrupted player is never eliminated', () => {
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const lines = Board.getAllLines(3);

      // P1 misses twice (one short of elimination) across two rounds...
      g = GameManager.timeoutTurn(g);
      let out = GameManager.applyMove(g, lines[0]!, 'P2');
      if (out.ok) g = out.state;
      g = GameManager.timeoutTurn(g);
      expect(g.players.P1?.consecutiveMisses).toBe(2);

      out = GameManager.applyMove(g, lines[1]!, 'P2');
      if (out.ok) g = out.state;

      // ...then comes back and plays: the streak is wiped.
      out = GameManager.applyMove(g, lines[2]!, 'P1');
      expect(out.ok).toBe(true);
      if (out.ok) g = out.state;
      expect(g.players.P1?.consecutiveMisses).toBe(0);
      expect(g.phase).toBe('playing');
      expect(g.players.P1?.isEliminated).toBe(false);
    });

    it('voids the match as a no-contest when BOTH players abandon it', () => {
      // The bug this guards: with both sides gone, whoever times out second
      // must not be handed the win just for having missed one fewer turn.
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      for (let i = 0; i < MAX_CONSECUTIVE_MISSES * 2 && g.phase === 'playing'; i += 1) {
        g = GameManager.timeoutTurn(g);
      }

      expect(g.phase).toBe('finished');
      expect(g.result?.reason).toBe('timeout');
      expect(g.result?.winners).toEqual([]); // nobody was still playing
      expect(g.result?.isDraw).toBe(true);
    });

    it('keeps a 4-player game going when one player times out', () => {
      let g = GameManager.create({ id: 'g', mode: 'friend', size: 5, players: players(4) });
      for (let i = 0; i < MAX_CONSECUTIVE_MISSES; i += 1) {
        // Only P1 ever misses: rotate back around to them each round.
        while (g.currentTurn !== 'P1') g = GameManager.skipTurn(g);
        g = GameManager.timeoutTurn(g);
      }
      expect(g.players.P1?.isEliminated).toBe(true);
      expect(g.phase).toBe('playing'); // P2/P3/P4 are still in
      expect(g.currentTurn).not.toBe('P1');
    });

    it('is a no-op once the game is finished', () => {
      const g = GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(2) });
      const finished = GameManager.forfeit(g, 'P1');
      expect(GameManager.timeoutTurn(finished)).toBe(finished);
    });
  });
});
