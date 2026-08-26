import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  PageIntro,
  Screen,
  SegmentedControl,
  TextField,
  Typography,
} from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';
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
  const colors = useThemeColors();

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
    <Screen scroll contentStyle={styles.content}>
      <PageIntro
        title="Friend Room"
        subtitle="Build a private arena or enter a friend's code."
        accent={colors.warning}
      />
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
          <Card style={{ borderColor: colors.primary }}>
            <Typography variant="h3">Board size</Typography>
            <Typography variant="caption" muted>
              Small is speedy; large rewards planning.
            </Typography>
            <SegmentedControl
              value={boardSize}
              onChange={(v) => setBoardSize(v)}
              options={BOARD_VARIANTS.map((v) => ({
                label: `${v.size} × ${v.size}`,
                value: v.size,
              }))}
            />
          </Card>

          <Card style={{ borderColor: colors.accent }}>
            <Typography variant="h3">Players</Typography>
            <Typography variant="caption" muted>
              Choose how many rivals can join.
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

          <View style={styles.flex} />
          <Button label="Create Room" icon="add-circle" loading={creating} onPress={handleCreate} />
        </>
      ) : (
        <>
          <Card style={[styles.joinCard, { borderColor: colors.warning }]}>
            <Typography variant="h3">Got a secret code?</Typography>
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
              style={styles.codeInput}
            />
          </Card>
          <Button label="Join Room" icon="enter" loading={joining} onPress={handleJoin} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 620 },
  flex: { flex: 1, minHeight: spacing.lg },
  joinCard: { marginTop: spacing.md },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontFamily: 'Fredoka_700Bold', fontSize: 20 },
});
