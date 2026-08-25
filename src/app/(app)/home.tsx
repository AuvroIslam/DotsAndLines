import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  BrandLockup,
  Button,
  Card,
  PlayerDuoArt,
  MenuCard,
  Screen,
  SegmentedControl,
  Typography,
} from '@/components/ui';
import { useFriends } from '@/features/friends';
import { useRandomMatchmaking } from '@/features/game/hooks/useRandomMatchmaking';
import { useGameInvites } from '@/features/notifications';
import { Routes } from '@/navigation/routes';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';
import type { BoardSize } from '@/types';
import { BOARD_VARIANTS, DEFAULT_BOARD } from '@/utils';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const matchmaking = useRandomMatchmaking();
  const { incomingRequests } = useFriends();
  const { count: inviteCount } = useGameInvites();
  const [pickedBoard, setPickedBoard] = useState<BoardSize>(DEFAULT_BOARD);
  const colors = useThemeColors();
  const pickedLabel =
    BOARD_VARIANTS.find((v) => v.size === pickedBoard)?.label ?? `${pickedBoard}×${pickedBoard}`;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.topRow}>
        <Card onPress={() => router.push(Routes.profile)} style={styles.profileCard}>
          <Avatar name={profile?.displayName ?? 'Player'} uri={profile?.photoURL} size={46} />
          <View style={styles.profileText}>
            <Typography variant="caption" muted>
              Welcome back
            </Typography>
            <Typography variant="h3" numberOfLines={1}>
              {profile?.displayName ?? 'Player'}
            </Typography>
          </View>
        </Card>
        <View>
          <Button
            label=""
            icon="notifications"
            accessibilityLabel="Open game invitations"
            variant="secondary"
            style={styles.bell}
            onPress={() => router.push(Routes.notifications)}
          />
          <Badge count={inviteCount} floating />
        </View>
      </View>

      <Card style={[styles.heroCard, { borderColor: colors.primary }]}>
        <View style={styles.heroCopy}>
          <BrandLockup compact />
          <Typography variant="caption" muted center>
            Every dot is a tiny decision.
          </Typography>
        </View>
        <PlayerDuoArt size={138} style={styles.heroArt} />
      </Card>

      <View style={styles.sectionHeading}>
        <Typography variant="h2">Choose your arena</Typography>
        <Typography variant="caption" color={colors.warning}>
          PLAY
        </Typography>
      </View>
      {matchmaking.searching ? (
        <Card style={[styles.searchCard, { borderColor: colors.primary }]}>
          <PlayerDuoArt size={104} />
          <Typography variant="h3" center>
            Scouting the grid…
          </Typography>
          <Typography variant="caption" muted center>
            Finding a worthy opponent for your next duel.
          </Typography>
          <Button label="Cancel search" variant="ghost" icon="close" onPress={matchmaking.cancel} />
        </Card>
      ) : (
        <>
          <MenuCard
            title="Quick Match"
            subtitle="Jump into the first open game"
            icon="flash"
            accent={colors.primary}
            onPress={() => void matchmaking.start({ flexible: true })}
          />
          <Card style={[styles.boardPicker, { borderColor: colors.warning }]}>
            <View style={styles.pickerTitle}>
              <View>
                <Typography variant="h3">Pick your grid</Typography>
                <Typography variant="caption" muted>
                  Match with the same board size
                </Typography>
              </View>
              <Typography variant="h2" color={colors.warning}>
                {pickedBoard}×{pickedBoard}
              </Typography>
            </View>
            <SegmentedControl
              value={pickedBoard}
              onChange={setPickedBoard}
              options={BOARD_VARIANTS.map((v) => ({ label: `${v.size}×${v.size}`, value: v.size }))}
            />
            <Button
              label={`Find a ${pickedLabel} match`}
              icon="search"
              variant="secondary"
              onPress={() => void matchmaking.start({ flexible: false, boardSize: pickedBoard })}
            />
          </Card>
        </>
      )}
      <View style={styles.modeGrid}>
        <MenuCard
          title="Couch Duel"
          subtitle="Share one device"
          icon="people"
          accent={colors.accent}
          compact
          style={styles.modeItem}
          onPress={() => router.push(Routes.localGame)}
        />
        <MenuCard
          title="Friend Room"
          subtitle="Create or join"
          icon="ticket"
          accent={colors.warning}
          compact
          style={styles.modeItem}
          onPress={() => router.push(Routes.createRoom)}
        />
      </View>

      <View style={[styles.sectionHeading, styles.sectionTop]}>
        <Typography variant="h2">Clubhouse</Typography>
        <Typography variant="caption" color={colors.accent}>
          CONNECT
        </Typography>
      </View>
      <View style={styles.grid}>
        <MenuCard
          title="Friends"
          subtitle="Your playmates"
          icon="happy"
          accent={colors.primary}
          compact
          style={styles.gridItem}
          onPress={() => router.push(Routes.friends)}
        />
        <MenuCard
          title="Requests"
          subtitle="New teammates"
          icon="person-add"
          accent={colors.warning}
          compact
          badge={incomingRequests.length}
          style={styles.gridItem}
          onPress={() => router.push(Routes.friendRequests)}
        />
        <MenuCard
          title="History"
          subtitle="Past showdowns"
          icon="time"
          accent={colors.purple}
          compact
          style={styles.gridItem}
          onPress={() => router.push(Routes.history)}
        />
        <MenuCard
          title="Scorebook"
          subtitle="Your best numbers"
          icon="stats-chart"
          accent={colors.success}
          compact
          style={styles.gridItem}
          onPress={() => router.push(Routes.statistics)}
        />
      </View>

      <Button
        label="Settings"
        icon="settings"
        variant="ghost"
        onPress={() => router.push(Routes.settings)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 680 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  profileCard: {
    flex: 1,
    minHeight: 68,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  profileText: { flex: 1 },
  bell: { minHeight: 54, width: 54, paddingHorizontal: 0 },
  heroCard: {
    minHeight: 154,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: theme.spacing.sm,
  },
  heroCopy: { flex: 1, gap: theme.spacing.sm, alignItems: 'center' },
  heroArt: { marginRight: -10, marginVertical: -8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchCard: { alignItems: 'center' },
  boardPicker: { gap: theme.spacing.md },
  pickerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  modeItem: { flexBasis: 250, flexGrow: 1 },
  sectionTop: { marginTop: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  gridItem: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
});
