import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Loader, PageIntro, Screen, Typography } from '@/components/ui';
import { useMatchHistory } from '@/features/profile';
import { useAuthStore } from '@/store';
import { spacing } from '@/theme';
import { useThemeColors, type AppColors } from '@/theme/useTheme';
import type { MatchOutcome } from '@/types';

function outcomeColor(colors: AppColors): Record<MatchOutcome, string> {
  return {
    win: colors.success,
    loss: colors.danger,
    draw: colors.warning,
  };
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HistoryScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { data: history, isLoading } = useMatchHistory(uid);
  const colors = useThemeColors();
  const outcomeColors = useMemo(() => outcomeColor(colors), [colors]);

  if (isLoading) return <Loader message="Loading history…" />;

  return (
    <Screen contentStyle={styles.content}>
      <PageIntro
        title="Match History"
        subtitle="Every duel leaves a little trail."
        accent={colors.purple}
      />
      <FlatList
        data={history ?? []}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <EmptyState title="No matches yet" subtitle="Play a game to start your history." />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={[styles.row, { borderColor: outcomeColors[item.outcome] }]}>
            <View style={[styles.badge, { backgroundColor: outcomeColors[item.outcome] }]}>
              <Typography variant="caption" color={colors.ink}>
                {item.outcome.toUpperCase()}
              </Typography>
            </View>
            <View style={styles.info}>
              <Typography variant="body">
                {item.mode === 'random' ? 'Random' : 'Friend'} · {item.boardSize}×{item.boardSize} ·{' '}
                {item.playerCount}P
              </Typography>
              <Typography variant="caption" muted>
                vs {item.opponents.map((o) => o.displayName).join(', ') || '—'} ·{' '}
                {timeAgo(item.playedAt)}
              </Typography>
            </View>
            <View style={[styles.score, { borderColor: outcomeColors[item.outcome] }]}>
              <Typography variant="h3">{item.myScore}</Typography>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 680 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { borderRadius: 3, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  info: { flex: 1 },
  score: {
    minWidth: 44,
    height: 44,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
