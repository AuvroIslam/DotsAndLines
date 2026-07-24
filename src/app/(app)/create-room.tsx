import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Screen, SegmentedControl, TextField, Typography } from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import type { BoardSize } from '@/types';
import { BOARD_VARIANTS } from '@/utils';

export default function CreateRoomScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const [boardSize, setBoardSize] = useState<BoardSize>(3);
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [creating, setCreating] = useState(false);

  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

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

  const handleJoin = async () => {
    if (!profile || code.trim().length < 4) return;
    setJoining(true);
    setJoinError(null);
    try {
      const roomId = await roomRepository.findRoomIdByCode(code.trim());
      if (!roomId) {
        setJoinError('No room found with that code');
        return;
      }
      const res = await roomRepository.joinRoom(roomId, {
        uid: profile.uid,
        displayName: profile.displayName,
      });
      if (!res.ok) {
        setJoinError(
          res.reason === 'full'
            ? 'That room is full'
            : res.reason === 'started'
              ? 'That game already started'
              : 'Could not join room',
        );
        return;
      }
      router.replace(Routes.lobby(roomId));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: 'Create', value: 'create' },
          { label: 'Join', value: 'join' },
        ]}
      />

      {mode === 'create' ? (
        <>
          <Card>
            <Typography variant="caption" muted>
              Board size
            </Typography>
            <SegmentedControl
              value={boardSize}
              onChange={(v) => setBoardSize(v)}
              options={BOARD_VARIANTS.map((v) => ({ label: `${v.size} × ${v.size}`, value: v.size }))}
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
        </>
      ) : (
        <>
          <Typography variant="body" muted>
            Enter the 6-character code your friend shared with you.
          </Typography>
          <TextField
            label="Room code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="ABC123"
            error={joinError}
          />
          <Button label="Join Room" loading={joining} onPress={handleJoin} />
        </>
      )}
    </Screen>
  );
}
