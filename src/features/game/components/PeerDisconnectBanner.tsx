import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Typography } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';
import type { GameState, PlayerId } from '@/types';

import type { PendingForfeit } from '../hooks/forfeitTiming';

interface PeerDisconnectBannerProps {
  game: GameState;
  pendingForfeits: Record<PlayerId, PendingForfeit>;
}

/** Per-peer "disconnected — forfeiting in Ns" banner shown during the reconnect grace period. */
export function PeerDisconnectBanner({ game, pendingForfeits }: PeerDisconnectBannerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const entries = Object.entries(pendingForfeits);
  if (entries.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
      {entries.map(([peerId, { remainingMs }]) => (
        <Typography key={peerId} variant="caption" color={colors.bg}>
          {game.players[peerId]?.displayName ?? 'Opponent'} disconnected — forfeiting in{' '}
          {Math.ceil(remainingMs / 1000)}s
        </Typography>
      ))}
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
      gap: 2,
    },
  });
