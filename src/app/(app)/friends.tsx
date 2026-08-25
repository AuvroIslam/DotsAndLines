import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  PageIntro,
  Screen,
  SegmentedControl,
  TextField,
  Typography,
} from '@/components/ui';
import { useFriends, useFriendsPresence } from '@/features/friends';
import { Routes } from '@/navigation/routes';
import { invitationRepository, roomRepository } from '@/services/firebase';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';
import type { BoardSize } from '@/types';
import { alertActionFailed, BOARD_VARIANTS, DEFAULT_BOARD } from '@/utils';

export default function FriendsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const { friends, searchResults, isSearching, search, sendRequest, removeFriend } = useFriends();
  const [queryText, setQueryText] = useState('');
  // Rows we've just sent a request to, so the button reflects it without a
  // separate outgoing-requests listener.
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  // Board an invite creates its room on (the inviter is the host, so they choose).
  const [inviteBoard, setInviteBoard] = useState<BoardSize>(DEFAULT_BOARD);
  const colors = useThemeColors();

  const friendUids = new Set(friends.map((f) => f.uid));
  const online = useFriendsPresence(friends.map((f) => f.uid));

  const onSearch = (text: string) => {
    setQueryText(text);
    void search(text);
  };

  const onAdd = async (uid: string) => {
    const result = await sendRequest(uid);
    if (result === 'sent' || result === 'already-requested')
      setRequested((r) => ({ ...r, [uid]: true }));
    if (result === 'befriended') setRequested((r) => ({ ...r, [uid]: false }));
    // A user-initiated tap must not fail in silence (the store swallows the error).
    if (result == null) alertActionFailed('Could not send request');
  };

  const onRemove = (uid: string, name: string) => {
    Alert.alert('Remove friend?', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            const ok = await removeFriend(uid);
            if (ok === false) alertActionFailed('Could not remove');
          })(),
      },
    ]);
  };

  const invite = async (friendUid: string) => {
    if (!profile) return;
    try {
      const room = await roomRepository.createRoom({
        host: { uid: profile.uid, displayName: profile.displayName },
        mode: 'friend',
        boardSize: inviteBoard,
        maxPlayers: 2,
      });
      // Deliver the invite so the friend actually sees it (their notification bell),
      // then wait in the lobby for them to join. Only navigate once it's delivered.
      await invitationRepository.send(profile, friendUid, room.id, room.code, inviteBoard);
      router.replace(Routes.lobby(room.id));
    } catch {
      // A failed write must not leak an uncaught rejection; a leftover room is
      // reaped by the stale-room sweep.
      alertActionFailed('Could not send invite');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro
        title="Friends"
        subtitle="Find a playmate, see who's online, and send a challenge."
        accent={colors.primary}
      />
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
            <Card key={u.uid} style={[styles.row, { borderColor: colors.primary }]}>
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
                <Button
                  label="Add"
                  icon="person-add"
                  onPress={() => void onAdd(u.uid)}
                  style={styles.smallBtn}
                />
              )}
            </Card>
          ))}
        </View>
      ) : null}

      <Typography variant="h3" style={styles.section}>
        Friends
      </Typography>
      {friends.length > 0 ? (
        <Card style={{ borderColor: colors.warning }}>
          <Typography variant="caption" muted>
            Invite board
          </Typography>
          <SegmentedControl
            value={inviteBoard}
            onChange={setInviteBoard}
            options={BOARD_VARIANTS.map((v) => ({ label: `${v.size}×${v.size}`, value: v.size }))}
          />
        </Card>
      ) : null}
      <FlatList
        data={friends}
        keyExtractor={(f) => f.uid}
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            title="No friends yet"
            subtitle="Search by username to send your first request."
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={[styles.row, online[item.uid] && { borderColor: colors.success }]}>
            <Avatar name={item.displayName} uri={item.photoURL} size={40} color={colors.success} />
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
              icon="paper-plane"
              onPress={() => void invite(item.uid)}
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
  content: { maxWidth: 700 },
  section: { marginTop: spacing.sm },
  stateLabel: { paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1 },
  smallBtn: { minHeight: 42, height: 42, paddingHorizontal: spacing.md },
  iconBtn: { minHeight: 42, height: 42, width: 42, paddingHorizontal: 0 },
});
