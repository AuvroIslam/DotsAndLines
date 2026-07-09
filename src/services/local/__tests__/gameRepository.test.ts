import { GameManager } from '@/gameEngine';
import { players } from '@/testUtils/players';

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

  it('trackConnection marks the player online, then offline on teardown', async () => {
    const game = GameManager.create({ id: 'g5', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);

    const teardown = gameRepository.trackConnection('g5', 'P2');
    let updated = await gameRepository.getGame('g5');
    expect(updated?.players.P2?.isConnected).toBe(true);
    expect(updated?.players.P1?.isConnected).toBe(true);

    teardown();
    updated = await gameRepository.getGame('g5');
    expect(updated?.players.P2?.isConnected).toBe(false);
    expect(updated?.players.P2?.disconnectedAt).not.toBeNull();
  });

  it('deleteGame removes the game', async () => {
    const game = GameManager.create({ id: 'g6', mode: 'friend', size: 3, players: players(2) });
    await gameRepository.createGame(game);
    await gameRepository.deleteGame('g6');
    expect(await gameRepository.getGame('g6')).toBeNull();
  });

  describe('heartbeat', () => {
    it('refreshes only the target player’s lastSeenAt', async () => {
      const game = GameManager.create({ id: 'g14', mode: 'friend', size: 3, players: players(2) });
      await gameRepository.createGame(game);

      await gameRepository.heartbeat('g14', 'P2');
      const updated = await gameRepository.getGame('g14');
      expect(updated?.players.P2?.lastSeenAt).not.toBeNull();
      expect(updated?.players.P1?.lastSeenAt).toBe(game.players.P1?.lastSeenAt);
    });
  });
});
