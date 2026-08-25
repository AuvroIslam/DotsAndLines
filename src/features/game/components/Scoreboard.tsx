import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { FrameDots, Typography } from '@/components/ui';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';
import type { GamePresence, GameState } from '@/types';

interface ScoreboardProps {
  game: GameState;
  /** Streamed separately from the game — see `PlayerPresence`. Purely cosmetic. */
  presence: GamePresence;
  myPlayerId: string | null;
}

/** Per-player score chips; the active player's chip is highlighted. */
export function Scoreboard({ game, presence, myPlayerId }: ScoreboardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const players = game.turnOrder.map((id) => game.players[id]).filter(Boolean);
  return (
    <View style={styles.row}>
      {players.map((p) => {
        const active = game.currentTurn === p!.id && game.phase === 'playing';
        const disconnected = presence[p!.id]?.isConnected === false;
        const displayName = p!.uid === myPlayerId || p!.id === myPlayerId ? 'You' : p!.displayName;
        return (
          <View
            key={p!.id}
            style={[styles.chip, { borderColor: p!.color }, active && styles.activeChip]}
          >
            <FrameDots color={p!.color} size={9} />
            <View style={styles.nameRow}>
              <View style={[styles.dot, { backgroundColor: p!.color }]} />
              <Typography
                variant="caption"
                center
                numberOfLines={1}
                color={active ? p!.color : colors.textMuted}
                style={styles.name}
              >
                {displayName}
              </Typography>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: p!.isEliminated || disconnected ? colors.dotIdle : p!.color },
                ]}
              />
            </View>
            <Typography variant="h2" center style={styles.score}>
              {p!.score}
            </Typography>
            <Typography
              variant="caption"
              center
              color={active ? p!.color : colors.textMuted}
              style={styles.state}
            >
              {p!.isEliminated ? 'LEFT' : disconnected ? 'OFFLINE' : active ? 'PLAYING' : 'READY'}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    chip: {
      flexBasis: 132,
      flexGrow: 1,
      maxWidth: 220,
      minHeight: 94,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderRadius: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 0,
      elevation: 2,
    },
    activeChip: { backgroundColor: colors.surfaceAlt, transform: [{ translateY: -2 }] },
    nameRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: { flex: 1, includeFontPadding: false },
    dot: { width: 11, height: 11, borderRadius: 6 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    score: { lineHeight: 31, includeFontPadding: false },
    state: { fontSize: 10, lineHeight: 13, letterSpacing: 1.1, includeFontPadding: false },
  });
