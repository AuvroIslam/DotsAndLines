import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Typography } from '@/components/ui';
import type { ConnectionStatus } from '@/store';
import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';

const MESSAGES: Partial<Record<ConnectionStatus, string>> = {
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'You are offline — moves will sync when you reconnect',
};

/** Non-blocking banner surfaced while the realtime connection is degraded. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const message = MESSAGES[status];
  if (!message) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
      <Typography variant="caption" color={colors.bg}>
        {message}
      </Typography>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    banner: {
      alignSelf: 'center',
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
  });
