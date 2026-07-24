import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, Screen, Typography } from '@/components/ui';
import { useGameInvites } from '@/features/notifications';
import { Routes } from '@/navigation/routes';
import { invitationRepository, roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import { BOARD_VARIANTS } from '@/utils';

export default function NotificationsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { invites } = useGameInvites();

  const boardLabel = (size: number) =>
    BOARD_VARIANTS.find((v) => v.size === size)?.label ?? `${size}×${size}`;

  const join = async (roomId: string) => {
    if (!profile) return;
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
  };

  const dismiss = (roomId: string) => {
    if (profile) void invitationRepository.remove(profile.uid, roomId);
  };

  if (invites.length === 0) {
    return (
      <Screen>
        <EmptyState emoji="🔔" title="No invites" subtitle="Game invitations from friends show up here." />
      </Screen>
    );
  }

  return (
    <Screen>
      {invites.map((inv) => (
        <Card key={inv.roomId} style={styles.row}>
          <Avatar name={inv.fromName} size={44} />
          <View style={styles.info}>
            <Typography variant="body">{inv.fromName}</Typography>
            <Typography variant="caption" muted>
              invited you — {boardLabel(inv.boardSize)}
            </Typography>
          </View>
          <Button label="Join" style={styles.smallBtn} onPress={() => void join(inv.roomId)} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  info: { flex: 1 },
  smallBtn: { height: 40, paddingHorizontal: theme.spacing.md },
});
