import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, Screen, TextField, Typography } from '@/components/ui';
import { useFriends } from '@/features/friends';
import { Routes } from '@/navigation/routes';
import { roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { friends, searchResults, isSearching, search, sendRequest, removeFriend } = useFriends();
  const [queryText, setQueryText] = useState('');

  const onSearch = (text: string) => {
    setQueryText(text);
    void search(text);
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
              <Button label="Add" onPress={() => void sendRequest(u.uid)} style={styles.smallBtn} />
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
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <Avatar
              name={item.displayName}
              uri={item.photoURL}
              size={40}
              color={theme.colors.success}
            />
            <View style={styles.info}>
              <Typography variant="body">{item.displayName}</Typography>
              <Typography
                variant="caption"
                color={item.isOnline ? theme.colors.success : theme.colors.textMuted}
              >
                {item.isOnline ? 'Online' : 'Offline'}
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
              onPress={() => void removeFriend(item.uid)}
              style={styles.iconBtn}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  info: { flex: 1 },
  smallBtn: { height: 40, paddingHorizontal: theme.spacing.md },
  iconBtn: { height: 40, width: 40, paddingHorizontal: 0 },
});
