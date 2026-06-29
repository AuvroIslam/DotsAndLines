import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Loader, Screen, Typography } from '@/components/ui';
import { useRoom } from '@/features/game';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { room, members, me, isHost, everyoneReady, toggleReady, leave, start } = useRoom(roomId);

  if (!room) return <Loader message="Loading lobby…" />;

  return (
    <Screen>
      <Card style={styles.codeCard}>
        <Typography variant="caption" muted>
          Room code · share to invite
        </Typography>
        <Typography variant="h1" style={styles.code}>
          {room.code}
        </Typography>
        <Typography variant="caption" muted>
          {room.boardSize} × {room.boardSize} board · up to {room.maxPlayers} players
        </Typography>
      </Card>

      <Typography variant="h3">
        Players ({members.length}/{room.maxPlayers})
      </Typography>

      {members.map((m) => (
        <Card key={m.uid} style={styles.memberRow}>
          <Avatar name={m.displayName} size={40} />
          <View style={styles.memberInfo}>
            <Typography variant="body">
              {m.displayName}
              {m.uid === uid ? ' (you)' : ''}
            </Typography>
            <Typography variant="caption" muted>
              {m.isHost ? 'Host' : m.isReady ? 'Ready' : 'Not ready'}
            </Typography>
          </View>
          <View
            style={[
              styles.readyDot,
              { backgroundColor: m.isReady ? theme.colors.success : theme.colors.border },
            ]}
          />
        </Card>
      ))}

      <View style={styles.flex} />

      {!isHost ? (
        <Button
          label={me?.isReady ? 'Not ready' : 'Ready up'}
          variant={me?.isReady ? 'secondary' : 'primary'}
          onPress={toggleReady}
        />
      ) : (
        <Button
          label={everyoneReady ? 'Start Game' : 'Waiting for players…'}
          disabled={!everyoneReady}
          onPress={start}
        />
      )}
      <Button label="Leave room" variant="ghost" onPress={leave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center' },
  code: { letterSpacing: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  memberInfo: { flex: 1 },
  readyDot: { width: 14, height: 14, borderRadius: 7 },
  flex: { flex: 1 },
});
