import { useEffect, useState } from 'react';

import { invitationRepository, roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { GameInvite } from '@/types';

import { isInviteStale } from './inviteStale';

/**
 * My incoming game invitations, for the notification bell. Subscribes to
 * `gameInvites/{me}` and, when they change, self-heals: an invite whose room is
 * gone or already started is silently dropped (a client-side backstop to the
 * room sweep, which also clears them). Newest first.
 */
export function useGameInvites(): { invites: GameInvite[]; count: number } {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [invites, setInvites] = useState<GameInvite[]>([]);

  useEffect(() => {
    if (!uid) {
      setInvites([]);
      return;
    }
    return invitationRepository.subscribe(uid, (incoming) => {
      void (async () => {
        const live: GameInvite[] = [];
        await Promise.all(
          incoming.map(async (inv) => {
            if (isInviteStale(await roomRepository.getRoom(inv.roomId))) {
              void invitationRepository.remove(uid, inv.roomId);
            } else {
              live.push(inv);
            }
          }),
        );
        setInvites(live.sort((a, b) => b.createdAt - a.createdAt));
      })();
    });
  }, [uid]);

  return { invites, count: invites.length };
}
