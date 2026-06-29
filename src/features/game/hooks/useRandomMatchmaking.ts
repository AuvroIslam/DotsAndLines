import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Routes } from '@/navigation/routes';
import { matchmakingRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { BoardSize, MatchmakingTicket } from '@/types';
import { createLogger } from '@/utils';

const MATCH_POLL_MS = 2_000;
const log = createLogger('MM');

/**
 * Random 1v1 matchmaking. Enqueues a ticket, periodically attempts to pair with
 * a waiting opponent, and simultaneously watches its own ticket so that *either*
 * the pairer or the paired player navigates into the created game exactly once.
 */
export function useRandomMatchmaking() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [searching, setSearching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ticketUnsub = useRef<(() => void) | null>(null);
  const navigated = useRef(false);

  const teardown = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    ticketUnsub.current?.();
    ticketUnsub.current = null;
  }, []);

  const goToGame = useCallback(
    (gameId: string, uid: string) => {
      if (navigated.current) return;
      navigated.current = true;
      log('navigating to game', { gameId, uid });
      teardown();
      setSearching(false);
      void matchmakingRepository.dequeue(uid);
      router.replace(Routes.game(gameId));
    },
    [router, teardown],
  );

  const start = useCallback(
    async (boardSize: BoardSize) => {
      if (!profile) {
        log.warn('start() ignored — no profile (are you signed in?)');
        return;
      }
      if (searching) {
        log.warn('start() ignored — already searching');
        return;
      }
      navigated.current = false;
      setSearching(true);
      log('START searching', { uid: profile.uid, boardSize });

      const ticket: MatchmakingTicket = {
        uid: profile.uid,
        displayName: profile.displayName,
        enqueuedAt: Date.now(),
        boardSize,
      };
      await matchmakingRepository.enqueue(ticket);

      ticketUnsub.current = matchmakingRepository.subscribeTicket(profile.uid, (t) => {
        if (t?.gameId) goToGame(t.gameId, profile.uid);
      });

      // Run one immediate attempt, then poll.
      void matchmakingRepository
        .tryMatch(ticket)
        .then((gameId) => gameId && goToGame(gameId, profile.uid));
      pollRef.current = setInterval(async () => {
        log('poll tick', { uid: profile.uid });
        const gameId = await matchmakingRepository.tryMatch(ticket);
        if (gameId) goToGame(gameId, profile.uid);
      }, MATCH_POLL_MS);
    },
    [profile, searching, goToGame],
  );

  const cancel = useCallback(() => {
    log('CANCEL searching', { uid: profile?.uid });
    teardown();
    setSearching(false);
    if (profile) void matchmakingRepository.dequeue(profile.uid);
  }, [profile, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { searching, start, cancel };
}
