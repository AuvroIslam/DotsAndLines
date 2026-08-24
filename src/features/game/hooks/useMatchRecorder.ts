import { useEffect, useRef } from 'react';

import { queryClient, queryKeys } from '@/services/queryClient';
import type { GameState } from '@/types';

/**
 * Refreshes the local view of history and statistics when a game ends.
 *
 * It used to *write* them. That made the leaderboard free money: with
 * `statistics/{uid}` owner-writable, anyone could award themselves any record
 * they liked without playing a game at all. The Cloud Function that finalizes the
 * match now records the outcome for every player, so all that's left here is to
 * invalidate the caches that read it.
 *
 * The server may take a moment to settle the write, so refetch shortly after the
 * game ends rather than the instant it does.
 */
export function useMatchRecorder(game: GameState | null, uid: string | null) {
  const refreshed = useRef<string | null>(null);

  useEffect(() => {
    if (!game || !uid || game.phase !== 'finished' || !game.result) return;
    if (refreshed.current === game.id) return;
    refreshed.current = game.id;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matchHistory(uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics(uid) });
    };

    invalidate();
    // Once more after the server has had time to write the record.
    const id = setTimeout(invalidate, 2_000);
    return () => clearTimeout(id);
  }, [game, uid]);
}
