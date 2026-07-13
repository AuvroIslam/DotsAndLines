import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Typography } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';
import type { GameState } from '@/types';

interface GameOverlayProps {
  game: GameState;
  myPlayerId: string | null;
  onExit: () => void;
  onRematch?: () => void;
}

/** Winner / draw screen shown when the game finishes. */
export function GameOverlay({ game, myPlayerId, onExit, onRematch }: GameOverlayProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const result = game.result;
  if (!result) return null;

  const iWon = !!myPlayerId && result.winners.includes(myPlayerId);
  const isForfeit = result.reason === 'forfeit';
  const isTimeout = result.reason === 'timeout';
  // Nobody left playing — the match is void rather than won by whoever happened
  // to run out of turns second.
  const isNoContest = result.winners.length === 0;
  const winnerLabel = result.winners.map((id) => game.players[id]?.displayName).filter(Boolean).join(', ');

  const title = isNoContest
    ? 'No Contest'
    : result.isDraw
      ? "It's a Draw!"
      : myPlayerId === null
        ? `${winnerLabel} Wins!`
        : iWon
          ? isForfeit
            ? 'Opponent Forfeited — You Win!'
            : isTimeout
              ? 'Opponent Ran Out of Turns — You Win!'
              : 'You Win! 🎉'
          : isForfeit
            ? 'You Forfeited'
            : isTimeout
              ? 'You Missed Too Many Turns'
              : 'You Lose';

  const subtitle = isNoContest
    ? 'Both players stopped playing, so the match was voided.'
    : !result.isDraw
      ? `Winner: ${winnerLabel}`
      : null;
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.backdrop}>
      <View style={styles.card}>
        <Typography variant="h1" center>
          {isNoContest ? '🚫' : result.isDraw ? '🤝' : iWon || myPlayerId === null ? '🏆' : '😔'}
        </Typography>
        <Typography variant="h2" center>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body" muted center>
            {subtitle}
          </Typography>
        ) : null}

        <View style={styles.scores}>
          {game.turnOrder.map((id) => {
            const p = game.players[id];
            if (!p) return null;
            return (
              <View key={id} style={styles.scoreRow}>
                <View style={[styles.dot, { backgroundColor: p.color }]} />
                <Typography variant="body" style={styles.scoreName}>
                  {p.displayName}
                </Typography>
                <Typography variant="h3">{result.scores[id] ?? 0}</Typography>
              </View>
            );
          })}
        </View>

        {onRematch ? <Button label="Rematch" onPress={onRematch} /> : null}
        <Button label="Back to Home" variant="secondary" onPress={onExit} />
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.md,
    },
    scores: { gap: spacing.sm, marginVertical: spacing.sm },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: { width: 14, height: 14, borderRadius: 7 },
    scoreName: { flex: 1 },
  });
