import { QueryClient } from '@tanstack/react-query';

/** Shared React Query client. Tuned for a mobile app with realtime overlays. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Centralized query keys so cache invalidation stays consistent and typo-free. */
export const queryKeys = {
  profile: (uid: string) => ['profile', uid] as const,
  statistics: (uid: string) => ['statistics', uid] as const,
  matchHistory: (uid: string) => ['matchHistory', uid] as const,
  settings: (uid: string) => ['settings', uid] as const,
  leaderboard: () => ['leaderboard'] as const,
} as const;
