import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

import { Typography } from './Typography';

export function Loader({ message }: { message?: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Typography variant="body" muted>
          {message}
        </Typography>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.bg,
    },
  });
