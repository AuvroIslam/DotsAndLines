import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { Routes } from '@/navigation/routes';
import { gameRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { createLogger } from '@/utils';

import { decideActiveGame } from './activeGameDecision';

const log = createLogger('WATCH');

/** Extract the game id from the current route, or null if we're not on one. */
function gameIdOfPath(pathname: string): string | null {
  return pathname.startsWith('/game/') ? pathname.slice('/game/'.length) : null;
}

/**
 * Mounted once for the whole authenticated app. Watches the server-maintained
 * index of games this player is in, and makes sure they can never be stuck
 * *outside* a game the server has them in — a match made the instant they
 * cancelled a search, an app killed mid-creation, a session resumed into a game
 * still running. The index is written atomically with each game, so it never
 * points at a game that doesn't exist.
 */
export function useActiveGameWatcher(): void {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const router = useRouter();
  const pathname = usePathname();

  // Read the latest route inside the subscription without re-subscribing on nav.
  const currentGameId = useRef<string | null>(null);
  currentGameId.current = gameIdOfPath(pathname);

  const previous = useRef<string[] | null>(null); // null until the first snapshot
  const prompted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) {
      previous.current = null;
      return;
    }
    return gameRepository.subscribeActiveGames(uid, (ids) => {
      const decision = decideActiveGame({
        isFirstSnapshot: previous.current === null,
        previous: previous.current ?? [],
        current: ids,
        currentGameId: currentGameId.current,
        alreadyPrompted: prompted.current,
      });
      previous.current = ids;

      if (decision.type === 'navigate') {
        log('a match formed — opening it', { gameId: decision.gameId });
        router.replace(Routes.game(decision.gameId));
      } else if (decision.type === 'prompt') {
        for (const gameId of decision.gameIds) {
          prompted.current.add(gameId);
          Alert.alert('Game in progress', 'You have a match still going. Rejoin it?', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Rejoin', onPress: () => router.replace(Routes.game(gameId)) },
          ]);
        }
      }
    });
  }, [uid, router]);
}
