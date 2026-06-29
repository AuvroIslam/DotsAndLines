import { useQuery } from '@tanstack/react-query';

import { userRepository } from '@/services/firebase';
import { queryKeys } from '@/services/queryClient';

/** Cached read of a user's aggregate statistics. */
export function useStatistics(uid: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.statistics(uid ?? 'anon'),
    queryFn: () => userRepository.getStatistics(uid!),
    enabled: !!uid,
  });
}
