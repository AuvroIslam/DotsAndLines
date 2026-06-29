import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Typography } from '@/components/ui';
import type { ConnectionStatus } from '@/store';
import { theme } from '@/theme';

const MESSAGES: Partial<Record<ConnectionStatus, string>> = {
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'You are offline — moves will sync when you reconnect',
};

/** Non-blocking banner surfaced while the realtime connection is degraded. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const message = MESSAGES[status];
  if (!message) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
      <Typography variant="caption" color={theme.colors.bg}>
        {message}
      </Typography>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'center',
    backgroundColor: theme.colors.warning,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
  },
});
