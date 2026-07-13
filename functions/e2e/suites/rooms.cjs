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
  expireTurn,
  TURN_MS,
  MAX_MISSES,
} = require('../lib/harness.cjs');

/**
 * 3- and 4-player custom rooms.
 *
 * Multi-player is the path where an elimination does NOT end the match, so turn
 * rotation, miss attribution and the no-contest rule all have to keep working
 * with players still in the game. Two real bugs have hidden here — it is worth
 * covering explicitly rather than assuming 2-player coverage generalises.
 */
module.exports = {
  name: 'rooms — 3 and 4 players',
  async run(t) {
    // Held across the first two sections: the second needs the *real* tokens of
    // the players from the first, to prove a survivor can still move.
    let r4Users;

    t.section('4-player: one player abandons, the match CARRIES ON');
    {
      const users = [await signUp(), await signUp(), await signUp(), await signUp()];
      r4Users = users;
      await seedGame('r4', users, 5);

      // P2 never plays; everyone else keeps going.
      for (let guard = 0; guard < 40; guard += 1) {
        const g = await getGame('r4');
        if (g.phase !== 'playing' || g.players.P2.isEliminated) break;
        if (g.currentTurn === 'P2') await expireTurn('r4', users[0]);
        else await playMove('r4', firstFreeLine(g), users[Number(g.currentTurn.slice(1)) - 1]);
      }

      const g = await getGame('r4');
      t.check('the absent player is eliminated', g.players.P2.isEliminated === true);
      t.check(`they were charged exactly ${MAX_MISSES} misses`, g.players.P2.consecutiveMisses === MAX_MISSES, String(g.players.P2.consecutiveMisses));
      t.check('the match is STILL LIVE (3 players left)', g.phase === 'playing', g.phase);
      t.check('no result was written', g.result === null);
      t.check(
        'the players who kept playing carry no misses',
        [g.players.P1, g.players.P3, g.players.P4].every((p) => p.consecutiveMisses === 0),
      );
      t.check('turn rotation skips the eliminated player', g.currentTurn !== 'P2', g.currentTurn);
      t.check('nobody else was eliminated', [g.players.P1, g.players.P3, g.players.P4].every((p) => !p.isEliminated));
    }

    t.section('4-player: a survivor can still move after an elimination');
    {
      // Regression: a rule once rejected any write that carried a server-set
      // isEliminated flag, which froze every 3–4 player game after a timeout.
      const before = await getGame('r4');
      t.check('the game is still playable', before.phase === 'playing');

      const mover = r4Users[Number(before.currentTurn.slice(1)) - 1];
      const ok = await playMove('r4', firstFreeLine(before), mover);
      t.check('a SURVIVOR can still move after an elimination', ok.ok, JSON.stringify(ok.result));

      const after = await getGame('r4');
      t.check('their move landed', Object.keys(after.board.lines).length > Object.keys(before.board.lines).length);
      t.check('the eliminated player stays eliminated', after.players.P2.isEliminated === true);

      // And the eliminated player themselves still cannot play.
      const dead = await playMove('r4', firstFreeLine(after), r4Users[1]);
      t.check('the ELIMINATED player still cannot move', !dead.ok);
    }

    t.section('3-player: two abandon, the one still playing WINS');
    {
      const users = [await signUp(), await signUp(), await signUp()];
      await seedGame('r3', users, 3);

      for (let guard = 0; guard < 40; guard += 1) {
        const g = await getGame('r3');
        if (g.phase !== 'playing') break;
        if (g.currentTurn === 'P1') await playMove('r3', firstFreeLine(g), users[0]);
        else await expireTurn('r3', users[0]);
      }

      const g = await getGame('r3');
      t.check('both absentees are eliminated', g.players.P2.isEliminated && g.players.P3.isEliminated);
      t.check('the match is over', g.phase === 'finished', g.phase);
      t.check("the reason is 'timeout'", g.result?.reason === 'timeout');
      t.check('the player who kept playing WINS', JSON.stringify(g.result?.winners) === '["P1"]', JSON.stringify(g.result));
      t.check('it is not a draw', g.result?.isDraw === false);
    }

    t.section('3-player: EVERYONE abandons — a no-contest');
    {
      const users = [await signUp(), await signUp(), await signUp()];
      await seedGame('r3void', users, 3, {
        turnStartedAt: Date.now() - TURN_MS * (MAX_MISSES * 3 + 2),
      });

      const swept = await authority.timeoutExpiredTurns(db, 'r3void', Date.now());
      t.check('the sweep resolves it in one pass', swept.outcome === 'ok', swept.outcome);

      const g = await getGame('r3void');
      t.check('the match is over', g.phase === 'finished', g.phase);
      t.check('NOBODY is handed the win', (g.result?.winners ?? []).length === 0, JSON.stringify(g.result?.winners));
      t.check('it is a no-contest draw', g.result?.isDraw === true);
      t.check("the reason is 'timeout'", g.result?.reason === 'timeout');
    }

    t.section('4-player: EVERYONE abandons — a no-contest');
    {
      const users = [await signUp(), await signUp(), await signUp(), await signUp()];
      await seedGame('r4void', users, 5, {
        turnStartedAt: Date.now() - TURN_MS * (MAX_MISSES * 4 + 2),
      });

      await authority.timeoutExpiredTurns(db, 'r4void', Date.now());
      const g = await getGame('r4void');
      t.check('the match is over', g.phase === 'finished', g.phase);
      t.check('nobody was left playing, so nobody won', (g.result?.winners ?? []).length === 0, JSON.stringify(g.result?.winners));
      t.check('it is a no-contest draw', g.result?.isDraw === true);
    }

    t.section('3-player: an explicit leave does NOT end a 3-way game');
    {
      const users = [await signUp(), await signUp(), await signUp()];
      await seedGame('r3quit', users, 3);

      const res = await callFn('forfeitGame', { gameId: 'r3quit' }, users[1]); // P2 quits
      t.check('the forfeit is accepted', res.ok);

      const g = await getGame('r3quit');
      t.check('the quitter is eliminated', g.players.P2.isEliminated === true);
      t.check('the match continues with the other two', g.phase === 'playing', g.phase);
      t.check('no result was written', g.result === null);
      t.check('the turn never lands on the quitter', g.currentTurn !== 'P2');
    }
  },
};
