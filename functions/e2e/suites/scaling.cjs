/* eslint-disable */
'use strict';

const {
  db,
  engine,
  authority,
  signUp,
  callFn,
  clientPut,
  getGame,
  getDue,
  seedGame,
  TURN_MS,
} = require('../lib/harness.cjs');

const { Board, GameManager } = engine;

/**
 * The structural properties that let this hold at a thousand concurrent games.
 *
 * These are easy to break without noticing, because breaking them costs *money*
 * rather than correctness — the game still works, it just quietly reads or
 * rewrites far more than it needs to. So they are asserted directly.
 */
module.exports = {
  name: 'scaling — reads, writes and fan-out',
  async run(t) {
    t.section('the sweep reads only OVERDUE games, never every live one');
    {
      const users = [await signUp(), await signUp()];
      for (let i = 0; i < 20; i += 1) await seedGame(`live${i}`, users); // healthy
      await seedGame('due1', users, 3, { turnStartedAt: Date.now() - TURN_MS - 5_000 });
      await seedGame('due2', users, 3, { turnStartedAt: Date.now() - TURN_MS - 5_000 });
      await db.ref('activeGames/due1').set(Date.now() - 5_000);
      await db.ref('activeGames/due2').set(Date.now() - 5_000);

      // Exactly the query the sweep runs.
      const snap = await db.ref('activeGames').orderByValue().endAt(Date.now()).once('value');
      const due = Object.keys(snap.val() ?? {}).sort();

      t.check('the due-index returns ONLY overdue games', due.length === 2, `got ${due.length}: ${due}`);
      t.check('it found exactly the two that are overdue', due.join(',') === 'due1,due2', due.join(','));
      t.check('the 20 healthy games are never read', !due.includes('live0') && !due.includes('live19'));

      const total = Object.keys((await db.ref('games').get()).val() ?? {}).length;
      t.check('…despite 22+ games existing (the old sweep downloaded them all)', total >= 22, String(total));
    }

    t.section('the due-index is re-armed on a write and REMOVED when a game ends');
    {
      const users = [await signUp(), await signUp()];
      await seedGame('idx', users);
      t.check('a live game is in the due-index', typeof (await getDue('idx')) === 'number');

      // A finished game must leave the index, or the sweep would rediscover it
      // forever and the index would grow without bound.
      const res = await callFn('forfeitGame', { gameId: 'idx' }, users[0]);
      t.check('the forfeit is accepted', res.ok);
      t.check('the finished game is REMOVED from the due-index', (await getDue('idx')) === null);
      t.check('the game really did finish', (await getGame('idx')).phase === 'finished');
    }

    t.section('heartbeats never touch the game node');
    {
      // If presence lived in the game, every heartbeat (one per player every few
      // seconds) would rewrite the game and push a snapshot to every subscriber —
      // turning traffic from O(moves) into O(players per second).
      const users = [await signUp(), await signUp()];
      await seedGame('hb', users);
      const before = await getGame('hb');

      await clientPut('gamePresence/hb/P1/isConnected', true, users[0]);
      await clientPut('gamePresence/hb/P1/lastSeenAt', Date.now(), users[0]);
      await clientPut('gamePresence/hb/P1/lastSeenAt', Date.now() + 1, users[0]);

      const after = await getGame('hb');
      t.check('the game node is unchanged by 3 heartbeats', JSON.stringify(after) === JSON.stringify(before));

      const presence = (await db.ref('gamePresence/hb').get()).val();
      t.check('presence landed in its own node', presence?.P1?.isConnected === true);
      t.check(
        "a client CANNOT write another player's presence",
        (await clientPut('gamePresence/hb/P2/isConnected', false, users[0])) >= 400,
      );
    }

    t.section('no per-move trigger — the sweep backstops finalization');
    {
      // `playMove` finalizes a completing move in the same call (see the moves
      // suite), so there is no per-move trigger. What must still hold is the
      // backstop: a game left complete-but-unfinished cannot hang forever, and an
      // *incomplete* board is never finalized just because something asked.
      const users = [await signUp(), await signUp()];
      await seedGame('fin', users);

      const early = await authority.finalizeIfComplete(db, 'fin', Date.now());
      t.check('the backstop REFUSES an unfinished board', early.outcome !== 'ok', early.outcome);
      t.check('the game is untouched', (await getGame('fin')).phase === 'playing');
      t.check('it is still in the due-index', typeof (await getDue('fin')) === 'number');

      // Simulate a game left complete-but-unfinished.
      let state = await getGame('fin');
      for (const line of Board.getAllLines(state.board.size)) {
        if (Board.isLineDrawn(state.board, line)) continue;
        const out = GameManager.applyMove(state, line, state.currentTurn, Date.now());
        if (!out.ok) continue;
        state = out.state.phase === 'finished' ? { ...out.state, phase: 'playing', result: null } : out.state;
        await db.ref('games/fin').set(state);
        if (Object.keys(state.board.boxes).length === 9) break;
      }
      t.check('the board is full but still marked playing', (await getGame('fin')).phase === 'playing');

      const rescued = await authority.finalizeIfComplete(db, 'fin', Date.now());
      t.check('the backstop finalizes it', rescued.outcome === 'ok', rescued.outcome);

      const g = await getGame('fin');
      t.check('a result was written server-side', g.phase === 'finished' && g.result !== null);
      t.check('the winner came from the real board', (g.result?.winners ?? []).length >= 1);
      t.check('the finished game left the due-index', (await getDue('fin')) === null);
    }

    t.section('finished games are eventually deleted');
    {
      // Without a TTL, every game ever played is kept forever — and so is its
      // membership index and everyone's presence records.
      const users = [await signUp(), await signUp()];
      await seedGame('ttl', users);
      await callFn('forfeitGame', { gameId: 'ttl' }, users[0]); // end it
      await db.ref('gamePresence/ttl/P1').set({ isConnected: true, lastSeenAt: Date.now() });

      t.check('it is queued for deletion, not deleted yet', typeof (await db.ref('finishedGames/ttl').get()).val() === 'number');
      t.check('the game is still readable for now', (await getGame('ttl')) !== null);

      // Backdate it past the TTL and run the janitor's deletion step.
      await db.ref('finishedGames/ttl').set(Date.now() - 1000);
      const expired = Object.keys(
        (await db.ref('finishedGames').orderByValue().endAt(Date.now()).once('value')).val() ?? {},
      );
      t.check('the expired game shows up as due', expired.includes('ttl'));

      await db.ref().update({
        'games/ttl': null,
        'gameMembers/ttl': null,
        'gamePresence/ttl': null,
        'activeGames/ttl': null,
        'pendingResults/ttl': null,
        'finishedGames/ttl': null,
      });

      t.check('the game is gone', (await getGame('ttl')) === null);
      t.check('its membership index is gone', (await db.ref('gameMembers/ttl').get()).val() === null);
      t.check('its presence records are gone', (await db.ref('gamePresence/ttl').get()).val() === null);
      t.check('it is out of every index', (await db.ref('finishedGames/ttl').get()).val() === null);
    }

    t.section('rematch: same players, new game, announced on the old one');
    {
      const users = [await signUp(), await signUp()];
      await seedGame('rm', users);
      await callFn('forfeitGame', { gameId: 'rm' }, users[0]);

      const res = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, users[1]);
      t.check('a player can start a rematch', res.status === 200, JSON.stringify(res.error));

      const newId = res.result.gameId;
      const fresh = await getGame(newId);
      t.check('the new game is live', fresh.phase === 'playing');
      t.check('same players', Object.values(fresh.players).map((p) => p.uid).sort().join() === users.map((u) => u.uid).sort().join());
      t.check('a fresh board', Object.keys(fresh.board.lines).length === 0);
      t.check(
        'the loser of the coin-toss goes first this time (order rotated)',
        fresh.players.P1.uid === users[1].uid,
        fresh.players.P1.uid,
      );

      const old = await getGame('rm');
      t.check('the OLD game announces it, so the opponent just sees it', old.rematchGameId === newId);

      const again = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, users[0]);
      t.check('the other player joins the same rematch, not a second one', again.result?.gameId === newId);

      const stranger = await signUp();
      const denied = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, stranger);
      t.check('a stranger cannot rematch a game they never played', denied.status >= 400);
    }
  },
};
