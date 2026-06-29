import { get, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';

import { GameManager } from '@/gameEngine';
import { playerColors } from '@/theme';
import type { BoardSize, GameMode, Player, PlayerIndex, Room, RoomMember } from '@/types';
import { ROOM_CODE_LENGTH } from '@/utils/constants';

import { realtimeDb } from './config';
import { gameRepository } from './gameRepository';
import { RtdbPaths } from './paths';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function nextFreeIndex(members: Record<string, RoomMember>): PlayerIndex {
  const taken = new Set(Object.values(members).map((m) => m.index));
  for (let i = 0; i < 4; i += 1) {
    if (!taken.has(i as PlayerIndex)) return i as PlayerIndex;
  }
  return 0;
}

/**
 * Custom rooms (lobbies) in Realtime Database. A room holds members until the
 * host starts it, at which point a Game is created and `gameId` is set so every
 * client can navigate into the match.
 */
export const roomRepository = {
  async createRoom(input: {
    host: { uid: string; displayName: string };
    mode: GameMode;
    boardSize: BoardSize;
    maxPlayers: 2 | 3 | 4;
  }): Promise<Room> {
    const roomRef = push(ref(realtimeDb, RtdbPaths.rooms));
    const id = roomRef.key!;
    const code = generateCode();
    const now = Date.now();

    const host: RoomMember = {
      uid: input.host.uid,
      displayName: input.host.displayName,
      index: 0,
      isReady: true,
      isHost: true,
      joinedAt: now,
    };
    const room: Room = {
      id,
      code,
      hostUid: input.host.uid,
      mode: input.mode,
      boardSize: input.boardSize,
      maxPlayers: input.maxPlayers,
      status: 'open',
      members: { [host.uid]: host },
      gameId: null,
      createdAt: now,
      updatedAt: now,
    };

    await set(roomRef, room);
    await set(ref(realtimeDb, RtdbPaths.roomCodeIndex(code)), id);
    return room;
  },

  async findRoomIdByCode(code: string): Promise<string | null> {
    const snap = await get(ref(realtimeDb, RtdbPaths.roomCodeIndex(code.toUpperCase())));
    return snap.exists() ? (snap.val() as string) : null;
  },

  async joinRoom(
    roomId: string,
    member: { uid: string; displayName: string },
  ): Promise<{ ok: boolean; reason?: 'full' | 'not_found' | 'started' }> {
    const node = ref(realtimeDb, RtdbPaths.room(roomId));
    const tx = await runTransaction(node, (room: Room | null) => {
      if (!room) return room;
      if (room.status !== 'open') return; // abort
      const members = room.members ?? {};
      if (members[member.uid]) return room; // already in
      if (Object.keys(members).length >= room.maxPlayers) return; // abort: full
      const newMember: RoomMember = {
        uid: member.uid,
        displayName: member.displayName,
        index: nextFreeIndex(members),
        isReady: false,
        isHost: false,
        joinedAt: Date.now(),
      };
      return { ...room, members: { ...members, [member.uid]: newMember }, updatedAt: Date.now() };
    });

    if (tx.committed) return { ok: true };
    const exists = (await get(node)).exists();
    if (!exists) return { ok: false, reason: 'not_found' };
    const room = (await get(node)).val() as Room;
    return { ok: false, reason: room.status !== 'open' ? 'started' : 'full' };
  },

  subscribeRoom(roomId: string, cb: (room: Room | null) => void): () => void {
    return onValue(ref(realtimeDb, RtdbPaths.room(roomId)), (snap) =>
      cb(snap.val() as Room | null),
    );
  },

  async setReady(roomId: string, uid: string, isReady: boolean): Promise<void> {
    await update(ref(realtimeDb, RtdbPaths.roomMember(roomId, uid)), { isReady });
  },

  async leaveRoom(roomId: string, uid: string): Promise<void> {
    const node = ref(realtimeDb, RtdbPaths.room(roomId));
    const snap = await get(node);
    const room = snap.val() as Room | null;
    if (!room) return;

    const remaining = { ...(room.members ?? {}) };
    delete remaining[uid];

    if (Object.keys(remaining).length === 0) {
      await remove(node);
      await remove(ref(realtimeDb, RtdbPaths.roomCodeIndex(room.code)));
      return;
    }

    // If the host left, promote the earliest-joined remaining member.
    let patch: Partial<Room> = { members: remaining, updatedAt: Date.now() };
    if (room.hostUid === uid) {
      const next = Object.values(remaining).sort((a, b) => a.joinedAt - b.joinedAt)[0]!;
      remaining[next.uid] = { ...next, isHost: true, isReady: true };
      patch = { ...patch, members: remaining, hostUid: next.uid };
    }
    await update(node, patch);
  },

  /** Host-only: convert a ready room into a live game. */
  async startGame(roomId: string): Promise<string> {
    const node = ref(realtimeDb, RtdbPaths.room(roomId));
    const room = (await get(node)).val() as Room | null;
    if (!room) throw new Error('Room not found');

    const sortedMembers = Object.values(room.members ?? {}).sort((a, b) => a.index - b.index);
    const players: Player[] = sortedMembers.map((m, i) => ({
      id: `P${m.index + 1}`,
      uid: m.uid,
      index: m.index,
      displayName: m.displayName,
      color: playerColors[i % playerColors.length]!,
      isConnected: true,
      score: 0,
    }));

    const gameId = roomId; // 1:1 room→game mapping keeps navigation simple
    const game = GameManager.create({
      id: gameId,
      mode: room.mode,
      size: room.boardSize,
      players,
    });
    await gameRepository.createGame(game);
    await update(node, { status: 'in_progress', gameId, updatedAt: Date.now() });
    return gameId;
  },
};
