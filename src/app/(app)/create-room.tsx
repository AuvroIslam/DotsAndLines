import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Screen, SegmentedControl, Typography } from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { BoardSize } from '@/types';

export default function CreateRoomScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [boardSize, setBoardSize] = useState<BoardSize>(3);
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!profile) return;
    setCreating(true);
    try {
      const room = await roomRepository.createRoom({
        host: { uid: profile.uid, displayName: profile.displayName },
        mode: 'friend',
        boardSize,
        maxPlayers,
      });
      router.replace(Routes.lobby(room.id));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Typography variant="caption" muted>
          Board size
        </Typography>
        <SegmentedControl
          value={boardSize}
          onChange={(v) => setBoardSize(v)}
          options={[
            { label: '3 × 3', value: 3 },
            { label: '4 × 4', value: 4 },
            { label: '5 × 5', value: 5 },
          ]}
        />
      </Card>

      <Card>
        <Typography variant="caption" muted>
          Players
        </Typography>
        <SegmentedControl
          value={maxPlayers}
          onChange={(v) => setMaxPlayers(v)}
          options={[
            { label: '2', value: 2 },
            { label: '3', value: 3 },
            { label: '4', value: 4 },
          ]}
        />
      </Card>

      <View style={{ flex: 1 }} />
      <Button label="Create Room" loading={creating} onPress={handleCreate} />
    </Screen>
  );
}
