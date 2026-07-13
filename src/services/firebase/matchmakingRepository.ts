import { get, onValue, ref, remove, runTransaction, set } from 'firebase/database';

import type { BoardSize, MatchmakingTicket } from '@/types';
import { createLogger } from '@/utils';

import { realtimeDb } from './config';
import { gameFunctions } from './gameFunctions';
import { RtdbPaths } from './paths';

const log = createLogger('MM');

// Tickets older than this are treated as abandoned (app closed/backgrounded
// mid-search without cleanup) and excluded from opponent selection so they
// can't permanently block real players from pairing.
const MAX_TICKET_AGE_MS = 60_000;

type QueuedTicket = MatchmakingTicket & { gameId?: string; claimedBy?: string };

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

    const now = Date.now();
    const opponent = tickets
      .filter(
        (t) =>
          t.uid !== me.uid &&
          !t.gameId &&
          t.boardSize === me.boardSize &&
          now - t.enqueuedAt < MAX_TICKET_AGE_MS,
      )
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
    // We only stake a claim — we no longer invent the game id or build the game,
    // because a client that authors the game also chooses its turn clock and
    // starting player, which is a forced win. The server reads this claim back
    // and creates the game itself.
    const oppRef = ref(realtimeDb, RtdbPaths.queueTicket(opponent.uid));
    let committed = false;
    try {
      const claim = await runTransaction(oppRef, (t: QueuedTicket | null) => {
        // RTDB calls this first with the *locally cached* value, which is null
        // for a node we haven't synced. Returning undefined here would abort
        // without ever fetching server data, so seed the write from the snapshot
        // we already read — RTDB then re-runs with authoritative server data.
        if (t === null) return { ...opponent, claimedBy: me.uid };
        if (t.claimedBy || t.gameId) return; // already claimed by someone else -> abort
        return { ...t, claimedBy: me.uid };
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

    // The server verifies the claim from the tickets themselves, builds the game,
    // and stamps the id onto both tickets — so both of us resolve to it.
    const res = await gameFunctions.startFromMatch(opponent.uid);
    if (!res.ok) {
      log.error('server refused to create the match', { code: res.code });
      return null;
    }

    log('MATCH MADE 🎉', { gameId: res.data.gameId, p1: me.uid, p2: opponent.uid });
    return res.data.gameId;
  },
};


function describe(e: unknown): { code?: string; message: string } {
  const err = e as { code?: string; message?: string };
  return { code: err?.code, message: err?.message ?? String(e) };
}

export type { BoardSize };
