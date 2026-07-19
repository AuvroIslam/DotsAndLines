import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import type { AuthStatus } from '@/store';

/**
 * Redirects between the (auth) and (app) route groups based on auth status.
 * Lives in one place so individual screens never have to guard themselves.
 */
export function useProtectedRoute(status: AuthStatus): void {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'initializing') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    // Gate on "not where you belong", not "in the other group". At the index
    // route `/`, segments is empty — so an authenticated user there is in
    // neither group, and keying the redirect on `inAuthGroup` left them stranded
    // on the splash. A persisted session lands here on every cold start.
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'authenticated' && !inAppGroup) {
      router.replace('/(app)/home');
    }
  }, [status, segments, router]);
}
