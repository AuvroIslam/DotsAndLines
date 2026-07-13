import { GameManager } from '@/gameEngine';
import { players } from '@/testUtils/players';
import type { GamePresence, GameState, PlayerPresence } from '@/types';
import { HEARTBEAT_STALE_MS } from '@/utils/constants';

import { computeAwayPeers } from '../awayPeers';

const NOW = 1_700_000_000_000;

const base = (): GameState =>
  GameManager.create({ id: 'g', mode: 'random', size: 3, players: players(2), now: NOW });

const p = (over: Partial<PlayerPresence> = {}): PlayerPresence => ({
  isConnected: true,
  disconnectedAt: null,
  lastSeenAt: NOW,
  ...over,
});

const both = (over: Partial<Record<'P1' | 'P2', PlayerPresence>> = {}): GamePresence => ({
  P1: p(),
  P2: p(),
  ...over,
});

describe('computeAwayPeers', () => {
  it('reports a peer whose heartbeat has gone stale', () => {
    const presence = both({ P2: p({ lastSeenAt: NOW - HEARTBEAT_STALE_MS - 1_000 }) });
    expect(computeAwayPeers(base(), presence, 'P1', NOW, true)).toEqual(['P2']);
  });

  it('reports a peer whose connection dropped', () => {
    const presence = both({ P2: p({ isConnected: false, disconnectedAt: NOW }) });
    expect(computeAwayPeers(base(), presence, 'P1', NOW, true)).toEqual(['P2']);
  });

  it('reports nobody while every peer is fresh', () => {
    expect(computeAwayPeers(base(), both(), 'P1', NOW, true)).toEqual([]);
  });

  it('never reports me, only peers', () => {
    const presence = both({ P1: p({ isConnected: false }) });
    expect(computeAwayPeers(base(), presence, 'P1', NOW, true)).toEqual([]);
  });

  it('reports nobody while my own connection is down', () => {
    // Everyone looks stale from here, but only because I cannot hear them —
    // showing "reconnecting" for the whole table would be misleading.
    const presence = both({ P2: p({ isConnected: false }) });
    expect(computeAwayPeers(base(), presence, 'P1', NOW, false)).toEqual([]);
  });

  it('ignores eliminated peers (they are out, not reconnecting)', () => {
    const g = base();
    const eliminated: GameState = {
      ...g,
      players: { ...g.players, P2: { ...g.players.P2!, isEliminated: true } },
    };
    const presence = both({ P2: p({ isConnected: false }) });
    expect(computeAwayPeers(eliminated, presence, 'P1', NOW, true)).toEqual([]);
  });

  it('reports nobody once the game is over', () => {
    const finished: GameState = { ...base(), phase: 'finished' };
    const presence = both({ P2: p({ isConnected: false }) });
    expect(computeAwayPeers(finished, presence, 'P1', NOW, true)).toEqual([]);
  });

  it('treats a peer with no presence entry yet as present', () => {
    expect(computeAwayPeers(base(), { P1: p() }, 'P1', NOW, true)).toEqual([]);
  });
});
