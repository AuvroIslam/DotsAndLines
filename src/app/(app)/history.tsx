import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Loader, Screen, Typography } from '@/components/ui';
import { useMatchHistory } from '@/features/profile';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import type { MatchOutcome } from '@/types';

const OUTCOME_COLOR: Record<MatchOutcome, string> = {
  win: theme.colors.success,
  loss: theme.colors.danger,
  draw: theme.colors.warning,
};

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

  if (isLoading) return <Loader message="Loading history…" />;

  return (
    <Screen>
      <FlatList
        data={history ?? []}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <EmptyState
            emoji="🎮"
            title="No matches yet"
            subtitle="Play a game to start your history."
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={[styles.badge, { backgroundColor: OUTCOME_COLOR[item.outcome] }]}>
              <Typography variant="caption" color={theme.colors.bg}>
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
            <Typography variant="h3">{item.myScore}</Typography>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  badge: { borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 },
  info: { flex: 1 },
});
