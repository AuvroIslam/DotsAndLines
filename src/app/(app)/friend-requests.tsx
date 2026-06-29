import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, Screen, Typography } from '@/components/ui';
import { useFriends } from '@/features/friends';
import { theme } from '@/theme';

export default function FriendRequestsScreen() {
  const { profile, incomingRequests, acceptRequest, declineRequest } = useFriends();

  if (incomingRequests.length === 0) {
    return (
      <Screen>
        <EmptyState emoji="📬" title="No pending requests" subtitle="You're all caught up." />
      </Screen>
    );
  }

  return (
    <Screen>
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
            style={styles.smallBtn}
            onPress={() => profile && void acceptRequest(req, profile)}
          />
          <Button
            label="Decline"
            variant="secondary"
            style={styles.smallBtn}
            onPress={() => void declineRequest(req.id)}
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
