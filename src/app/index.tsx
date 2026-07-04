import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui';
import { radius, spacing } from '@/theme';
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
      <View style={styles.logo}>
        <Typography variant="h1">⬛</Typography>
      </View>
      <Typography variant="h1">Dots & Boxes</Typography>
      <Typography variant="body" muted>
        Connect the dots. Claim the boxes.
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
    logo: {
      width: 96,
      height: 96,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
  });
