import { useEffect, useRef } from 'react';

import { presenceRepository } from '@/services/firebase';
import { useAuthStore, useSettingsStore } from '@/store';

/**
 * App-level side effects wired once at the root: auth subscription, presence
 * tracking, and settings hydration. Keeps screens free of lifecycle plumbing.
 */
export function useAppBootstrap(): { ready: boolean } {
  const status = useAuthStore((s) => s.status);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const initialize = useAuthStore((s) => s.initialize);
  const loadSettings = useSettingsStore((s) => s.load);
  const presenceTeardown = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);

  useEffect(() => {
    presenceTeardown.current?.();
    if (!uid) {
      presenceTeardown.current = null;
      return;
    }
    presenceTeardown.current = presenceRepository.track(uid);
    void loadSettings(uid);
    return () => {
      presenceTeardown.current?.();
      presenceTeardown.current = null;
    };
  }, [uid, loadSettings]);

  return { ready: status !== 'initializing' };
}
