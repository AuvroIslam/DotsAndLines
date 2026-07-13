/* eslint-disable */
'use strict';

const {
  db,
  authority,
  signUp,
  callFn,
  getGame,
  seedGame,
  playMove,
  firstFreeLine,
  TURN_MS,
  MAX_MISSES,
} = require('../lib/harness.cjs');

/**
 * Abandoned games resolve by *missed turns*, not by connection state.
 *
 * A network drop, a backgrounded app and an idle player are indistinguishable to
 * the server, so none of them end a match directly — they cost you turns, like a
 * shot clock. This is the 8-Ball-Pool model, and it means a brief interruption
 * costs at most a turn while genuinely leaving costs the match.
 */
module.exports = {
  name: 'disconnect — resolved by missed turns',
  async run(t) {
    t.section('an absent player loses TURNS, not the match');
    {
      const [a, b] = [await signUp(), await signUp()];
      // P1's clock has already run out — they are gone, backgrounded, or idle.
      await seedGame('d1', [a, b], 3, { turnStartedAt: Date.now() - TURN_MS - 1_000 });

      // The *opponent* asks: P1 cannot, they are the one who is away.
      const res = await callFn('requestTurnTimeout', { gameId: 'd1' }, b);
      t.check('the opponent can drive an absent player’s clock', res.ok, JSON.stringify(res.result));

      const g = await getGame('d1');
      t.check('the absent player is charged ONE miss', g.players.P1.consecutiveMisses === 1);
      t.check('one miss does NOT eliminate them', g.players.P1.isEliminated === false);
      t.check('the match is still live', g.phase === 'playing');
      t.check('play passed to the opponent', g.currentTurn === 'P2');
    }

    t.section('coming back resets the streak — a phone call costs nothing');
    {
      const [a, b] = [await signUp(), await signUp()];
      await seedGame('d2', [a, b], 3);
      // Two misses already: one short of elimination.
      await db.ref('games/d2/players/P1/consecutiveMisses').set(MAX_MISSES - 1);

      const g0 = await getGame('d2');
      await playMove('d2', firstFreeLine(g0), a); // P1 returns and plays

      const g = await getGame('d2');
      t.check('playing wipes the streak', g.players.P1.consecutiveMisses === 0, String(g.players.P1.consecutiveMisses));
      t.check('they were never eliminated', g.players.P1.isEliminated === false);
    }

    t.section(`${MAX_MISSES} straight misses — eliminated, and the live opponent WINS`);
    {
      const [a, b] = [await signUp(), await signUp()];
      // P1 is one miss from out; P2 has been playing (streak 0). P1's clock is up.
      await seedGame('d3', [a, b], 3, { turnStartedAt: Date.now() - TURN_MS - 1_000 });
      await db.ref('games/d3/players/P1/consecutiveMisses').set(MAX_MISSES - 1);

      const res = await callFn('requestTurnTimeout', { gameId: 'd3' }, b);
      t.check('the final miss is applied', res.ok);

      const g = await getGame('d3');
      t.check('the abandoning player is eliminated', g.players.P1.isEliminated === true);
      t.check('the match is over', g.phase === 'finished', g.phase);
      t.check("the reason is 'timeout'", g.result?.reason === 'timeout');
      t.check('the player who kept playing WINS', JSON.stringify(g.result?.winners) === '["P2"]', JSON.stringify(g.result));
      t.check('it is not a draw', g.result?.isDraw === false);
    }

    t.section('BOTH abandon — a no-contest, not an arbitrary winner');
    {
      // The bug this guards: with both sides gone, whoever times out *second*
      // must not be handed the win just for having missed one fewer turn.
      const [a, b] = [await signUp(), await signUp()];
      await seedGame('d4', [a, b], 3, {
        turnStartedAt: Date.now() - TURN_MS * (MAX_MISSES * 2 + 1),
      });

      const swept = await authority.timeoutExpiredTurns(db, 'd4', Date.now());
      t.check('the sweep resolves the abandoned game in one pass', swept.outcome === 'ok', swept.outcome);

      const g = await getGame('d4');
      t.check('the match is over', g.phase === 'finished', g.phase);
      t.check('NOBODY is awarded the win', (g.result?.winners ?? []).length === 0, JSON.stringify(g.result?.winners));
      t.check('it is recorded as a no-contest draw', g.result?.isDraw === true);
    }

    t.section('the clock cannot be rushed');
    {
      const [a, b] = [await signUp(), await signUp()];
      await seedGame('d5', [a, b], 3, { turnStartedAt: Date.now() });

      const early = await callFn('requestTurnTimeout', { gameId: 'd5' }, b);
      t.check('an early timeout request is a no-op', !early.ok);

      const g = await getGame('d5');
      t.check('no miss was charged', g.players.P1.consecutiveMisses === 0);
      t.check('the turn is unchanged', g.currentTurn === 'P1');

      const stranger = await signUp();
      const denied = await callFn('requestTurnTimeout', { gameId: 'd5' }, stranger);
      t.check('a non-member is rejected', denied.status >= 400 && denied.error?.status === 'PERMISSION_DENIED');
    }

    t.section('an explicit leave still loses instantly — quitting is a concession');
    {
      const [a, b] = [await signUp(), await signUp()];
      await seedGame('d6', [a, b], 3);
      // Even though the opponent has missed turns, quitting hands them the win.
      await db.ref('games/d6/players/P2/consecutiveMisses').set(2);

      const res = await callFn('forfeitGame', { gameId: 'd6' }, a);
      t.check('the forfeit is accepted', res.ok);

      const g = await getGame('d6');
      t.check('the quitter is eliminated', g.players.P1.isEliminated === true);
      t.check('the opponent wins despite their misses', JSON.stringify(g.result?.winners) === '["P2"]');
      t.check("the reason is 'forfeit'", g.result?.reason === 'forfeit');
    }

    t.section('a completed board is finished, not charged a miss');
    {
      // Guards the window between a board filling and the result being written:
      // a full board is a *finished* game, not an idle player. The sweep must
      // finalize it rather than punish whoever happens to be on the clock.
      const [a, b] = [await signUp(), await signUp()];
      const boxes = {};
      for (let i = 0; i < 9; i += 1) boxes[`b:${i}:0`] = i < 5 ? 'P1' : 'P2';
      await seedGame('d7', [a, b], 3, { turnStartedAt: Date.now() - TURN_MS - 5_000 });
      await db.ref('games/d7/board/boxes').set(boxes);

      await authority.timeoutExpiredTurns(db, 'd7', Date.now());

      const g = await getGame('d7');
      t.check('no bogus miss was charged', (g.players.P1.consecutiveMisses ?? 0) === 0);
      t.check('the completed board was finalized instead', g.phase === 'finished', g.phase);
      t.check('the winner came from the board, not the clock', g.result?.reason == null);
      t.check('the higher scorer won', JSON.stringify(g.result?.winners) === '["P1"]');
    }
  },
};
