import type { Database, Reference } from 'firebase-admin/database';

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
  for (const p of Object.values(game.players)) members[p.uid] = true;

  await db.ref().update({
    [`games/${game.id}`]: game,
    [`gameMembers/${game.id}`]: members,
    [`activeGames/${game.id}`]: game.turnStartedAt + game.turnDurationMs,
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
 * Record one player's rematch offer and report the resulting set.
 *
 * This has to be a transaction, not a read-then-write. Two players tapping
 * Rematch at the same moment would each read the offers as empty, each record
 * only their own, and *neither* would see a complete roster — so no game is ever
 * built and both sit on a disabled "Waiting for opponent…" with no way to retry.
 * Serialising the read-modify-write means whoever commits last sees every offer.
 *
 * As in `casVersion`, the Admin SDK first calls the update fn with the local
 * cache — `null` unless something keeps it warm — so a live listener is held
 * across the transaction to sync the current value in first.
 */
async function recordOffer(ref: Reference, uid: string): Promise<Record<string, number>> {
  const listener = ref.on('value', () => {});
  try {
    await ref.once('value');
    // Always (re)stamp with the current time rather than skipping an existing
    // entry: an offer has a freshness window, so a player whose previous offer
    // lapsed must be able to renew it by tapping again.
    const res = await ref.transaction((current: Record<string, number> | null) => ({
      ...(current ?? {}),
      [uid]: Date.now(),
    }));
    // Committed or aborted, the snapshot carries the authoritative set — and that
    // is what the caller needs to decide whether everyone has agreed.
    return (res.snapshot.val() as Record<string, number> | null) ?? {};
  } finally {
    ref.off('value', listener);
  }
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
  if (prev.rematchGameId) return { ok: true, gameId: prev.rematchGameId }; // idempotent: join the existing one

  const offers = await recordOffer(db.ref(`games/${fromGameId}/rematchOffers`), uid);
  const roster = prev.turnOrder.map((id) => prev.players[id]!);

  // Everyone must have a *fresh* offer. A stale one — from a player who tapped
  // Rematch long ago and wandered off — does not count, so accepting now cannot
  // drag them into a game they've forgotten about.
  const now = Date.now();
  const hasFreshOffer = (playerUid: string) => {
    const at = offers[playerUid];
    return at !== undefined && now - at < REMATCH_OFFER_TTL_MS;
  };
  if (roster.some((p) => !hasFreshOffer(p.uid))) {
    // Somebody has not agreed yet (or their agreement has lapsed). The offer is
    // recorded; start nothing.
    return { ok: true, gameId: null, pending: true };
  }

  // Everyone has agreed. Re-check the stamp: another player may have completed
  // the rematch while we were recording our own offer, and building the game
  // again would reset a board that is already being played on.
  const stamped = (await db.ref(`games/${fromGameId}/rematchGameId`).get()).val() as string | null;
  if (stamped) return { ok: true, gameId: stamped };

  // Rotate the running order so the same player doesn't always open.
  const rotated = [...roster.slice(1), roster[0]!];

  // Derived from the finished game rather than from the clock. Two invocations
  // that get this far together — the last two players tapping at the same
  // instant — then converge on one game instead of creating two, and because
  // `commitNewGame` writes the game and the stamp in a single atomic update,
  // the loser's write is identical to the winner's rather than a rival game.
  const gameId = `rm_${fromGameId}`;
  const game = GameManager.create({
    id: gameId,
    mode: prev.mode,
    size: prev.board.size,
    players: rotated.map((p, i) => toPlayer(p.uid, p.displayName, i)),
  });

  await commitNewGame(db, game, {
    [`games/${fromGameId}/rematchGameId`]: gameId,
  });
  return { ok: true, gameId };
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
