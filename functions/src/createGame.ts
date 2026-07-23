import type { Database } from 'firebase-admin/database';

import { GameManager } from '@/gameEngine';
import { normalizeGame } from '@/services/firebase/rtdbSerialize';
import { playerColors } from '@/theme/colors';
import type { GameState, MatchmakingTicket, Player, PlayerIndex, Room } from '@/types';

/**
 * Games are built here and nowhere else.
 *
 * They used to be constructed on the client and written straight to the
 * database, which meant the creator chose `turnDurationMs`, `currentTurn`,
 * `turnStartedAt` and the board size. That is a forced win: set the clock to one
 * second and hand the opponent the first turn, and they miss every turn until
 * they are eliminated — while the cheater's own streak stays clean, so even the
 * "only a player who is still playing may win" rule is satisfied.
 *
 * So the client no longer says *what the game is*, only *which room or opponent*
 * it wants to play. Everything else is derived here from state the client cannot
 * write, and `GameManager.create` picks the clock and the starting player.
 */

export type CreateOutcome =
  | { ok: true; gameId: string; pending?: false }
  /** The request was accepted, but the game does not exist yet — see `createRematch`. */
  | { ok: true; gameId: null; pending: true }
  | { ok: false; reason: 'not_found' | 'not_allowed' | 'already_started' | 'not_enough_players' };

/** A queue ticket, plus the claim/assignment stamps the pairing flow adds. */
type QueuedTicket = MatchmakingTicket & { gameId?: string; claimedBy?: string };

/**
 * How long a rematch offer stays valid. An offer is a statement of *current*
 * intent, not a standing order: without a bound, a player who tapped Rematch and
 * then their app died would still be dragged into a game hours later the moment
 * an opponent accepted. Explicit leaving retracts the offer at once (see
 * `withdrawRematch`); this is the backstop for the ungraceful exit that can't.
 * Generous, because two players actually looking at the game-over screen agree
 * within seconds — this only rules out the long-abandoned offer.
 */
export const REMATCH_OFFER_TTL_MS = 3 * 60 * 1000;

/**
 * Write a new game, its membership index and its turn-deadline index in a single
 * atomic multi-path update.
 *
 * Doing this as one write is what guarantees a game can never exist outside the
 * due-index. The sweep discovers overdue games *only* through `activeGames`, so a
 * game that landed without its index entry — three separate client writes, one of
 * which fails — would be invisible to it forever: never timed out, never
 * finished, stuck in `playing` for good.
 */
async function commitNewGame(
  db: Database,
  game: GameState,
  alsoWrite: Record<string, unknown> = {},
): Promise<void> {
  const members: Record<string, boolean> = {};
  const updates: Record<string, unknown> = {};
  for (const p of Object.values(game.players)) {
    members[p.uid] = true;
    // The per-player "you are in this live game" index. Written in the *same*
    // atomic update as the game itself, so a client can never be told it's in a
    // game that doesn't exist, nor miss one that does. The client's active-game
    // watcher reads this to route a player into a match made while they were
    // elsewhere — a cancelled search, a backgrounded app, a fresh cold start.
    // Cleared on the finish transition (see `lifecyclePaths`).
    updates[`userActiveGames/${p.uid}/${game.id}`] = true;
  }

  await db.ref().update({
    [`games/${game.id}`]: game,
    [`gameMembers/${game.id}`]: members,
    [`activeGames/${game.id}`]: game.turnStartedAt + game.turnDurationMs,
    ...updates,
    ...alsoWrite,
  });
}

const toPlayer = (uid: string, displayName: string, index: number): Player => ({
  id: `P${index + 1}`,
  uid,
  index: index as PlayerIndex,
  displayName,
  color: playerColors[index % playerColors.length]!,
  isEliminated: false,
  consecutiveMisses: 0,
  score: 0,
});

