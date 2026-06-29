import { StyleSheet, View } from 'react-native';

import { Card, Loader, Screen, Typography } from '@/components/ui';
import { useStatistics } from '@/features/profile';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={styles.tile}>
      <Typography variant="h1">{value}</Typography>
      <Typography variant="caption" muted>
        {label}
      </Typography>
    </Card>
  );
}

export default function StatisticsScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { data: stats, isLoading } = useStatistics(uid);

  if (isLoading) return <Loader message="Loading stats…" />;

  const s = stats ?? {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalBoxesWon: 0,
    winStreak: 0,
    bestWinStreak: 0,
  };
  const winRate = s.gamesPlayed ? Math.round((s.wins / s.gamesPlayed) * 100) : 0;

  return (
    <Screen scroll>
      <View style={styles.grid}>
        <StatTile label="Games" value={s.gamesPlayed} />
        <StatTile label="Win rate" value={`${winRate}%`} />
        <StatTile label="Wins" value={s.wins} />
        <StatTile label="Losses" value={s.losses} />
        <StatTile label="Draws" value={s.draws} />
        <StatTile label="Boxes won" value={s.totalBoxesWon} />
        <StatTile label="Win streak" value={s.winStreak} />
        <StatTile label="Best streak" value={s.bestWinStreak} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  tile: { flexBasis: '47%', flexGrow: 1, alignItems: 'center' },
});
