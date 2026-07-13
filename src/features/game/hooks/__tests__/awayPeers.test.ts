import { GameManager } from '@/gameEngine';
import { players } from '@/testUtils/players';
import type { GameState, Player, PlayerId } from '@/types';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

import { computeAwayPeers } from '../awayPeers';

const NOW = 1_700_000_000_000;

function game(overrides: Record<PlayerId, Player> = {}): GameState {
  const g = GameManager.create({
    id: 'g',
    mode: 'random',
    size: 3,
    players: players(2),
    now: NOW,
  });
  return { ...g, players: { ...g.players, ...overrides } };
}

describe('computeAwayPeers', () => {
  it('reports a peer whose heartbeat has gone stale', () => {
    const g = game({
      P2: { ...game().players.P2!, lastSeenAt: NOW - HEARTBEAT_STALE_MS - 1_000 },
    });
    expect(computeAwayPeers(g, 'P1', NOW, true)).toEqual(['P2']);
  });

  it('reports a peer whose connection dropped', () => {
    const g = game({ P2: { ...game().players.P2!, isConnected: false, disconnectedAt: NOW } });
    expect(computeAwayPeers(g, 'P1', NOW, true)).toEqual(['P2']);
  });

  it('reports nobody while every peer is fresh', () => {
    expect(computeAwayPeers(game(), 'P1', NOW, true)).toEqual([]);
  });

  it('never reports me, only peers', () => {
    const g = game({ P1: { ...game().players.P1!, isConnected: false } });
    expect(computeAwayPeers(g, 'P1', NOW, true)).toEqual([]);
  });

  it('reports nobody while my own connection is down', () => {
    // Everyone looks stale from here, but only because I cannot hear them —
    // showing "reconnecting" for the whole table would be misleading.
    const g = game({ P2: { ...game().players.P2!, isConnected: false } });
    expect(computeAwayPeers(g, 'P1', NOW, false)).toEqual([]);
  });

  it('ignores eliminated peers (they are out, not reconnecting)', () => {
    const g = game({
      P2: { ...game().players.P2!, isConnected: false, isEliminated: true },
    });
    expect(computeAwayPeers(g, 'P1', NOW, true)).toEqual([]);
  });

  it('reports nobody once the game is over', () => {
    const g = { ...game(), phase: 'finished' as const };
    expect(computeAwayPeers(g, 'P1', NOW, true)).toEqual([]);
  });
});
