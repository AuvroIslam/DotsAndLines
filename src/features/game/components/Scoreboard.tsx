import { StyleSheet, View } from 'react-native';

import { Typography } from '@/components/ui';
import { theme } from '@/theme';
import type { GameState } from '@/types';

interface ScoreboardProps {
  game: GameState;
  myPlayerId: string | null;
}

/** Per-player score chips; the active player's chip is highlighted. */
export function Scoreboard({ game, myPlayerId }: ScoreboardProps) {
  const players = game.turnOrder.map((id) => game.players[id]).filter(Boolean);
  return (
    <View style={styles.row}>
      {players.map((p) => {
        const active = game.currentTurn === p!.id && game.phase === 'playing';
        return (
          <View
            key={p!.id}
            style={[
              styles.chip,
              { borderColor: p!.color },
              active && { backgroundColor: p!.color + '22' },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: p!.color }]} />
            <View>
              <Typography variant="caption" muted>
                {p!.uid === myPlayerId || p!.id === myPlayerId ? 'You' : p!.displayName}
                {!p!.isConnected ? ' ·offline' : ''}
              </Typography>
              <Typography variant="h3">{p!.score}</Typography>
            </View>
            {active ? <View style={[styles.activePulse, { backgroundColor: p!.color }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1.5,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  activePulse: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
});
