import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLockup, Button, PlayerDuoArt, Screen, Typography } from '@/components/ui';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

export default function SignInScreen() {
  const signInAsGuest = useAuthStore((s) => s.signInAsGuest);
  const error = useAuthStore((s) => s.error);
  const google = useGoogleAuth();
  const [busy, setBusy] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleGuest = async () => {
    setBusy(true);
    try {
      await signInAsGuest();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandLockup />
        <PlayerDuoArt size={230} />
        <Typography
          variant="body"
          muted
          center
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          style={styles.singleLineTagline}
        >
          Draw a line. Complete a square. Outsmart your friends.
        </Typography>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          icon="logo-google"
          frameColor={colors.primary}
          onPress={() => google.signIn()}
          disabled={!google.ready}
          loading={google.submitting}
        />
        <Button
          label="Play as Guest"
          icon="sparkles"
          variant="secondary"
          frameColor={colors.accent}
          onPress={handleGuest}
          loading={busy}
        />
        {error ? (
          <Typography variant="caption" color={colors.danger} center>
            {error}
          </Typography>
        ) : null}
      </View>
      <Typography
        variant="caption"
        muted
        center
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
        style={styles.singleLineTagline}
      >
        A friendly strategy game for quick matches and couch battles.
      </Typography>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { justifyContent: 'center', paddingVertical: spacing.xl, maxWidth: 520 },
    hero: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    singleLineTagline: {
      width: '100%',
      alignSelf: 'stretch',
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: -0.2,
      includeFontPadding: false,
    },
    actions: {
      width: '100%',
      gap: spacing.xl,
    },
  });
