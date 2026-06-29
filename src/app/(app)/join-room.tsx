import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Screen, TextField, Typography } from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';

export default function JoinRoomScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!profile || code.trim().length < 4) return;
    setJoining(true);
    setError(null);
    try {
      const roomId = await roomRepository.findRoomIdByCode(code.trim());
      if (!roomId) {
        setError('No room found with that code');
        return;
      }
      const res = await roomRepository.joinRoom(roomId, {
        uid: profile.uid,
        displayName: profile.displayName,
      });
      if (!res.ok) {
        setError(
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
        error={error}
      />
      <Button label="Join Room" loading={joining} onPress={handleJoin} />
    </Screen>
  );
}
