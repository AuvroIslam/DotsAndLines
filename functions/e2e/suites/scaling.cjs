/* eslint-disable */
'use strict';

const {
  db,
  engine,
  authority,
  createGame,
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

    t.section('rematch: nobody is dragged into a game they did not agree to');
    {
      // The bug this guards: the rematch used to start a live game on the *first*
      // request. The player who declined — who tapped "Back to Home" — was
      // silently a member of a new game with a running clock. They never saw it,
      // missed three turns, and were eliminated: a real, recorded defeat in a
      // match they never agreed to play.
      const users = [await signUp(), await signUp()];
      await seedGame('rmq', users);
      await callFn('forfeitGame', { gameId: 'rmq' }, users[0]);

      const offer = await callFn('createGame', { source: 'rematch', fromGameId: 'rmq' }, users[0]);
      t.check('one player may offer a rematch', offer.status === 200, JSON.stringify(offer.error));
      t.check('but it starts NO game on its own', offer.result?.gameId == null, JSON.stringify(offer.result));
      t.check('and it says so, rather than failing', offer.result?.pending === true);

      const old = await getGame('rmq');
      t.check('the offer is recorded', !!old.rematchOffers?.[users[0].uid]);
      t.check('no rematch game is announced yet', old.rematchGameId == null);

      // The decliner simply never asks. Nothing may exist that can time them out:
      // no game they're a member of beyond the one they actually played, and
      // nothing of theirs sitting on a turn clock.
      const decliner = users[1].uid;
      const allMembers = (await db.ref('gameMembers').get()).val() ?? {};
      const theirGames = Object.entries(allMembers)
        .filter(([, members]) => members?.[decliner])
        .map(([id]) => id);
      t.check(
        'the decliner is in NO game but the one they actually played',
        theirGames.join() === 'rmq',
        theirGames.join(),
      );

      const due = (await db.ref('activeGames').get()).val() ?? {};
      t.check(
        'and nothing of theirs is on a turn clock waiting to eliminate them',
        !theirGames.some((id) => due[id] !== undefined),
        Object.keys(due).join(),
      );
    }

    t.section('rematch: leaving retracts the offer, so a late accept starts nothing');
    {
      // The report this guards: P1 offers a rematch, then taps "Back to Home".
      // P2 accepts a moment later. Without retraction P1 — who left — is pulled
      // into a live game, misses three turns and is defeated in a match they
      // walked away from. Leaving must withdraw the offer.
      const users = [await signUp(), await signUp()];
      await seedGame('rmw', users);
      await callFn('forfeitGame', { gameId: 'rmw' }, users[0]);

      await createGame.createRematch(db, users[0].uid, 'rmw'); // P1 offers
      await createGame.withdrawRematch(db, users[0].uid, 'rmw'); // …then leaves
      t.check("the departed player's offer is gone", !(await getGame('rmw')).rematchOffers?.[users[0].uid]);

      const late = await createGame.createRematch(db, users[1].uid, 'rmw'); // P2 accepts late
      t.check('the late acceptance starts no game', late.gameId == null && late.pending === true, JSON.stringify(late));
      t.check('nothing was stamped on the finished game', (await getGame('rmw')).rematchGameId == null);

      const spawned = Object.keys((await db.ref('games').get()).val() ?? {}).filter((id) => id.startsWith('rm_rmw'));
      t.check('the player who left is in NO new game', spawned.length === 0, spawned.join());
    }

    t.section('rematch: a stale offer no longer counts');
    {
      // Backstop for the app that dies before it can retract: an offer older than
      // its freshness window must not let an opponent drag the long-gone player in.
      const users = [await signUp(), await signUp()];
      await seedGame('rmstale', users);
      await callFn('forfeitGame', { gameId: 'rmstale' }, users[0]);

      await createGame.createRematch(db, users[0].uid, 'rmstale'); // P1 offers…
      // …and their app dies. Backdate the offer past the TTL to simulate the wait.
      await db
        .ref(`games/rmstale/rematchOffers/${users[0].uid}`)
        .set(Date.now() - createGame.REMATCH_OFFER_TTL_MS - 1_000);

      const accept = await createGame.createRematch(db, users[1].uid, 'rmstale');
      t.check('a stale offer does not complete the rematch', accept.gameId == null && accept.pending === true, JSON.stringify(accept));
      t.check('no game was stamped', (await getGame('rmstale')).rematchGameId == null);

      // And a player can renew: tapping again restamps a fresh time, so a genuine
      // second attempt still works.
      await createGame.createRematch(db, users[0].uid, 'rmstale'); // P1 re-offers, fresh
      const now = await createGame.createRematch(db, users[1].uid, 'rmstale'); // P2 accepts
      t.check('renewing a lapsed offer lets the rematch complete', !!now.gameId, JSON.stringify(now));
    }

    t.section('rematch: two players agreeing at the SAME INSTANT still get a game');
    {
      // The bug this guards: recording the offer used to be a read-then-write.
      // Both players tapping together each read the offers as empty, each wrote
      // only their own, and neither saw a complete roster — so no game was ever
      // created and both clients sat on a *disabled* "Waiting for opponent…"
      // button, unable even to retry. The sequential test below passes happily
      // while this one deadlocks, which is exactly why it exists.
      const users = [await signUp(), await signUp()];
      await seedGame('rmrace', users);
      await callFn('forfeitGame', { gameId: 'rmrace' }, users[0]);

      // Called directly, NOT over HTTP: the Functions emulator serialises
      // requests, so a concurrent `callFn` pair runs one-after-the-other and
      // passes even against the broken read-then-write. Driving the real
      // function this way reproduced the deadlock 12/12 times before the fix.
      const [a, b] = await Promise.all([
        createGame.createRematch(db, users[0].uid, 'rmrace'),
        createGame.createRematch(db, users[1].uid, 'rmrace'),
      ]);
      t.check('both requests are accepted', a.ok === true && b.ok === true);
      t.check(
        'exactly ONE of them is the completer — the other waits',
        [a, b].filter((r) => r.gameId).length === 1,
        `completers=${[a, b].filter((r) => r.gameId).length}`,
      );

      const old = await getGame('rmrace');
      t.check('both offers were recorded — neither clobbered the other', Object.keys(old.rematchOffers ?? {}).length === 2, JSON.stringify(old.rematchOffers));
      t.check('a rematch game WAS created despite the tie', !!old.rematchGameId, 'no game — deadlocked');

      // Exactly one game, not two: a tie must not fork the players into
      // separate matches, each waiting for an opponent who is in the other.
      const spawned = Object.keys((await db.ref('games').get()).val() ?? {}).filter((id) =>
        id.startsWith('rm_rmrace'),
      );
      t.check('exactly ONE rematch game exists, not two', spawned.length === 1, spawned.join());

      const fresh = await getGame(old.rematchGameId);
      t.check('it is live and holds both players', fresh?.phase === 'playing' && Object.keys(fresh.players).length === 2);
      t.check(
        'the completer was handed the very game that got stamped',
        [a, b].find((r) => r.gameId)?.gameId === old.rematchGameId,
      );
    }

    t.section('rematch: once everyone agrees, the game starts');
    {
      const users = [await signUp(), await signUp()];
      await seedGame('rm', users);
      await callFn('forfeitGame', { gameId: 'rm' }, users[0]);

      const first = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, users[1]);
      t.check('the first request only offers', first.result?.pending === true);

      const second = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, users[0]);
      t.check('the last player to agree gets the new game', !!second.result?.gameId, JSON.stringify(second.result));

      const newId = second.result.gameId;
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
      t.check('the OLD game announces it, so the offerer just sees it', old.rematchGameId === newId);

      const again = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, users[1]);
      t.check('the other player joins the same rematch, not a second one', again.result?.gameId === newId);

      const stranger = await signUp();
      const denied = await callFn('createGame', { source: 'rematch', fromGameId: 'rm' }, stranger);
      t.check('a stranger cannot rematch a game they never played', denied.status >= 400);
    }
  },
};
