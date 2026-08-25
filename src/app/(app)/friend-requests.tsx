import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, PageIntro, Screen, Typography } from '@/components/ui';
import { useFriends } from '@/features/friends';
import { theme } from '@/theme';
import type { FriendRequest } from '@/types';
import { alertActionFailed } from '@/utils';

export default function FriendRequestsScreen() {
  const { profile, incomingRequests, acceptRequest, declineRequest } = useFriends();

  const onAccept = async (req: FriendRequest) => {
    if (!profile) return;
    const ok = await acceptRequest(req, profile);
    if (!ok) alertActionFailed('Could not accept');
  };

  const onDecline = async (req: FriendRequest) => {
    const ok = await declineRequest(req.id);
    if (!ok) alertActionFailed('Could not decline');
  };

  if (incomingRequests.length === 0) {
    return (
      <Screen contentStyle={styles.content}>
        <PageIntro title="Friend Requests" subtitle="New challengers land here." />
        <EmptyState title="No pending requests" subtitle="You're all caught up." />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro title="Friend Requests" subtitle="Say hello to a new challenger." />
      {incomingRequests.map((req) => (
        <Card key={req.id} style={styles.row}>
          <Avatar name={req.fromDisplayName} size={44} />
          <View style={styles.info}>
            <Typography variant="body">{req.fromDisplayName}</Typography>
            <Typography variant="caption" muted>
              @{req.fromUsername}
            </Typography>
          </View>
          <Button
            label="Accept"
            icon="checkmark"
            style={styles.smallBtn}
            onPress={() => void onAccept(req)}
          />
          <Button
            label="Decline"
            variant="secondary"
            style={styles.smallBtn}
            onPress={() => void onDecline(req)}
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
