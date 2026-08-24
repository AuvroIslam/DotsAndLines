import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Card, Screen, SegmentedControl, Typography } from '@/components/ui';
import { useFriends } from '@/features/friends';
import { useRandomMatchmaking } from '@/features/game/hooks/useRandomMatchmaking';
import { useGameInvites } from '@/features/notifications';
import { Routes } from '@/navigation/routes';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import type { BoardSize } from '@/types';
import { BOARD_VARIANTS, DEFAULT_BOARD } from '@/utils';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const matchmaking = useRandomMatchmaking();
  const { incomingRequests } = useFriends();
  const { count: inviteCount } = useGameInvites();
  const [pickedBoard, setPickedBoard] = useState<BoardSize>(DEFAULT_BOARD);
  const pickedLabel = BOARD_VARIANTS.find((v) => v.size === pickedBoard)?.label ?? `${pickedBoard}×${pickedBoard}`;

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Card onPress={() => router.push(Routes.profile)} style={styles.profileCard}>
          <Avatar name={profile?.displayName ?? 'Player'} uri={profile?.photoURL} size={52} />
          <View style={styles.profileText}>
            <Typography variant="h3">{profile?.displayName ?? 'Player'}</Typography>
            <Typography variant="caption" muted>
              @{profile?.username ?? '—'}
            </Typography>
          </View>
        </Card>
        <View>
          <Button
            label="🔔"
            variant="secondary"
            style={styles.bell}
            onPress={() => router.push(Routes.notifications)}
          />
          <Badge count={inviteCount} floating />
        </View>
      </View>

      <Typography variant="h2">Play</Typography>
      {matchmaking.searching ? (
        <>
          <Button label="Searching for opponent…" loading disabled onPress={matchmaking.cancel} />
          <Button label="Cancel search" variant="ghost" onPress={matchmaking.cancel} />
        </>
      ) : (
        <>
          {/* Quick Match: any board, matched with whoever's waiting. */}
          <Button label="Quick Match" onPress={() => void matchmaking.start({ flexible: true })} />
          <Card>
            <Typography variant="caption" muted>
              Or pick a board
            </Typography>
            <SegmentedControl
              value={pickedBoard}
              onChange={setPickedBoard}
              options={BOARD_VARIANTS.map((v) => ({ label: `${v.size}×${v.size}`, value: v.size }))}
            />
            <Button
              label={`Find ${pickedLabel} match`}
              variant="secondary"
              onPress={() => void matchmaking.start({ flexible: false, boardSize: pickedBoard })}
            />
          </Card>
        </>
      )}
      <Button
        label="Local Play"
        variant="secondary"
        onPress={() => router.push(Routes.localGame)}
      />
      <Button
        label="Custom Room"
        variant="secondary"
        onPress={() => router.push(Routes.createRoom)}
      />

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
        <View style={styles.gridItem}>
          <Button
            label="Requests"
            variant="secondary"
            style={styles.fill}
            onPress={() => router.push(Routes.friendRequests)}
          />
          <Badge count={incomingRequests.length} floating />
        </View>
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  profileCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  profileText: { flex: 1 },
  bell: { height: 52, width: 52, paddingHorizontal: 0 },
  sectionTop: { marginTop: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  fill: { width: '100%' },
});
