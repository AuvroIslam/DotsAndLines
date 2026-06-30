import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Screen, Typography } from '@/components/ui';
import { useRandomMatchmaking } from '@/features/game/hooks/useRandomMatchmaking';
import { Routes } from '@/navigation/routes';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const matchmaking = useRandomMatchmaking();

  return (
    <Screen scroll>
      <Card onPress={() => router.push(Routes.profile)} style={styles.profileCard}>
        <Avatar name={profile?.displayName ?? 'Player'} uri={profile?.photoURL} size={52} />
        <View style={styles.profileText}>
          <Typography variant="h3">{profile?.displayName ?? 'Player'}</Typography>
          <Typography variant="caption" muted>
            @{profile?.username ?? '—'}
          </Typography>
        </View>
      </Card>

      <Typography variant="h2">Play</Typography>
      <Button
        label={matchmaking.searching ? 'Searching for opponent…' : 'Random Match (1v1)'}
        loading={matchmaking.searching}
        onPress={() => matchmaking.start(3)}
      />
      {matchmaking.searching ? (
        <Button label="Cancel search" variant="ghost" onPress={matchmaking.cancel} />
      ) : null}
      <Button
        label="Local Play"
        variant="secondary"
        onPress={() => router.push(Routes.localGame)}
      />
      <Button
        label="Create Room"
        variant="secondary"
        onPress={() => router.push(Routes.createRoom)}
      />
      <Button label="Join Room" variant="secondary" onPress={() => router.push(Routes.joinRoom)} />

      <Typography variant="h2" style={styles.sectionTop}>
        Social
      </Typography>
      <View style={styles.grid}>
        <Button
          label="Friends"
          variant="secondary"
          style={styles.gridItem}
          onPress={() => router.push(Routes.friends)}
        />
        <Button
          label="Requests"
          variant="secondary"
          style={styles.gridItem}
          onPress={() => router.push(Routes.friendRequests)}
        />
        <Button
          label="History"
          variant="secondary"
          style={styles.gridItem}
          onPress={() => router.push(Routes.history)}
        />
        <Button
          label="Stats"
          variant="secondary"
          style={styles.gridItem}
          onPress={() => router.push(Routes.statistics)}
        />
      </View>

      <Button label="Settings" variant="ghost" onPress={() => router.push(Routes.settings)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  profileText: { flex: 1 },
  sectionTop: { marginTop: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
});
