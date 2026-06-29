import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Typography } from '@/components/ui';
import { theme } from '@/theme';
import type { GameState } from '@/types';

interface GameOverlayProps {
  game: GameState;
  myPlayerId: string | null;
  onExit: () => void;
  onRematch?: () => void;
}

/** Winner / draw screen shown when the game finishes. */
export function GameOverlay({ game, myPlayerId, onExit, onRematch }: GameOverlayProps) {
  const result = game.result;
  if (!result) return null;

  const iWon = !!myPlayerId && result.winners.includes(myPlayerId);
  const title = result.isDraw ? "It's a Draw!" : iWon ? 'You Win! 🎉' : 'You Lose';
  const winnerNames = result.winners
    .map((id) => game.players[id]?.displayName)
    .filter(Boolean)
    .join(', ');

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.backdrop}>
      <View style={styles.card}>
        <Typography variant="h1" center>
          {result.isDraw ? '🤝' : iWon ? '🏆' : '😔'}
        </Typography>
        <Typography variant="h2" center>
          {title}
        </Typography>
        {!result.isDraw ? (
          <Typography variant="body" muted center>
            Winner: {winnerNames}
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

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  scores: { gap: theme.spacing.sm, marginVertical: theme.spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  scoreName: { flex: 1 },
});
