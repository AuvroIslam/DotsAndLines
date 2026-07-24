import type { Room } from '@/types';

import { isInviteStale } from '../inviteStale';

const openRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'r1',
  code: 'ABC123',
  hostUid: 'host',
  mode: 'friend',
  boardSize: 5,
  maxPlayers: 2,
  status: 'open',
  members: {},
  gameId: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('isInviteStale', () => {
  it('keeps an invite to a room that is still an open lobby', () => {
    expect(isInviteStale(openRoom())).toBe(false);
  });

  it('drops an invite whose room has vanished', () => {
    expect(isInviteStale(null)).toBe(true);
  });

  it('drops an invite once the game has started', () => {
    expect(isInviteStale(openRoom({ gameId: 'g1' }))).toBe(true);
  });

  it('drops an invite to a room that is no longer open', () => {
    expect(isInviteStale(openRoom({ status: 'closed' }))).toBe(true);
    expect(isInviteStale(openRoom({ status: 'starting' }))).toBe(true);
  });
});
