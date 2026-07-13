/* eslint-disable */
'use strict';

const {
  db,
  engine,
  signUp,
  clientPut,
  getGame,
  getDue,
  createGameAsClient,
  playMove,
  sleep,
} = require('../lib/harness.cjs');

const { Board } = engine;

/**
 * Moves are applied by the server, so game state is not forgeable and races
 * cannot double-apply.
 */
module.exports = {
  name: 'moves — server-authoritative',
  async run(t) {
    t.section('a move goes through the server');
    {
      const [a, b] = [await signUp(), await signUp()];
      const status = await createGameAsClient('m1', [a, b]);
      t.check('a client may create a pristine game', status < 400, `HTTP ${status}`);

      const res = await playMove('m1', { orientation: 'horizontal', row: 0, col: 0 }, a);
      t.check('the active player can play', res.ok, JSON.stringify(res.result ?? res.error));

      const g = await getGame('m1');
      t.check('the line is on the board', g.board.lines['h:0:0'] === 'P1');
      t.check('the turn advanced', g.currentTurn === 'P2');
      t.check('the version was bumped', g.version === 1, String(g.version));
    }

    t.section('the server enforces the rules — nothing is taken on trust');
    {
      const [a, b] = [await signUp(), await signUp()];
      await createGameAsClient('m2', [a, b]);

      const outOfTurn = await playMove('m2', { orientation: 'horizontal', row: 0, col: 1 }, b);
      t.check('a player CANNOT move out of turn', !outOfTurn.ok);

      await playMove('m2', { orientation: 'horizontal', row: 0, col: 0 }, a);
      const redraw = await playMove('m2', { orientation: 'horizontal', row: 0, col: 0 }, b);
      t.check('a line CANNOT be drawn twice', !redraw.ok);

      const oob = await playMove('m2', { orientation: 'horizontal', row: 99, col: 99 }, b);
      t.check('an out-of-bounds line is refused', !oob.ok);

      const stranger = await signUp();
      const outsider = await playMove('m2', { orientation: 'vertical', row: 0, col: 0 }, stranger);
      t.check(
        'a non-member CANNOT move',
        outsider.status >= 400 && outsider.error?.status === 'PERMISSION_DENIED',
      );

      const g = await getGame('m2');
      t.check('no rejected move touched the board', Object.keys(g.board.lines).length === 1);
    }

    t.section('the board can no longer be forged');
    {
      // The attack this closes: write a full board claiming every box, then let
      // the server dutifully compute you the win.
      const [a, b] = [await signUp(), await signUp()];
      await createGameAsClient('m3', [a, b]);

      const boxes = {};
      for (let i = 0; i < 9; i += 1) boxes[`b:${i}:0`] = 'P1';

      t.check('cheater CANNOT write board.boxes', (await clientPut('games/m3/board/boxes', boxes, a)) >= 400);
      t.check('cheater CANNOT write a line directly', (await clientPut('games/m3/board/lines/h:0:0', 'P1', a)) >= 400);
      t.check('cheater CANNOT set their own score', (await clientPut('games/m3/players/P1/score', 99, a)) >= 400);
      t.check('cheater CANNOT set phase=finished', (await clientPut('games/m3/phase', 'finished', a)) >= 400);
      t.check(
        'cheater CANNOT write a result',
        (await clientPut('games/m3/result', { winners: ['P1'], isDraw: false, scores: {}, phase: 'finished' }, a)) >= 400,
      );
      t.check('cheater CANNOT eliminate the opponent', (await clientPut('games/m3/players/P2/isEliminated', true, a)) >= 400);
      t.check('cheater CANNOT rewind the version', (await clientPut('games/m3/version', 0, a)) >= 400);
      t.check(
        'cheater CANNOT overwrite the whole game',
        (await clientPut('games/m3', { id: 'm3', version: 0, phase: 'playing', board: { size: 3 }, players: {}, turnOrder: [], currentTurn: 'P1' }, a)) >= 400,
      );

      const g = await getGame('m3');
      t.check(
        'the game is exactly as it started',
        Object.keys(g.board.lines).length === 0 && g.players.P1.score === 0 && g.phase === 'playing',
      );
    }

    t.section('a move persists a delta, not the whole game');
    {
      const [a, b] = [await signUp(), await signUp()];
      await createGameAsClient('m4', [a, b], 5); // bigger board => bigger game node

      // Watch exactly which children of the game node change for one move.
      const touched = [];
      const ref = db.ref('games/m4');
      const onChange = (snap) => touched.push(snap.key);
      ref.on('child_changed', onChange);
      ref.on('child_added', onChange);
      await sleep(300);
      touched.length = 0; // ignore the initial sync

      await playMove('m4', { orientation: 'horizontal', row: 0, col: 0 }, a);
      await sleep(600);
      ref.off('child_changed', onChange);
      ref.off('child_added', onChange);

      const keys = [...new Set(touched)].sort().join(',');
      t.check(
        'only the expected leaves changed',
        keys === 'board,currentTurn,turnStartedAt,updatedAt,version',
        keys,
      );
      t.check('players/ was NOT rewritten (no score changed)', !keys.includes('players'));

      const g = await getGame('m4');
      t.check('the move still landed correctly', g.board.lines['h:0:0'] === 'P1' && g.currentTurn === 'P2');
    }

    t.section('a completing move finalizes in the same call');
    {
      const [a, b] = [await signUp(), await signUp()];
      await createGameAsClient('m5', [a, b], 3);

      for (const line of Board.getAllLines(3)) {
        const g = await getGame('m5');
        if (g.phase !== 'playing') break;
        if (Board.isLineDrawn(g.board, line)) continue;
        await playMove('m5', line, g.currentTurn === 'P1' ? a : b);
      }

      const g = await getGame('m5');
      t.check('the game finished with no separate finalize call', g.phase === 'finished', g.phase);
      t.check('the server wrote a result', g.result !== null);
      t.check('the winner came from the real board', (g.result?.winners ?? []).length >= 1);
      t.check('every box was claimed', Object.keys(g.board.boxes).length === 9);
      t.check(
        'scores add up to the boxes',
        (g.result.scores.P1 ?? 0) + (g.result.scores.P2 ?? 0) === 9,
      );
      t.check('the finished game left the due-index', (await getDue('m5')) === null);

      const after = await playMove('m5', { orientation: 'vertical', row: 0, col: 0 }, a);
      t.check('no move is accepted after the game ends', !after.ok);
    }

    t.section('concurrency — a double-tap cannot apply twice');
    {
      const [a, b] = [await signUp(), await signUp()];
      await createGameAsClient('m6', [a, b], 5);

      // Fire the identical move twice, simultaneously. The version CAS must let
      // exactly one through.
      const line = { orientation: 'horizontal', row: 0, col: 0 };
      const [r1, r2] = await Promise.all([playMove('m6', line, a), playMove('m6', line, a)]);
      const accepted = [r1, r2].filter((r) => r.ok).length;
      t.check('exactly ONE of two simultaneous identical moves is accepted', accepted === 1, `accepted ${accepted}`);

      const g = await getGame('m6');
      t.check('the board has exactly one line', Object.keys(g.board.lines).length === 1);
      t.check('the version advanced exactly once', g.version === 1, String(g.version));
      t.check('the turn advanced exactly once', g.currentTurn === 'P2');
    }
  },
};
