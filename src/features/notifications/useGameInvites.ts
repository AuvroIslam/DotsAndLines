import { useEffect, useState } from 'react';

import { invitationRepository, roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { GameInvite, Room } from '@/types';

import { isInviteStale } from './inviteStale';

/**
 * My incoming game invitations, for the notification bell. Subscribes to
 * `gameInvites/{me}` and, when they change, self-heals: an invite whose room is
 * gone or already started is silently dropped (a client-side backstop to the
 * room sweep, which also clears them). Newest first.
 *
 * The self-heal is defensive: a room read that fails keeps the invite rather than
 * dropping it or leaking a rejection; a room already confirmed live isn't read
 * again; and a slow snapshot that resolves after a newer one (or after teardown)
 * never overwrites the current list.
 */
export function useGameInvites(): { invites: GameInvite[]; count: number } {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [invites, setInvites] = useState<GameInvite[]>([]);

  useEffect(() => {
    if (!uid) {
      setInvites([]);
      return;
    }
    let cancelled = false;
    let latest = 0;
    // Rooms already confirmed live this subscription — no need to re-read them on
    // every change (the sweep clears an invite whose room later dies, which lands
    // here as a fresh snapshot).
    const validated = new Set<string>();

    const unsub = invitationRepository.subscribe(uid, (incoming) => {
      const seq = (latest += 1);
      // Forget rooms no longer invited, so a re-invite gets re-checked.
      const present = new Set(incoming.map((inv) => inv.roomId));
      for (const id of validated) if (!present.has(id)) validated.delete(id);

      void (async () => {
        const live: GameInvite[] = [];
        await Promise.all(
          incoming.map(async (inv) => {
            if (validated.has(inv.roomId)) {
              live.push(inv);
              return;
            }
            let room: Room | null = null;
            try {
              room = await roomRepository.getRoom(inv.roomId);
            } catch {
              live.push(inv); // transient read error: keep it, retry on the next change
              return;
            }
            if (isInviteStale(room)) {
              void invitationRepository.remove(uid, inv.roomId);
            } else {
              validated.add(inv.roomId);
              live.push(inv);
            }
          }),
        );
        // Drop a stale/late snapshot: only the newest resolution, pre-teardown, wins.
        if (!cancelled && seq === latest) {
          setInvites(live.sort((a, b) => b.createdAt - a.createdAt));
        }
      })();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid]);

  return { invites, count: invites.length };
}
