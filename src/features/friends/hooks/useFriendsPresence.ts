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
    if (list.length === 0) {
      setOnline({});
      return;
    }
    const unsubs = list.map((uid) =>
      presenceRepository.subscribe(uid, (state) =>
        setOnline((prev) => ({ ...prev, [uid]: !!state?.isOnline })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return online;
}
