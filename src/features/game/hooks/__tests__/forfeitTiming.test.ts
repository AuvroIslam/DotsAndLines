import { GameManager } from '@/gameEngine';
import { players } from '@/testUtils/players';
import type { GameState } from '@/types';
import { HEARTBEAT_STALE_MS, RECONNECT_MAX_DELAY_MS } from '@/utils/constants';

import { computePendingForfeits } from '../forfeitTiming';

function baseGame(n = 2): GameState {
  return GameManager.create({ id: 'g', mode: 'friend', size: 3, players: players(n) });
}

describe('computePendingForfeits', () => {
  it('is empty when nobody is disconnected', () => {
    const g = baseGame();
    expect(computePendingForfeits(g, 'P1', Date.now(), true)).toEqual({});
  });

  it('reports a disconnected peer with the correct remaining time', () => {
    const now = 1_000_000;
    const g = baseGame();
    const withDisconnect: GameState = {
      ...g,
      players: {
        ...g.players,
        P2: { ...g.players.P2!, isConnected: false, disconnectedAt: now - 4_000 },
      },
    };
    const pending = computePendingForfeits(withDisconnect, 'P1', now, true);
    expect(pending.P2).toEqual({
      disconnectedAt: now - 4_000,
      remainingMs: RECONNECT_MAX_DELAY_MS - 4_000,
    });
  });

  it('clamps remainingMs to 0 once the grace period has elapsed', () => {
    const now = 1_000_000;
    const g = baseGame();
    const withDisconnect: GameState = {
      ...g,
      players: {
        ...g.players,
        P2: {
          ...g.players.P2!,
          isConnected: false,
          disconnectedAt: now - RECONNECT_MAX_DELAY_MS - 5_000,
        },
      },
    };
    expect(computePendingForfeits(withDisconnect, 'P1', now, true).P2?.remainingMs).toBe(0);
  });

  it('excludes myPlayerId even if disconnected', () => {
    const now = Date.now();
    const g = baseGame();
    const withDisconnect: GameState = {
      ...g,
      players: { ...g.players, P1: { ...g.players.P1!, isConnected: false, disconnectedAt: now } },
    };
    expect(computePendingForfeits(withDisconnect, 'P1', now, true)).toEqual({});
  });

  it('excludes an already-eliminated peer', () => {
    const now = Date.now();
    const g = baseGame();
    const withDisconnect: GameState = {
      ...g,
      players: {
        ...g.players,
        P2: { ...g.players.P2!, isConnected: false, disconnectedAt: now, isEliminated: true },
      },
    };
    expect(computePendingForfeits(withDisconnect, 'P1', now, true)).toEqual({});
  });

  it('reports a peer as pending via a stale heartbeat, even while isConnected still reports true', () => {
    // This is the silent-network-loss case: onDisconnect hasn't fired (no
    // graceful close for the server to notice), but their heartbeat stopped.
    const now = 1_000_000;
    const g = baseGame();
    const lastSeenAt = now - HEARTBEAT_STALE_MS - 2_000;
    const withStaleHeartbeat: GameState = {
      ...g,
      players: { ...g.players, P2: { ...g.players.P2!, isConnected: true, lastSeenAt } },
    };
    const pending = computePendingForfeits(withStaleHeartbeat, 'P1', now, true);
    expect(pending.P2).toEqual({
      disconnectedAt: lastSeenAt + HEARTBEAT_STALE_MS,
      remainingMs: RECONNECT_MAX_DELAY_MS - 2_000,
    });
  });

  it('does not report a peer whose heartbeat is merely within the stale threshold', () => {
    const now = 1_000_000;
    const g = baseGame();
    const withFreshHeartbeat: GameState = {
      ...g,
      players: {
        ...g.players,
        P2: { ...g.players.P2!, isConnected: true, lastSeenAt: now - HEARTBEAT_STALE_MS + 1_000 },
      },
    };
    expect(computePendingForfeits(withFreshHeartbeat, 'P1', now, true)).toEqual({});
  });

  it('reports nothing while my own connection is unhealthy, even if a peer looks stale', () => {
    // If my own connection just dropped, every peer's last-synced snapshot is
    // frozen from my point of view — that alone would make them look "away"
    // purely because I've stopped hearing from anyone, not because they left.
    const now = 1_000_000;
    const g = baseGame();
    const withDisconnect: GameState = {
      ...g,
      players: {
        ...g.players,
        P2: { ...g.players.P2!, isConnected: false, disconnectedAt: now - 5_000 },
      },
    };
    expect(computePendingForfeits(withDisconnect, 'P1', now, false)).toEqual({});
  });

  it('is empty when the game is null', () => {
    expect(computePendingForfeits(null, 'P1', Date.now(), true)).toEqual({});
  });

  it('is empty when the game is not playing', () => {
    const g: GameState = { ...baseGame(), phase: 'finished' };
    expect(computePendingForfeits(g, 'P1', Date.now(), true)).toEqual({});
  });
});
