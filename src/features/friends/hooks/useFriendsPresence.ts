import { useEffect, useState } from 'react';

import { presenceRepository } from '@/services/firebase';

/**
 * Live online/offline map for a set of friend uids, read from RTDB presence
 * (`presence/{uid}`) — the single source of truth for who's online. This is why
 * the friendship edge no longer stores a stale `isOnline` copy.
 */
export function useFriendsPresence(uids: string[]): Record<string, boolean> {
  const [online, setOnline] = useState<Record<string, boolean>>({});
  // A stable dependency: the effect re-subscribes only when the *set* changes,
  // not on every render (a fresh array each render would otherwise thrash it).
  const key = uids.slice().sort().join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    // Drop uids no longer in the set, so a stale `online` flag can't linger (and
    // wrongly show a re-added friend as online) or grow the map without bound.
    setOnline((prev) => {
      const next: Record<string, boolean> = {};
      for (const uid of list) if (uid in prev) next[uid] = prev[uid]!;
      return next;
    });
    if (list.length === 0) return;
    const unsubs = list.map((uid) =>
      presenceRepository.subscribe(uid, (state) =>
        setOnline((prev) => ({ ...prev, [uid]: !!state?.isOnline })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return online;
}
