import { useEffect, useRef } from 'react';

import { configureGoogleSignIn } from '@/services/auth/googleAuth';
import { presenceRepository } from '@/services/firebase';
import { useAuthStore, useSettingsStore } from '@/store';

/**
 * App-level side effects wired once at the root: auth subscription, presence
 * tracking, settings hydration, and Google Sign-In configuration.
 */
export function useAppBootstrap(): { ready: boolean } {
  const status = useAuthStore((s) => s.status);
  const uid = useAuthStore((s) => (s.profile?.provider === 'google' ? s.user?.uid ?? null : null));
  const initialize = useAuthStore((s) => s.initialize);
  const loadSettings = useSettingsStore((s) => s.load);
  const presenceTeardown = useRef<(() => void) | null>(null);

  useEffect(() => {
    configureGoogleSignIn();
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
