import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Routes } from '@/navigation/routes';
import { matchmakingRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { BoardSize, MatchmakingTicket } from '@/types';
import { createLogger, DEFAULT_BOARD } from '@/utils';

/**
 * What to search for. Quick Match is `{ flexible: true }` — any board, the server
 * picks it. A specific board is `{ boardSize }` (flexible defaults false).
 */
export interface MatchPrefs {
  boardSize?: BoardSize;
  flexible?: boolean;
}

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
  const profileRef = useRef(profile);
  profileRef.current = profile;

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
    async (prefs: MatchPrefs = {}) => {
      if (!profile || profile.provider !== 'google') {
        log.warn('start() ignored — requires Google sign-in');
        return;
      }
      if (searching) {
        log.warn('start() ignored — already searching');
        return;
      }
      const flexible = !!prefs.flexible;
      // A flexible ticket still carries a boardSize, but it's only a fallback for
      // the both-flexible case; the server never trusts it otherwise.
      const boardSize = prefs.boardSize ?? DEFAULT_BOARD;
      navigated.current = false;
      setSearching(true);
      log('START searching', { uid: profile.uid, boardSize, flexible });

      const ticket: MatchmakingTicket = {
        uid: profile.uid,
        displayName: profile.displayName,
        enqueuedAt: Date.now(),
        boardSize,
        flexible,
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
    // Stop polling at once so we can't make a *new* match while cancelling, but
    // keep watching our ticket until the outcome is settled.
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;

    if (!profile || profile.provider !== 'google') {
      teardown();
      setSearching(false);
      return;
    }

    void (async () => {
      // Cancel only if unmatched. If pairing beat us to it, the game already
      // exists with us in it — honor the match and go play it rather than strand
      // ourselves out of a game the server thinks we're in.
      const gameId = await matchmakingRepository.cancelSearch(profile.uid);
      if (gameId) {
        log('cancel raced a real match — joining it', { uid: profile.uid, gameId });
        goToGame(gameId, profile.uid);
      } else {
        teardown();
        setSearching(false);
      }
    })();
  }, [profile, teardown, goToGame]);

  useEffect(
    () => () => {
      teardown();
      // Unmounting mid-search (navigating away, dev reload, etc.) must not
      // leave an orphaned ticket in the queue — it would otherwise block all
      // future matchmaking, since other clients defer to the oldest ticket.
      const isGoogleUser = profileRef.current?.provider === 'google';
      const uid = profileRef.current?.uid;
      if (isGoogleUser && uid) void matchmakingRepository.dequeue(uid);
    },
    [teardown],
  );

  return { searching, start, cancel };
}
