import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { FrameDots, Typography } from '@/components/ui';
import type { ConnectionStatus } from '@/store';
import { spacing } from '@/theme';
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
      <FrameDots color={colors.warning} size={8} />
      <Typography variant="caption" color={colors.ink}>
        {message}
      </Typography>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    banner: {
      alignSelf: 'center',
      position: 'relative',
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 3,
      borderWidth: 2,
      borderColor: colors.warning,
    },
  });
