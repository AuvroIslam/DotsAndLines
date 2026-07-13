import type { PlayerPresence } from '@/types';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

import { PresenceChecker } from '../PresenceChecker';

const NOW = 1_000_000;
const presence = (over: Partial<PlayerPresence> = {}): PlayerPresence => ({
  isConnected: true,
  disconnectedAt: null,
  lastSeenAt: NOW,
  ...over,
});

describe('PresenceChecker.isAway', () => {
  it('is not away when connected with a fresh heartbeat', () => {
    expect(PresenceChecker.isAway(presence({ lastSeenAt: NOW - 1_000 }), NOW)).toBe(false);
  });

  it('is not away when connected with no heartbeat recorded yet', () => {
    expect(PresenceChecker.isAway(presence({ lastSeenAt: null }), NOW)).toBe(false);
  });

  it('fast path: a dropped connection is away immediately', () => {
    const p = presence({ isConnected: false, disconnectedAt: NOW - 500, lastSeenAt: NOW - 500 });
    expect(PresenceChecker.isAway(p, NOW)).toBe(true);
  });

  it('slow path: a stale heartbeat is away even while isConnected still reports true', () => {
    // The silent-network-loss case: no graceful close ever flipped isConnected,
    // but the heartbeat stopped refreshing.
    const p = presence({ lastSeenAt: NOW - HEARTBEAT_STALE_MS - 1 });
    expect(PresenceChecker.isAway(p, NOW)).toBe(true);
  });

  it('slow path: a heartbeat within the stale threshold is not away', () => {
    expect(PresenceChecker.isAway(presence({ lastSeenAt: NOW - HEARTBEAT_STALE_MS + 1 }), NOW)).toBe(
      false,
    );
  });

  it('treats a player who has reported nothing yet as present, not away', () => {
    // Presence now lives in its own node, so a player who just joined may have
    // no entry at all. Guessing "away" would flash a misleading banner at
    // everyone else the moment a game starts.
    expect(PresenceChecker.isAway(undefined, NOW)).toBe(false);
  });
});
