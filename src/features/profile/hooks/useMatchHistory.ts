import { useQuery } from '@tanstack/react-query';

import { matchHistoryRepository } from '@/services/firebase';
import { queryKeys } from '@/services/queryClient';

/** Cached read of a user's recent match history. */
export function useMatchHistory(uid: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matchHistory(uid ?? 'anon'),
    queryFn: () => matchHistoryRepository.getHistory(uid!),
    enabled: !!uid,
  });
}
