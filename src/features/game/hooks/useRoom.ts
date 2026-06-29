import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { Room } from '@/types';

/**
 * Binds a screen to a custom room lobby: live membership, ready state, host
 * start, and auto-navigation into the game once the host launches it.
 */
export function useRoom(roomId: string) {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [room, setRoom] = useState<Room | null>(null);
  const navigated = useRef(false);

  useEffect(() => {
    const unsub = roomRepository.subscribeRoom(roomId, (next) => {
      setRoom(next);
      if (next?.gameId && !navigated.current) {
        navigated.current = true;
        router.replace(Routes.game(next.gameId));
      }
    });
    return unsub;
  }, [roomId, router]);

  const me = profile ? room?.members?.[profile.uid] : undefined;
  const isHost = !!me?.isHost;
  const members = room ? Object.values(room.members ?? {}).sort((a, b) => a.index - b.index) : [];
  const everyoneReady = members.length >= 2 && members.every((m) => m.isReady);

  const toggleReady = async () => {
    if (!profile || !me) return;
    await roomRepository.setReady(roomId, profile.uid, !me.isReady);
  };

  const leave = async () => {
    if (!profile) return;
    await roomRepository.leaveRoom(roomId, profile.uid);
    router.back();
  };

  const start = async () => {
    if (!isHost || !everyoneReady) return;
    await roomRepository.startGame(roomId);
  };

  return { room, members, me, isHost, everyoneReady, toggleReady, leave, start };
}
