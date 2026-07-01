import { GameManager } from '@/gameEngine';
import { playerColors } from '@/theme';
import type { MatchmakingTicket, Player } from '@/types';

import { gameRepository } from './gameRepository';
import { LocalCollection } from './store';

type QueuedTicket = MatchmakingTicket & { gameId?: string };

const queue = new LocalCollection<QueuedTicket>();

/**
 * In-memory replica of `services/firebase/matchmakingRepository` — same
 * method signatures, no network. There's only ever one caller per tick in a
 * single process, so the concurrent-client symmetry-break the Firebase
 * version needs (only the lower uid initiates a claim) doesn't apply here.
 */
export const matchmakingRepository = {
  async enqueue(ticket: MatchmakingTicket): Promise<void> {
    queue.set(ticket.uid, ticket);
  },

  async dequeue(uid: string): Promise<void> {
    queue.delete(uid);
  },

  /** Watch my own ticket; once `gameId` appears, the match is ready. */
  subscribeTicket(uid: string, cb: (ticket: QueuedTicket | null) => void): () => void {
    return queue.subscribe(uid, cb);
  },

  /**
   * Attempt to pair `me` with a waiting opponent of the same board size.
   * Returns the gameId if a match was made by this call, else null (still waiting).
   */
  async tryMatch(me: MatchmakingTicket): Promise<string | null> {
    const opponent = queue
      .values()
      .filter((t) => t.uid !== me.uid && !t.gameId && t.boardSize === me.boardSize)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt)[0];

    if (!opponent) return null;

    const gameId = `rnd_${me.uid}_${opponent.uid}_${Date.now()}`;
    const claim = queue.transaction(opponent.uid, (t) => {
      if (!t || t.gameId) return undefined; // already claimed
      return { ...t, gameId };
    });
    if (!claim.committed) return null;

    const players: Player[] = [buildPlayer(me, 0), buildPlayer(opponent, 1)];
    const game = GameManager.create({ id: gameId, mode: 'random', size: me.boardSize, players });
    await gameRepository.createGame(game);
    queue.set(me.uid, { ...me, gameId });

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
