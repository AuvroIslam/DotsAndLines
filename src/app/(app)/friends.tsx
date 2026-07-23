import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, Screen, TextField, Typography } from '@/components/ui';
import { useFriends, useFriendsPresence } from '@/features/friends';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

export default function FriendsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { friends, searchResults, isSearching, search, sendRequest, removeFriend } = useFriends();
  const [queryText, setQueryText] = useState('');
  // Rows we've just sent a request to, so the button reflects it without a
  // separate outgoing-requests listener.
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const colors = useThemeColors();

  const friendUids = new Set(friends.map((f) => f.uid));
  const online = useFriendsPresence(friends.map((f) => f.uid));

  const onSearch = (text: string) => {
    setQueryText(text);
    void search(text);
  };

  const onAdd = async (uid: string) => {
    const result = await sendRequest(uid);
    if (result === 'sent' || result === 'already-requested') setRequested((r) => ({ ...r, [uid]: true }));
    if (result === 'befriended') setRequested((r) => ({ ...r, [uid]: false }));
  };

  const onRemove = (uid: string, name: string) => {
    Alert.alert('Remove friend?', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeFriend(uid) },
    ]);
  };

  const invite = async (friendUid: string, friendName: string) => {
    if (!profile) return;
    const room = await roomRepository.createRoom({
      host: { uid: profile.uid, displayName: profile.displayName },
      mode: 'friend',
      boardSize: 3,
      maxPlayers: 2,
    });
    // Friend receives the code (and, with FCM wired, a push) to join the lobby.
    void friendName;
    router.replace(Routes.lobby(room.id));
  };

  return (
    <Screen>
      <TextField
        label="Find players"
        placeholder="Search by username"
        autoCapitalize="none"
        value={queryText}
        onChangeText={onSearch}
      />

      {queryText.length >= 2 ? (
        <View style={styles.section}>
          <Typography variant="caption" muted>
            {isSearching ? 'Searching…' : 'Results'}
          </Typography>
          {searchResults.map((u) => (
            <Card key={u.uid} style={styles.row}>
              <Avatar name={u.displayName} uri={u.photoURL} size={40} />
              <View style={styles.info}>
                <Typography variant="body">{u.displayName}</Typography>
                <Typography variant="caption" muted>
                  @{u.username}
                </Typography>
              </View>
              {friendUids.has(u.uid) ? (
                <Typography variant="caption" muted style={styles.stateLabel}>
                  Friends
                </Typography>
              ) : requested[u.uid] ? (
                <Typography variant="caption" muted style={styles.stateLabel}>
                  Requested
                </Typography>
              ) : (
                <Button label="Add" onPress={() => void onAdd(u.uid)} style={styles.smallBtn} />
              )}
            </Card>
          ))}
        </View>
      ) : null}

      <Typography variant="h3" style={styles.section}>
        Friends
      </Typography>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.uid}
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            emoji="👋"
            title="No friends yet"
            subtitle="Search by username to send your first request."
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <Avatar
              name={item.displayName}
              uri={item.photoURL}
              size={40}
              color={colors.success}
            />
            <View style={styles.info}>
              <Typography variant="body">{item.displayName}</Typography>
              <Typography
                variant="caption"
                color={online[item.uid] ? colors.success : colors.textMuted}
              >
                {online[item.uid] ? 'Online' : 'Offline'}
              </Typography>
            </View>
            <Button
              label="Invite"
              onPress={() => void invite(item.uid, item.displayName)}
              style={styles.smallBtn}
            />
            <Button
              label="✕"
              variant="ghost"
              onPress={() => onRemove(item.uid, item.displayName)}
              style={styles.iconBtn}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm },
  stateLabel: { paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1 },
  smallBtn: { height: 40, paddingHorizontal: spacing.md },
  iconBtn: { height: 40, width: 40, paddingHorizontal: 0 },
});
