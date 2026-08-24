import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { Typography } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';
import type { GameState, PlayerId } from '@/types';

interface PeerDisconnectBannerProps {
  game: GameState;
  awayPeers: PlayerId[];
}

/**
 * "Opponent is reconnecting…" — shown while a peer looks away.
 *
 * Deliberately shows no forfeit countdown: being away doesn't lose you the
 * game, running out of turns does. Their turn clock is already on screen, and
 * it's the thing that actually decides the match.
 */
export function PeerDisconnectBanner({ game, awayPeers }: PeerDisconnectBannerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (awayPeers.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.banner}>
      {awayPeers.map((peerId) => (
        <Typography key={peerId} variant="caption" color={colors.bg}>
          {game.players[peerId]?.displayName ?? 'Opponent'} is reconnecting…
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
