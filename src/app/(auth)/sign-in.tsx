import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

export default function SignInScreen() {
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const error = useAuthStore((s) => s.error);
  const google = useGoogleAuth();
  const [busy, setBusy] = useState(false);

  const handleAnonymous = async () => {
    setBusy(true);
    try {
      await signInAnonymously();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Typography variant="h1">⬛</Typography>
        </View>
        <Typography variant="h1" center>
          Dots & Boxes
        </Typography>
        <Typography variant="body" muted center>
          Play classic Dots & Boxes with friends or random opponents in realtime.
        </Typography>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          onPress={() => google.signIn()}
          disabled={!google.ready}
          loading={google.submitting}
        />
        <Button
          label="Play as Guest"
          variant="secondary"
          onPress={handleAnonymous}
          loading={busy}
        />
        {error ? (
          <Typography variant="caption" color={theme.colors.danger} center>
            {error}
          </Typography>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', paddingVertical: theme.spacing.xxl },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  logo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: theme.spacing.md },
});
