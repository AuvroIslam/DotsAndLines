import { useEffect } from 'react';

import { gameRepository } from '@/services/firebase';
import type { PlayerId } from '@/types';
import { PRESENCE_HEARTBEAT_MS } from '@/utils/constants';

/**
 * Marks this client's player as connected to `gameId` for as long as the
 * screen stays mounted, combining two signals so peers can detect a departure
 * either way: RTDB's `onDisconnect` fires promptly on a graceful close (app
 * kill), while a periodic heartbeat catches a silent network loss that
 * `onDisconnect` alone can take a long time (sometimes minutes) to notice,
 * since it depends on the server's own connection-timeout rather than an
 * immediate signal.
 */
export function useTrackPlayerConnection(gameId: string, myPlayerId: PlayerId | null): void {
  useEffect(() => {
    if (!myPlayerId) return;
    const teardown = gameRepository.trackConnection(gameId, myPlayerId);
    const heartbeat = setInterval(() => {
      void gameRepository.heartbeat(gameId, myPlayerId);
    }, PRESENCE_HEARTBEAT_MS);
    return () => {
      clearInterval(heartbeat);
      teardown();
    };
  }, [gameId, myPlayerId]);
}
