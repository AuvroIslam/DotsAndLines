import type { MatchmakingTicket } from '@/types';

function ticket(
  uid: string,
  enqueuedAt: number,
  boardSize: MatchmakingTicket['boardSize'] = 3,
): MatchmakingTicket {
  return { uid, displayName: uid, enqueuedAt, boardSize };
}

describe('local matchmakingRepository', () => {
  // `tryMatch` scans every queued ticket, and the queue is a module-level
  // singleton — reset the module between tests so one test's leftover
  // tickets can never be picked up as an "eligible opponent" by the next.
  let matchmakingRepository: (typeof import('../matchmakingRepository'))['matchmakingRepository'];

  beforeEach(() => {
    jest.resetModules();
    // require(), not import(): resets the module singleton per test — dynamic
    // import() isn't supported under this jest/babel setup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ matchmakingRepository } = require('../matchmakingRepository'));
  });

  it('returns null when no eligible opponent is queued', async () => {
    const me = ticket('solo', Date.now());
    await matchmakingRepository.enqueue(me);
    expect(await matchmakingRepository.tryMatch(me)).toBeNull();
  });

  it('pairs the oldest same-size opponent and stamps both tickets', async () => {
    const older = ticket('older', 100);
    const newer = ticket('newer', 200);
    const me = ticket('me', 300);
    await matchmakingRepository.enqueue(older);
    await matchmakingRepository.enqueue(newer);
    await matchmakingRepository.enqueue(me);

    const gameId = await matchmakingRepository.tryMatch(me);
    expect(gameId).not.toBeNull();

    const seen: unknown[] = [];
    const unsub = matchmakingRepository.subscribeTicket('me', (t) => seen.push(t));
    await Promise.resolve();
    unsub();
    expect((seen[seen.length - 1] as { gameId?: string })?.gameId).toBe(gameId);
  });

  it('ignores tickets with a different board size', async () => {
    const other = ticket('other-size', 1, 5);
    const me = ticket('me2', 2);
    await matchmakingRepository.enqueue(other);
    await matchmakingRepository.enqueue(me);
    expect(await matchmakingRepository.tryMatch(me)).toBeNull();
  });

  it('dequeue removes a ticket from consideration', async () => {
    const a = ticket('a', 1);
    const me = ticket('me3', 2);
    await matchmakingRepository.enqueue(a);
    await matchmakingRepository.dequeue('a');
    await matchmakingRepository.enqueue(me);
    expect(await matchmakingRepository.tryMatch(me)).toBeNull();
  });
});
