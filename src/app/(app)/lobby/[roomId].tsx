import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Loader, PageIntro, Screen, Typography } from '@/components/ui';
import { useRoom } from '@/features/game';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { room, members, me, isHost, everyoneReady, toggleReady, leave, start } = useRoom(roomId);
  const colors = useThemeColors();

  if (!room) return <Loader message="Loading lobby…" />;

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro
        title="The Lobby"
        subtitle="Gather the crew, then let the lines fly."
        accent={colors.primary}
      />
      <Card style={[styles.codeCard, { borderColor: colors.warning }]}>
        <Typography variant="caption" color={colors.warning}>
          SHARE THIS ROOM CODE
        </Typography>
        <Typography variant="h1" style={styles.code}>
          {room.code}
        </Typography>
        <Typography variant="caption" muted>
          {room.boardSize} × {room.boardSize} board · up to {room.maxPlayers} players
        </Typography>
      </Card>

      <View style={styles.playerHeading}>
        <Typography variant="h3">Players</Typography>
        <Typography variant="caption" muted>
          {members.length}/{room.maxPlayers} seats
        </Typography>
      </View>

      {members.map((m) => (
        <Card key={m.uid} style={[styles.memberRow, m.isReady && { borderColor: colors.success }]}>
          <Avatar name={m.displayName} size={40} />
          <View style={styles.memberInfo}>
            <Typography variant="body">
              {m.displayName}
              {m.uid === uid ? ' (you)' : ''}
            </Typography>
            <Typography variant="caption" muted>
              {m.isHost ? 'Room captain' : m.isReady ? 'Ready to draw!' : 'Getting ready…'}
            </Typography>
          </View>
          <View
            style={[
              styles.readyDot,
              { backgroundColor: m.isReady ? colors.success : colors.border },
            ]}
          />
        </Card>
      ))}

      <View style={styles.flex} />

      {!isHost ? (
        <Button
          label={me?.isReady ? 'Not ready' : 'Ready up'}
          icon={me?.isReady ? 'pause-circle' : 'checkmark-circle'}
          variant={me?.isReady ? 'secondary' : 'primary'}
          onPress={toggleReady}
        />
      ) : (
        <Button
          label={everyoneReady ? 'Start Game' : 'Waiting for players…'}
          icon="play"
          disabled={!everyoneReady}
          onPress={start}
        />
      )}
      <Button label="Leave room" icon="exit-outline" variant="ghost" onPress={leave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 620 },
  codeCard: { alignItems: 'center' },
  code: { letterSpacing: 8, transform: [{ translateX: 4 }] },
  playerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberInfo: { flex: 1 },
  readyDot: { width: 14, height: 14, borderRadius: 7 },
  flex: { flex: 1 },
});