/** Host converts a ready room into a live game. */
export async function createGameFromRoom(
  db: Database,
  uid: string,
  roomId: string,
): Promise<CreateOutcome> {
  const room = (await db.ref(`rooms/${roomId}`).get()).val() as Room | null;
  if (!room) return { ok: false, reason: 'not_found' };
  if (room.hostUid !== uid) return { ok: false, reason: 'not_allowed' }; // host-only
  if (room.gameId) return { ok: false, reason: 'already_started' };

  const members = Object.values(room.members ?? {}).sort((a, b) => a.index - b.index);
  if (members.length < 2) return { ok: false, reason: 'not_enough_players' };

  const gameId = roomId; // 1:1 room→game mapping keeps navigation simple
  const game = GameManager.create({
    id: gameId,
    mode: room.mode,
    size: room.boardSize,
    players: members.map((m, i) => toPlayer(m.uid, m.displayName, i)),
  });

  await commitNewGame(db, game, {
    [`rooms/${roomId}/status`]: 'in_progress',
    [`rooms/${roomId}/gameId`]: gameId,
    [`rooms/${roomId}/updatedAt`]: Date.now(),
  });
  return { ok: true, gameId };
}

/**
 * Turn a won matchmaking claim into a game.
 *
 * The client still races to *claim* an opponent (a transaction on their ticket),
 * but it no longer invents the game id or writes the game. It stamps
 * `claimedBy`, then asks here; we verify the claim from the tickets themselves
 * and stamp both with an id we choose.
 */
export async function createGameFromMatch(
  db: Database,
  uid: string,
  opponentUid: string,
): Promise<CreateOutcome> {
  if (uid === opponentUid) return { ok: false, reason: 'not_allowed' };

  const [mineSnap, theirsSnap] = await Promise.all([
    db.ref(`matchmaking/queue/${uid}`).get(),
    db.ref(`matchmaking/queue/${opponentUid}`).get(),
  ]);
  const mine = mineSnap.val() as QueuedTicket | null;
  const theirs = theirsSnap.val() as QueuedTicket | null;

  if (!mine || !theirs) return { ok: false, reason: 'not_found' };
  // The claim must actually be ours — otherwise anyone could pull a stranger out
  // of the queue and start a game against them.
  if (theirs.claimedBy !== uid) return { ok: false, reason: 'not_allowed' };
  if (mine.gameId || theirs.gameId) return { ok: false, reason: 'already_started' };

  const gameId = `rnd_${uid}_${opponentUid}_${Date.now()}`;
  const game = GameManager.create({
    id: gameId,
    mode: 'random',
    size: mine.boardSize,
    players: [toPlayer(uid, mine.displayName, 0), toPlayer(opponentUid, theirs.displayName, 1)],
  });

  await commitNewGame(db, game, {
    [`matchmaking/queue/${uid}/gameId`]: gameId,
    [`matchmaking/queue/${opponentUid}/gameId`]: gameId,
  });
  return { ok: true, gameId };
}

/**
 * Rematch: same players, new game — but only once *everyone* has agreed.
 *
 * A rematch is an offer, not a command. This used to create the live game on the
 * first request, which meant the player who *declined* — who tapped "Back to
 * Home" — was nonetheless a member of a new game whose clock was already running.
 * They never saw it, missed three turns, and were eliminated: a real, recorded
 * defeat in a match they never agreed to play. So each request records an offer,
 * and the game is only built when no player is still missing.
 *
 * Recording the offer and — if it completes a fully-present roster — claiming the
 * rematch happen in ONE transaction on the finished game. That atomicity is the
 * whole point: a withdrawal (`withdrawRematch`) is a delete on this same node, so
 * it serialises against this transaction. A retraction that has reached the
 * server is therefore *always* seen here, and a player who has left can never be
 * swept into the new game by an opponent accepting a moment later. The earlier
 * read-then-write left a gap — read the offers, then separately stamp the game —
 * in which exactly that retraction was lost.
 *
 * The players are all still subscribed to the finished game, so it doubles as the
 * channel: offers land on it, and `rematchGameId` appears on it when the last
 * player opts in. Whoever moved first last time does not move first again.
 */
