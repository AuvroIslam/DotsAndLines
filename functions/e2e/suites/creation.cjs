/* eslint-disable */
'use strict';

const {
  db,
  signUp,
  callFn,
  clientPut,
  getGame,
  getDue,
  seedRoom,
  startGameFromRoom,
  buildGame,
} = require('../lib/harness.cjs');

/**
 * Games are created by the server, and only by the server.
 *
 * They used to be built on the client and written straight to the database. That
 * meant the creator chose the turn clock, the starting player and the board — and
 * that is a forced win: ship a one-second clock, hand the opponent the first
 * turn, and they miss every turn until they are eliminated, while your own streak
 * stays clean so even the "only someone still playing may win" rule is satisfied.
 */
module.exports = {
  name: 'creation — server-owned',
  async run(t) {
    t.section('a client cannot write game state at all');
    {
      const [a, b] = [await signUp(), await signUp()];
      const game = buildGame('c1', [a, b]);

      // Not even a pristine, honest-looking game.
      t.check('client CANNOT create a game', (await clientPut('games/c1', game, a)) >= 400);
      t.check('client CANNOT write gameMembers', (await clientPut('gameMembers/c1', { [a.uid]: true }, a)) >= 400);
      t.check('client CANNOT write the due-index', (await clientPut('activeGames/c1', Date.now(), a)) >= 400);
      t.check('the game does not exist', (await getGame('c1')) === null);
    }

    t.section('the host cannot rig the clock, the board or the turn order');
    {
      // The exploit: a game whose turn clock is one second and whose first turn
      // belongs to the opponent. Impossible now — the client supplies none of it.
      const [a, b] = [await signUp(), await signUp()];
      const rigged = buildGame('c2', [a, b], 3, {
        turnDurationMs: 1000,
        currentTurn: 'P2',
        turnStartedAt: Date.now() - 3_600_000,
      });
      t.check('a rigged game cannot be written directly', (await clientPut('games/c2', rigged, a)) >= 400);

      // Ask the server for the same game instead: it ignores anything we'd like.
      const res = await startGameFromRoom('c2', [a, b]);
      t.check('the server creates it', res.status === 200);

      const g = await getGame('c2');
      t.check('the server chose a real turn clock, not 1s', g.turnDurationMs >= 10_000, String(g.turnDurationMs));
      t.check('the first turn belongs to the first player', g.currentTurn === 'P1', g.currentTurn);
      t.check('the clock starts now, not an hour ago', Math.abs(g.turnStartedAt - Date.now()) < 60_000);
      t.check('the board is empty', Object.keys(g.board.lines).length === 0);
      t.check('everyone starts on zero', Object.values(g.players).every((p) => p.score === 0 && p.consecutiveMisses === 0 && !p.isEliminated));
      t.check('it starts unversioned', g.version === 0);
    }

    t.section('only the host may start a room, and only once');
    {
      const [host, guest] = [await signUp(), await signUp()];
      await seedRoom('c3', [host, guest]);

      const byGuest = await callFn('createGame', { source: 'room', roomId: 'c3' }, guest);
      t.check('a non-host CANNOT start the room', byGuest.status >= 400 && byGuest.error?.status === 'PERMISSION_DENIED');
      t.check('no game was created', (await getGame('c3')) === null);

      const byHost = await callFn('createGame', { source: 'room', roomId: 'c3' }, host);
      t.check('the host CAN start it', byHost.status === 200);

      const again = await callFn('createGame', { source: 'room', roomId: 'c3' }, host);
      t.check('starting twice is refused', again.status >= 400, JSON.stringify(again.result));

      const stranger = await signUp();
      const byStranger = await callFn('createGame', { source: 'room', roomId: 'c3' }, stranger);
      t.check('a stranger CANNOT start it', byStranger.status >= 400);
    }

    t.section('the game, its members and its due-index land together');
    {
      // The sweep finds overdue games *only* through the due-index, so a game
      // that landed without its entry would be invisible to it forever: never
      // timed out, never finished, stuck in `playing` for good. One atomic write
      // is what makes that impossible.
      const [a, b] = [await signUp(), await signUp()];
      await startGameFromRoom('c4', [a, b]);

      const g = await getGame('c4');
      const members = (await db.ref('gameMembers/c4').get()).val();
      const due = await getDue('c4');

      t.check('the game exists', g !== null);
      t.check('both players are in the membership index', members[a.uid] === true && members[b.uid] === true);
      t.check('the due-index holds its turn deadline', due === g.turnStartedAt + g.turnDurationMs, String(due));
      t.check('the room now points at the game', (await db.ref('rooms/c4/gameId').get()).val() === 'c4');
    }

    t.section('matchmaking: only a claim you actually won becomes a game');
    {
      const [a, b, c] = [await signUp(), await signUp(), await signUp()];
      const ticket = (u) => ({ uid: u.uid, displayName: 'x', enqueuedAt: Date.now(), boardSize: 3 });

      await db.ref(`matchmaking/queue/${a.uid}`).set(ticket(a));
      await db.ref(`matchmaking/queue/${b.uid}`).set(ticket(b));
      await db.ref(`matchmaking/queue/${c.uid}`).set(ticket(c));

      // c never claimed b, so it may not start a game against them.
      const unclaimed = await callFn('createGame', { source: 'match', opponentUid: b.uid }, c);
      t.check('you CANNOT pull an unclaimed player out of the queue', unclaimed.status >= 400);

      // a claims b properly (the transaction the client runs), then asks.
      await db.ref(`matchmaking/queue/${b.uid}/claimedBy`).set(a.uid);
      const made = await callFn('createGame', { source: 'match', opponentUid: b.uid }, a);
      t.check('a won claim becomes a game', made.status === 200, JSON.stringify(made.error));

      const gameId = made.result.gameId;
      const g = await getGame(gameId);
      t.check('the two claimants are its players', [g.players.P1.uid, g.players.P2.uid].sort().join() === [a.uid, b.uid].sort().join());
      t.check("both tickets are stamped with the server's id", (await db.ref(`matchmaking/queue/${a.uid}/gameId`).get()).val() === gameId);
      t.check('the opponent ticket too', (await db.ref(`matchmaking/queue/${b.uid}/gameId`).get()).val() === gameId);

      // And a client cannot forge the assignment itself.
      t.check('client CANNOT stamp a gameId onto a ticket', (await clientPut(`matchmaking/queue/${c.uid}/gameId`, 'anything', c)) >= 400);
    }
  },
};
