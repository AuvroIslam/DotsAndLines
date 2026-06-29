import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Screen, TextField, Typography } from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { useAuthStore, useProfileStore } from '@/store';
import { theme } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const isSaving = useProfileStore((s) => s.isSaving);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSave = async () => {
    if (!profile) return;
    setError(null);
    const res = await updateProfile(profile.uid, {
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
    });
    if (!res.ok) {
      setError(res.reason === 'username_taken' ? 'That username is taken' : 'Could not save');
    } else {
      setSavedAt(Date.now());
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={profile?.displayName ?? 'Player'} uri={profile?.photoURL} size={84} />
        <Typography variant="caption" muted>
          {profile?.provider === 'anonymous' ? 'Guest account' : 'Google account'}
        </Typography>
      </View>

      <Card>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={24}
        />
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={error}
        />
        <Button label="Save changes" loading={isSaving} onPress={handleSave} />
        {savedAt ? (
          <Typography variant="caption" color={theme.colors.success}>
            Saved!
          </Typography>
        ) : null}
      </Card>

      <Button
        label="View Statistics"
        variant="secondary"
        onPress={() => router.push(Routes.statistics)}
      />
      <Button label="Settings" variant="secondary" onPress={() => router.push(Routes.settings)} />
      <Button label="Sign out" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: theme.spacing.sm },
});