export async function createRematch(
  db: Database,
  uid: string,
  fromGameId: string,
): Promise<CreateOutcome> {
  const prev = normalizeGame((await db.ref(`games/${fromGameId}`).get()).val() as GameState | null);
  if (!prev) return { ok: false, reason: 'not_found' };
  if (prev.phase !== 'finished') return { ok: false, reason: 'not_allowed' };
  if (!Object.values(prev.players).some((p) => p.uid === uid)) {
    return { ok: false, reason: 'not_allowed' }; // only the players who played it
  }
  const roster = prev.turnOrder.map((id) => prev.players[id]!);
  const newGameId = `rm_${fromGameId}`;

  // Build the rematch game deterministically from the finished one: same players,
  // running order rotated so the same player doesn't always open. The id is
  // passed in rather than assumed, so the healing path below always builds the
  // exact game its pointer names — never a differently-named one it then points
  // nowhere.
  const buildRematchGame = (id: string): GameState => {
    const rotated = [...roster.slice(1), roster[0]!];
    return GameManager.create({
      id,
      mode: prev!.mode,
      size: prev!.board.size,
      players: rotated.map((p, i) => toPlayer(p.uid, p.displayName, i)),
    });
  };

  if (prev.rematchGameId) {
    // Already claimed. Normally the game exists and we just join it. But the claim
    // (a transaction on the finished game) and the game creation (a write to a
    // *different* node) are not one atomic step — if the create failed after the
    // stamp landed, the pointer is dangling. Verify, and heal by building the game
    // the pointer *actually names* rather than sending everyone to a game that was
    // never built. Idempotent: the id is fixed, so a concurrent healer converges.
    const exists = (await db.ref(`games/${prev.rematchGameId}`).get()).exists();
    if (!exists) await commitNewGame(db, buildRematchGame(prev.rematchGameId));
    return { ok: true, gameId: prev.rematchGameId };
  }

  // As in `casVersion`, the Admin SDK first calls the update fn with the local
  // cache — `null` unless something keeps it warm — so hold a live listener
  // across the transaction to sync the current value in first.
  const ref = db.ref(`games/${fromGameId}`);
  const listener = ref.on('value', () => {});
  let iClaimed = false;
  let stampedId: string | null = null;
  try {
    await ref.once('value');
    const res = await ref.transaction((current: GameState | null) => {
      if (!current || current.phase !== 'finished') return current; // nothing to do
      iClaimed = false; // reset per attempt; the last (committed) attempt is what counts
      const now = Date.now();
      // Always (re)stamp the offer time so a player whose previous offer lapsed
      // can renew it by tapping again.
      const offers: Record<string, number> = { ...(current.rematchOffers ?? {}), [uid]: now };
      const next: GameState = { ...current, rematchOffers: offers };
      if (!current.rematchGameId) {
        // Everyone must have a *fresh* offer. A stale one — from a player who
        // tapped Rematch long ago and wandered off — does not count.
        const allFresh = roster.every((p) => {
          const at = offers[p.uid];
          return at !== undefined && now - at < REMATCH_OFFER_TTL_MS;
        });
        if (allFresh) {
          next.rematchGameId = newGameId;
          iClaimed = true;
        }
      }
      return next;
    });
    if (res.committed) {
      stampedId = ((res.snapshot.val() as GameState | null)?.rematchGameId as string) ?? null;
    }
  } finally {
    ref.off('value', listener);
  }

  // Nobody's completed the set yet (or a withdrawal beat us to it): the offer is
  // recorded, start nothing.
  if (!stampedId) return { ok: true, gameId: null, pending: true };

  // The invocation whose transaction actually set the stamp builds the game; a
  // co-winner in a dead heat just returns the same deterministic `rm_` id, so
  // they converge on one game rather than forking two.
  if (iClaimed) {
    await commitNewGame(db, buildRematchGame(newGameId));
  }
  return { ok: true, gameId: stampedId };
}

/**
 * Retract a rematch offer.
 *
 * Fired when a player leaves the game-over screen: leaving *is* declining, and
 * their offer must go at once so an opponent who accepts a moment later cannot
 * pull them into a game they just walked away from. The freshness TTL bounds the
 * same risk for an app that dies without a chance to call this; here we clear it
 * immediately.
 *
 * It removes only this player's own key (`rematchOffers/{uid}`, and uid comes
 * from the caller's token), so it cannot disturb anyone else's offer and needs
 * no transaction on the parent. Removing an absent offer is a harmless no-op.
 */
export async function withdrawRematch(
  db: Database,
  uid: string,
  fromGameId: string,
): Promise<void> {
  await db.ref(`games/${fromGameId}/rematchOffers/${uid}`).remove();
}
