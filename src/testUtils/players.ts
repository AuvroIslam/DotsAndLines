import type { Player } from '@/types';

/** Shared fixture for engine/repository/hook tests that just need N distinct players. */
export function players(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `P${i + 1}`,
    uid: `uid${i + 1}`,
    index: i as Player['index'],
    displayName: `Player ${i + 1}`,
    color: '#fff',
    isConnected: true,
    isEliminated: false,
    disconnectedAt: null,
    lastSeenAt: null,
    score: 0,
  }));
}
