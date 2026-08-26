import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, PageIntro, Screen, Typography } from '@/components/ui';
import { useGameInvites } from '@/features/notifications';
import { Routes } from '@/navigation/routes';
import { invitationRepository, roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';
import { alertActionFailed, BOARD_VARIANTS } from '@/utils';

export default function NotificationsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { invites } = useGameInvites();
  const colors = useThemeColors();

  const boardLabel = (size: number) =>
    BOARD_VARIANTS.find((v) => v.size === size)?.label ?? `${size}×${size}`;

  const join = async (roomId: string) => {
    if (!profile) return;
    try {
      const res = await roomRepository.joinRoom(roomId, {
        uid: profile.uid,
        displayName: profile.displayName,
      });
      // Either way the invite has served its purpose — drop it.
      void invitationRepository.remove(profile.uid, roomId);
      if (res.ok) {
        router.replace(Routes.lobby(roomId));
      } else {
        Alert.alert(
          'Invite expired',
          res.reason === 'full' ? 'That room is full.' : 'That game is no longer available.',
        );
      }
    } catch {
      // The join transaction can reject (network); don't leak an uncaught rejection.
      alertActionFailed('Could not join');
    }
  };

  const dismiss = (roomId: string) => {
    if (profile) void invitationRepository.remove(profile.uid, roomId);
  };

  if (invites.length === 0) {
    return (
      <Screen contentStyle={styles.content}>
        <PageIntro
          title="Game Invites"
          subtitle="Challenges from your friends."
          accent={colors.warning}
        />
        <EmptyState title="No invites" subtitle="Game invitations from friends show up here." />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro
        title="Game Invites"
        subtitle="A friend is calling you to the grid."
        accent={colors.warning}
      />
      {invites.map((inv) => (
        <Card key={inv.roomId} style={[styles.row, { borderColor: colors.warning }]}>
          <Avatar name={inv.fromName} size={44} />
          <View style={styles.info}>
            <Typography variant="body">{inv.fromName}</Typography>
            <Typography variant="caption" muted>
              invited you — {boardLabel(inv.boardSize)}
            </Typography>
          </View>
          <Button
            label="Join"
            icon="enter"
            style={styles.smallBtn}
            onPress={() => void join(inv.roomId)}
          />
          <Button
            label="Dismiss"
            variant="secondary"
            style={styles.smallBtn}
            onPress={() => dismiss(inv.roomId)}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 680 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  info: { flex: 1 },
  smallBtn: { minHeight: 42, height: 42, paddingHorizontal: theme.spacing.sm },
});
