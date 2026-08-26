import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Avatar, Button, Card, PageIntro, Screen, TextField, Typography } from '@/components/ui';
import { useRequireGoogleAuth } from '@/hooks/useRequireGoogleAuth';
import { Routes } from '@/navigation/routes';
import { useAuthStore, useProfileStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const setProfile = useAuthStore((s) => s.setProfile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const isSaving = useProfileStore((s) => s.isSaving);
  const { guard } = useRequireGoogleAuth();
  const colors = useThemeColors();

  const isGuest = profile?.provider === 'anonymous';

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleSave = async () => {
    if (!profile) return;
    if (isGuest) {
      setProfile({
        ...profile,
        displayName: displayName.trim() || 'Guest Player',
      });
      setSavedAt(Date.now());
      return;
    }
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
          {isGuest ? 'Playing as Guest' : 'Google account'}
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
        {!isGuest ? (
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            error={error}
          />
        ) : null}
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

      {isGuest ? (
        <Card style={[styles.guestCard, { borderColor: colors.primary }]}>
          <Typography variant="h3" center>
            Unlock Online Play
          </Typography>
          <Typography variant="caption" muted center>
            Sign in with Google to challenge friends online, track your statistics, and climb the leaderboard!
          </Typography>
          <Button
            label="Sign In with Google"
            icon="logo-google"
            onPress={async () => {
              await guard();
            }}
          />
        </Card>
      ) : (
        <Button
          label="View Statistics"
          icon="stats-chart"
          variant="secondary"
          onPress={() => router.push(Routes.statistics)}
        />
      )}

      <Button
        label="Settings"
        icon="settings"
        variant="secondary"
        onPress={() => router.push(Routes.settings)}
      />

      {!isGuest ? (
        <Button label="Sign out" icon="log-out" variant="danger" onPress={() => void signOut()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 620, gap: spacing.md },
  header: { alignItems: 'center', gap: spacing.sm },
  guestCard: { gap: spacing.sm, alignItems: 'center' },
});

