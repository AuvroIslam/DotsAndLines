import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Avatar, Button, Card, PageIntro, Screen, TextField, Typography } from '@/components/ui';
import { Routes } from '@/navigation/routes';
import { useAuthStore, useProfileStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const isSaving = useProfileStore((s) => s.isSaving);
  const colors = useThemeColors();

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
    <Screen scroll contentStyle={styles.content}>
      <PageIntro
        title="Player Card"
        subtitle="Make your name memorable on every grid."
        accent={colors.accent}
      />
      <Card style={[styles.header, { borderColor: colors.accent }]}>
        <Avatar name={profile?.displayName ?? 'Player'} uri={profile?.photoURL} size={84} />
        <Typography variant="h2">{profile?.displayName ?? 'Player'}</Typography>
        <Typography variant="caption" muted>
          {profile?.provider === 'anonymous' ? 'Guest account' : 'Google account'}
        </Typography>
      </Card>

      <Card style={{ borderColor: colors.primary }}>
        <Typography variant="h3">Edit your badge</Typography>
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
        <Button
          label="Save changes"
          icon="checkmark-circle"
          loading={isSaving}
          onPress={handleSave}
        />
        {savedAt ? (
          <Typography variant="caption" color={colors.success}>
            Saved!
          </Typography>
        ) : null}
      </Card>

      <Button
        label="View Statistics"
        icon="stats-chart"
        variant="secondary"
        onPress={() => router.push(Routes.statistics)}
      />
      <Button
        label="Settings"
        icon="settings"
        variant="secondary"
        onPress={() => router.push(Routes.settings)}
      />
      <Button label="Sign out" icon="log-out" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 620 },
  header: { alignItems: 'center', gap: spacing.sm },
});
