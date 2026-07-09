import { players } from '@/testUtils/players';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

import { PresenceChecker } from '../PresenceChecker';

function player(overrides: Partial<ReturnType<typeof players>[0]> = {}) {
  return { ...players(1)[0]!, ...overrides };
}

describe('PresenceChecker', () => {
  const now = 1_000_000;

  it('is not away when connected with a fresh heartbeat', () => {
    const p = player({ isConnected: true, lastSeenAt: now - 1_000 });
    expect(PresenceChecker.isAway(p, now)).toBe(false);
    expect(PresenceChecker.awaySince(p, now)).toBeNull();
  });

  it('is not away when connected with no heartbeat recorded yet (fresh/pre-migration data)', () => {
    const p = player({ isConnected: true, lastSeenAt: null });
    expect(PresenceChecker.isAway(p, now)).toBe(false);
    expect(PresenceChecker.awaySince(p, now)).toBeNull();
  });

  it('fast path: isConnected=false is away immediately, anchored on disconnectedAt', () => {
    const p = player({ isConnected: false, disconnectedAt: now - 500, lastSeenAt: now - 500 });
    expect(PresenceChecker.isAway(p, now)).toBe(true);
    expect(PresenceChecker.awaySince(p, now)).toBe(now - 500);
  });

  it('slow path: a stale heartbeat is away even while isConnected still reports true', () => {
    const lastSeenAt = now - HEARTBEAT_STALE_MS - 1;
    const p = player({ isConnected: true, lastSeenAt });
    expect(PresenceChecker.isAway(p, now)).toBe(true);
    expect(PresenceChecker.awaySince(p, now)).toBe(lastSeenAt + HEARTBEAT_STALE_MS);
  });

  it('slow path: a heartbeat within the stale threshold is not away', () => {
    const p = player({ isConnected: true, lastSeenAt: now - HEARTBEAT_STALE_MS + 1 });
    expect(PresenceChecker.isAway(p, now)).toBe(false);
    expect(PresenceChecker.awaySince(p, now)).toBeNull();
  });
});
