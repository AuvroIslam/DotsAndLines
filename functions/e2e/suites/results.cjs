/* eslint-disable */
'use strict';

const {
  db,
  engine,
  signUp,
  callFn,
  getGame,
  getStats,
  getHistory,
  getPendingResult,
  getFinished,
  firestore,
  seedGame,
  startGameFromRoom,
  playMove,
  sleep,
} = require('../lib/harness.cjs');

const { Board } = engine;

/** A client writing to Firestore, so the security rules actually apply. */
async function clientWriteStats(user, data) {
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${process.env.GCLOUD_PROJECT || 'demo-dotsandlines'}/databases/(default)/documents/statistics/${user.uid}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.idToken}`,
      },
      body: JSON.stringify({ fields: data }),
    },
  );
  return res.status;
}

/**
 * The match record is written by the server, and cannot be written by anyone else.
 *
 * `statistics/{uid}` used to be owner-writable, which made the leaderboard free
 * money: you could award yourself nine thousand wins without playing a single
 * game. Cheat-proof moves are worth very little next to a forgeable win record.
 */
module.exports = {
  name: 'results — server-recorded',
  async run(t) {
    t.section('a client cannot write its own record');
    {
      const cheater = await signUp();
      const status = await clientWriteStats(cheater, {
        uid: { stringValue: cheater.uid },
        wins: { integerValue: '9999' },
        gamesPlayed: { integerValue: '9999' },
      });
      t.check('client CANNOT write its own statistics', status >= 400, `HTTP ${status}`);
      t.check('nothing was recorded', (await getStats(cheater.uid)) === null);
    }

    t.section('finishing a game records history and statistics for BOTH players');
    {
      const [a, b] = [await signUp(), await signUp()];
      await startGameFromRoom('res1', [a, b], 3);

      // Play the board out through the server.
      for (const line of Board.getAllLines(3)) {
        const g = await getGame('res1');
        if (g.phase !== 'playing') break;
        if (Board.isLineDrawn(g.board, line)) continue;
        await playMove('res1', line, g.currentTurn === 'P1' ? a : b);
      }

      const g = await getGame('res1');
      t.check('the game finished', g.phase === 'finished', g.phase);

      const [statsA, statsB] = [await getStats(a.uid), await getStats(b.uid)];
      t.check('the winner has statistics', statsA !== null);
      t.check('the loser has statistics too', statsB !== null);
      t.check('each played exactly one game', statsA?.gamesPlayed === 1 && statsB?.gamesPlayed === 1);
      t.check(
        'exactly one win was handed out between them',
        (statsA?.wins ?? 0) + (statsB?.wins ?? 0) === 1,
        `${statsA?.wins} / ${statsB?.wins}`,
      );
      t.check(
        'boxes recorded match the real board',
        (statsA?.totalBoxesWon ?? 0) + (statsB?.totalBoxesWon ?? 0) === 9,
      );

      const [histA, histB] = [await getHistory(a.uid, 'res1'), await getHistory(b.uid, 'res1')];
      t.check('both have a history entry for this game', histA !== null && histB !== null);
      t.check('the entry knows the opponent', histA?.opponents?.[0]?.uid === b.uid);
      t.check('the game is marked recorded', g.resultsRecorded === true);
      t.check('nothing is left owed', (await getPendingResult('res1')) === null);
      t.check('it is queued for eventual deletion', typeof (await getFinished('res1')) === 'number');
    }

    t.section('recording is idempotent — a replay cannot double-count a win');
    {
      // Statistics are a running total, so counting a game twice is not something
      // a player would ever report. Re-running the settle must be a no-op.
      const [a, b] = [await signUp(), await signUp()];
      await startGameFromRoom('res2', [a, b], 3);
      await callFn('forfeitGame', { gameId: 'res2' }, b); // ends instantly: a wins

      const before = await getStats(a.uid);
      t.check('the winner was credited once', before?.wins === 1, JSON.stringify(before));

      // Force the settle to run again, as the sweep's backstop would.
      const authority = require('../.generated/authority.cjs');
      const g = await getGame('res2');
      await authority.settleResults(db, 'res2', g);
      await authority.settleResults(db, 'res2', g);

      const after = await getStats(a.uid);
      t.check('replaying it does NOT double-count the win', after?.wins === 1, JSON.stringify(after));
      t.check('nor the games played', after?.gamesPlayed === 1);
    }

    t.section('an abandoned game still pays out — nobody silently loses a win');
    {
      // A game that ends via the sweep (everyone gone) must still be recorded.
      const [a, b] = [await signUp(), await signUp()];
      await seedGame('res3', [a, b], 3);
      // P2 is one miss from out and their clock has long since run out, so the
      // sweep eliminates them and P1 (who never missed) wins.
      await db.ref('games/res3').update({
        currentTurn: 'P2',
        turnStartedAt: Date.now() - 30_000 * 2,
      });
      await db.ref('games/res3/players/P2/consecutiveMisses').set(2);

      const authority = require('../.generated/authority.cjs');
      await authority.timeoutExpiredTurns(db, 'res3', Date.now());

      const done = await getGame('res3');
      t.check('the sweep ended the game', done.phase === 'finished', done.phase);
      t.check('and recorded it', done.resultsRecorded === true);
      const stats = await getStats(a.uid);
      t.check('the surviving player got their win', (stats?.wins ?? 0) === 1, JSON.stringify(stats));
    }
  },
};
