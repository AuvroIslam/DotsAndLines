import { useEffect, useRef } from 'react';

import { matchHistoryRepository } from '@/services/firebase';
import { queryClient, queryKeys } from '@/services/queryClient';
import type { GameState, MatchOutcome } from '@/types';
import { randomId } from '@/utils';

function outcomeFor(game: GameState, myPlayerId: string): MatchOutcome {
  const result = game.result!;
  if (result.isDraw && result.winners.includes(myPlayerId)) return 'draw';
  return result.winners.includes(myPlayerId) ? 'win' : 'loss';
}

/**
 * When a game reaches `finished`, persists exactly one match-history entry and
 * statistics update for the local player. Idempotent via a per-game guard so a
 * re-render or late snapshot can't double-count.
 */
export function useMatchRecorder(
  game: GameState | null,
  uid: string | null,
  myPlayerId: string | null,
) {
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (!game || !uid || !myPlayerId || game.phase !== 'finished' || !game.result) return;
    if (recorded.current === game.id) return;
    recorded.current = game.id;

    const me = game.players[myPlayerId];
    if (!me) return;
    const outcome = outcomeFor(game, myPlayerId);
    const opponents = game.turnOrder
      .filter((id) => id !== myPlayerId)
      .map((id) => {
        const p = game.players[id]!;
        return { uid: p.uid, displayName: p.displayName, score: p.score };
      });

    void (async () => {
      await matchHistoryRepository.addEntry(uid, {
        id: randomId('mh'),
        gameId: game.id,
        mode: game.mode,
        boardSize: game.board.size,
        playerCount: game.turnOrder.length,
        outcome,
        myScore: me.score,
        opponents,
        playedAt: Date.now(),
      });
      await matchHistoryRepository.applyResult(uid, { outcome, boxesWon: me.score });
      queryClient.invalidateQueries({ queryKey: queryKeys.matchHistory(uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics(uid) });
    })();
  }, [game, uid, myPlayerId]);
}
