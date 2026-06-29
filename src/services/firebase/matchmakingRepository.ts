import { get, onValue, ref, remove, runTransaction, set } from 'firebase/database';

import { GameManager } from '@/gameEngine';
import { playerColors } from '@/theme';
import type { BoardSize, MatchmakingTicket, Player } from '@/types';
import { createLogger } from '@/utils';

import { realtimeDb } from './config';
import { gameRepository } from './gameRepository';
import { RtdbPaths } from './paths';

const log = createLogger('MM');

type QueuedTicket = MatchmakingTicket & { gameId?: string };

/**
 * Random matchmaking (2 players only). A player enqueues a ticket, then a
 * transaction tries to pair them with the oldest waiting opponent. The first
 * client to win the transaction creates the game and stamps both tickets with
 * its id; the loser observes the assignment and follows.
 */
export const matchmakingRepository = {
  async enqueue(ticket: MatchmakingTicket): Promise<void> {
    try {
      await set(ref(realtimeDb, RtdbPaths.queueTicket(ticket.uid)), ticket);
      log('enqueued ticket', { uid: ticket.uid, boardSize: ticket.boardSize });
    } catch (e) {
      log.error('enqueue FAILED (check RTDB rules are deployed)', describe(e));
      throw e;
    }
  },

  async dequeue(uid: string): Promise<void> {
    try {
      await remove(ref(realtimeDb, RtdbPaths.queueTicket(uid)));
      log('dequeued ticket', { uid });
    } catch (e) {
      log.error('dequeue failed', describe(e));
    }
  },

  /** Watch my own ticket; once `gameId` appears, the match is ready. */
  subscribeTicket(uid: string, cb: (ticket: QueuedTicket | null) => void): () => void {
    log('subscribing to own ticket', { uid });
    return onValue(
      ref(realtimeDb, RtdbPaths.queueTicket(uid)),
      (snap) => {
        const ticket = snap.val() as QueuedTicket | null;
        log('own ticket update', { uid, gameId: ticket?.gameId ?? null, exists: snap.exists() });
        cb(ticket);
      },
      (e) => log.error('ticket subscription error', describe(e)),
    );
  },

  /**
   * Attempt to pair `me` with a waiting opponent of the same board size.
   * Returns the gameId if a match was made by this call, else null (still waiting).
   */
  async tryMatch(me: MatchmakingTicket): Promise<string | null> {
    let queue: Record<string, QueuedTicket>;
    try {
      const queueSnap = await get(ref(realtimeDb, RtdbPaths.queue));
      queue = (queueSnap.val() as Record<string, QueuedTicket>) ?? {};
    } catch (e) {
      log.error('reading queue FAILED (check RTDB rules are deployed)', describe(e));
      return null;
    }

    const tickets = Object.values(queue);
    log('poll: queue snapshot', {
      me: me.uid,
      size: tickets.length,
      tickets: tickets.map((t) => ({ uid: t.uid, board: t.boardSize, gameId: t.gameId ?? null })),
    });

    const opponent = tickets
      .filter((t) => t.uid !== me.uid && !t.gameId && t.boardSize === me.boardSize)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];

    if (!opponent) {
      log('poll: no eligible opponent yet', { me: me.uid, boardSize: me.boardSize });
      return null;
    }

    // Break symmetry: if both players claim each other at once, two games get
    // created and they split apart. Only the lower uid initiates; the other
    // simply waits for its own ticket to be stamped via subscribeTicket.
    if (me.uid > opponent.uid) {
      log('poll: deferring to opponent (lower uid initiates)', {
        me: me.uid,
        opponent: opponent.uid,
      });
      return null;
    }

    log('poll: opponent found — attempting claim', { me: me.uid, opponent: opponent.uid });

    // Claim the opponent's ticket atomically so no third player can grab them.
    const oppRef = ref(realtimeDb, RtdbPaths.queueTicket(opponent.uid));
    const gameId = `rnd_${me.uid}_${opponent.uid}_${Date.now()}`;
    let committed = false;
    try {
      const claim = await runTransaction(oppRef, (t: QueuedTicket | null) => {
        // RTDB calls this first with the *locally cached* value, which is null
        // for a node we haven't synced. Returning undefined here would abort
        // without ever fetching server data, so seed the write from the snapshot
        // we already read — RTDB then re-runs with authoritative server data.
        if (t === null) return { ...opponent, gameId };
        if (t.gameId) return; // already claimed by someone else -> abort
        return { ...t, gameId };
      });
      committed = claim.committed;
    } catch (e) {
      log.error('claim transaction FAILED (check RTDB rules)', describe(e));
      return null;
    }

    if (!committed) {
      log('poll: claim lost (opponent taken by someone else) — will retry', { me: me.uid });
      return null;
    }

    const players: Player[] = [buildPlayer(me, 0), buildPlayer(opponent, 1)];
    const game = GameManager.create({ id: gameId, mode: 'random', size: me.boardSize, players });
    try {
      await gameRepository.createGame(game);
      // Stamp my own ticket so my subscription resolves to the same game.
      await set(ref(realtimeDb, RtdbPaths.queueTicket(me.uid)), { ...me, gameId });
    } catch (e) {
      log.error('creating game / stamping ticket FAILED', describe(e));
      return null;
    }

    log('MATCH MADE 🎉', { gameId, p1: me.uid, p2: opponent.uid });
    return gameId;
  },
};

function buildPlayer(ticket: MatchmakingTicket, index: 0 | 1): Player {
  return {
    id: `P${index + 1}`,
    uid: ticket.uid,
    index,
    displayName: ticket.displayName,
    color: playerColors[index]!,
    isConnected: true,
    score: 0,
  };
}

function describe(e: unknown): { code?: string; message: string } {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? String(e) };
}

export type { BoardSize };
