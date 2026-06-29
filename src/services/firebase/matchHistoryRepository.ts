import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

import type { MatchHistoryEntry, MatchOutcome, UserStatistics } from '@/types';

import { firestore } from './config';
import { Collections } from './paths';

/** Repository for durable match history and aggregate statistics in Firestore. */
export const matchHistoryRepository = {
  async addEntry(uid: string, entry: MatchHistoryEntry): Promise<void> {
    await setDoc(doc(firestore, Collections.users, uid, Collections.matchHistory, entry.id), entry);
  },

  async getHistory(uid: string, max = 50): Promise<MatchHistoryEntry[]> {
    const q = query(
      collection(firestore, Collections.users, uid, Collections.matchHistory),
      orderBy('playedAt', 'desc'),
      fbLimit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MatchHistoryEntry);
  },

  /**
   * Apply the result of a finished game to the user's aggregate statistics in a
   * transaction so streak math (which depends on the prior value) stays correct
   * even if two games for the same user resolve close together.
   */
  async applyResult(
    uid: string,
    params: { outcome: MatchOutcome; boxesWon: number },
  ): Promise<void> {
    const ref = doc(firestore, Collections.statistics, uid);
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = (snap.data() as UserStatistics | undefined) ?? {
        uid,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalBoxesWon: 0,
        winStreak: 0,
        bestWinStreak: 0,
      };
      const winStreak = params.outcome === 'win' ? prev.winStreak + 1 : 0;
      const next: UserStatistics = {
        uid,
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + (params.outcome === 'win' ? 1 : 0),
        losses: prev.losses + (params.outcome === 'loss' ? 1 : 0),
        draws: prev.draws + (params.outcome === 'draw' ? 1 : 0),
        totalBoxesWon: prev.totalBoxesWon + params.boxesWon,
        winStreak,
        bestWinStreak: Math.max(prev.bestWinStreak, winStreak),
      };
      tx.set(ref, next);
    });
  },
};
