import { roomRepository } from '../roomRepository';

describe('local roomRepository', () => {
  it('creates a room and finds it by code', async () => {
    const room = await roomRepository.createRoom({
      host: { uid: 'host1', displayName: 'Host' },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 2,
    });
    expect(room.members.host1?.isHost).toBe(true);

    const foundId = await roomRepository.findRoomIdByCode(room.code);
    expect(foundId).toBe(room.id);
  });

  it('joins a room until full, then rejects', async () => {
    const room = await roomRepository.createRoom({
      host: { uid: 'host2', displayName: 'Host' },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 2,
    });

    const joined = await roomRepository.joinRoom(room.id, { uid: 'guest', displayName: 'Guest' });
    expect(joined).toEqual({ ok: true });

    const full = await roomRepository.joinRoom(room.id, { uid: 'third', displayName: 'Third' });
    expect(full).toEqual({ ok: false, reason: 'full' });

    const missing = await roomRepository.joinRoom('nope', { uid: 'x', displayName: 'X' });
    expect(missing).toEqual({ ok: false, reason: 'not_found' });
  });

  it('promotes the earliest remaining member when the host leaves', async () => {
    const room = await roomRepository.createRoom({
      host: { uid: 'host3', displayName: 'Host' },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 3,
    });
    await roomRepository.joinRoom(room.id, { uid: 'guestA', displayName: 'A' });
    await roomRepository.joinRoom(room.id, { uid: 'guestB', displayName: 'B' });

    await roomRepository.leaveRoom(room.id, 'host3');

    const seen: (typeof room)[] = [];
    const unsub = roomRepository.subscribeRoom(room.id, (r) => r && seen.push(r));
    await Promise.resolve();
    unsub();
    const latest = seen[seen.length - 1]!;
    expect(latest.hostUid).toBe('guestA');
    expect(latest.members.guestA?.isHost).toBe(true);
    expect(latest.members.host3).toBeUndefined();
  });

  it('deletes the room once the last member leaves', async () => {
    const room = await roomRepository.createRoom({
      host: { uid: 'host4', displayName: 'Host' },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 2,
    });
    await roomRepository.leaveRoom(room.id, 'host4');
    expect(await roomRepository.findRoomIdByCode(room.code)).toBeNull();
  });

  it('startGame creates a game and marks the room in_progress', async () => {
    const room = await roomRepository.createRoom({
      host: { uid: 'host5', displayName: 'Host' },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 2,
    });
    await roomRepository.joinRoom(room.id, { uid: 'guest5', displayName: 'Guest' });

    const gameId = await roomRepository.startGame(room.id);
    expect(gameId).toBe(room.id);

    const seen: (typeof room)[] = [];
    const unsub = roomRepository.subscribeRoom(room.id, (r) => r && seen.push(r));
    await Promise.resolve();
    unsub();
    expect(seen[seen.length - 1]?.status).toBe('in_progress');
    expect(seen[seen.length - 1]?.gameId).toBe(gameId);
  });
});
