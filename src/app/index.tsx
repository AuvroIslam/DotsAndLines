import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLockup, PlayerDuoArt, PlayfulBackground, Typography } from '@/components/ui';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

/**
 * Splash / landing at "/". The root layout's auth gate immediately redirects to
 * the (auth) or (app) group once auth status resolves, so this is only visible
 * for a frame during cold start.
 */
export default function Splash() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <PlayfulBackground />
      <BrandLockup />
      <PlayerDuoArt size={190} />
      <Typography variant="body" muted>
        Draw. Claim. Cheer.
      </Typography>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      gap: spacing.sm,
    },
  });
