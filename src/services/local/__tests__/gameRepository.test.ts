import { GameManager } from '@/gameEngine';
import { players } from '@/testUtils/players';
import type { GamePresence } from '@/types';

import { gameRepository } from '../gameRepository';

describe('local gameRepository', () => {
  it('creates and fetches a game', async () => {
    const game = GameManager.create({ id: 'g1', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);
    expect(await gameRepository.getGame('g1')).toEqual(game);
    expect(await gameRepository.getGame('missing')).toBeNull();
  });

  it('applies a legal move and rejects an illegal one', async () => {
    const game = GameManager.create({ id: 'g2', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);

    const bad = await gameRepository.applyMove(
      'g2',
      { orientation: 'horizontal', row: 0, col: 0 },
      'P2', // not P2's turn
    );
    expect(bad).toEqual({ ok: false, reason: 'rejected' });

    const good = await gameRepository.applyMove(
      'g2',
      { orientation: 'horizontal', row: 0, col: 0 },
      'P1',
    );
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.state.currentTurn).toBe('P2');
  });

  it('returns not_found for a nonexistent game', async () => {
    const res = await gameRepository.applyMove(
      'nope',
      { orientation: 'horizontal', row: 0, col: 0 },
      'P1',
    );
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });

  it('subscribe delivers the current and subsequent states', async () => {
    const game = GameManager.create({ id: 'g3', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);

    const seen: string[] = [];
    const unsub = gameRepository.subscribe('g3', (g) => seen.push(g?.currentTurn ?? 'null'));
    await Promise.resolve();
    expect(seen).toEqual(['P1']);

    await gameRepository.applyMove('g3', { orientation: 'horizontal', row: 0, col: 0 }, 'P1');
    expect(seen).toEqual(['P1', 'P2']);
    unsub();
  });

  it('deleteGame removes the game', async () => {
    const game = GameManager.create({ id: 'g6', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);
    await gameRepository.deleteGame('g6');
    expect(await gameRepository.getGame('g6')).toBeNull();
  });

  describe('presence', () => {
    // `subscribePresence` delivers asynchronously, exactly like RTDB's onValue.
    const presenceOf = async (gameId: string): Promise<GamePresence> => {
      let seen: GamePresence = {};
      const unsub = gameRepository.subscribePresence(gameId, (p) => {
        seen = p;
      });
      await Promise.resolve();
      unsub();
      return seen;
    };

    it('trackConnection marks the player online, then offline on teardown', async () => {
      const game = GameManager.create({ id: 'g5', mode: 'friend', size: 3, players: players(2) });
      await gameRepository.createGame(game);

      const teardown = gameRepository.trackConnection('g5', 'P2');
      expect((await presenceOf('g5')).P2?.isConnected).toBe(true);

      teardown();
      const after = await presenceOf('g5');
      expect(after.P2?.isConnected).toBe(false);
      expect(after.P2?.disconnectedAt).not.toBeNull();
    });

    it('heartbeat refreshes only the target player', async () => {
      const game = GameManager.create({ id: 'g14', mode: 'friend', size: 3, players: players(2) });
      await gameRepository.createGame(game);

      await gameRepository.heartbeat('g14', 'P2');
      const p = await presenceOf('g14');
      expect(p.P2?.lastSeenAt).not.toBeNull();
      expect(p.P1).toBeUndefined();
    });

    it('NEVER touches game state — the whole reason presence lives apart', async () => {
      // Heartbeats fire every few seconds per player. If they mutated the game
      // node, every one of them would push a fresh game snapshot to every
      // subscriber, turning traffic from O(moves) into O(players per second).
      const game = GameManager.create({ id: 'g15', mode: 'friend', size: 3, players: players(2) });
      await gameRepository.createGame(game);
      const before = await gameRepository.getGame('g15');

      const teardown = gameRepository.trackConnection('g15', 'P2');
      await gameRepository.heartbeat('g15', 'P2');
      teardown();

      expect(await gameRepository.getGame('g15')).toEqual(before);
    });
  });
});
