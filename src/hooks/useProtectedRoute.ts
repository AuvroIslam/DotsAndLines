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
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [status, segments, router]);
}
