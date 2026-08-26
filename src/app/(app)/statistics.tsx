import { StyleSheet, View } from 'react-native';

import { Card, Loader, PageIntro, Screen, Typography } from '@/components/ui';
import { useStatistics } from '@/features/profile';
import { useAuthStore } from '@/store';
import { theme } from '@/theme';
import { useThemeColors } from '@/theme/useTheme';

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card style={[styles.tile, { borderColor: accent }]}>
      <View style={[styles.miniDot, { backgroundColor: accent }]} />
      <Typography variant="h1" color={accent}>
        {value}
      </Typography>
      <Typography variant="caption" muted>
        {label}
      </Typography>
    </Card>
  );
}

export default function StatisticsScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const { data: stats, isLoading } = useStatistics(uid);
  const colors = useThemeColors();

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
    <Screen scroll contentStyle={styles.content}>
      <PageIntro
        title="Scorebook"
        subtitle="A bright little record of your grid adventures."
        accent={colors.success}
      />
      <View style={styles.grid}>
        <StatTile label="Games" value={s.gamesPlayed} accent={colors.primary} />
        <StatTile label="Win rate" value={`${winRate}%`} accent={colors.warning} />
        <StatTile label="Wins" value={s.wins} accent={colors.success} />
        <StatTile label="Losses" value={s.losses} accent={colors.accent} />
        <StatTile label="Draws" value={s.draws} accent={colors.purple} />
        <StatTile label="Boxes won" value={s.totalBoxesWon} accent={colors.primary} />
        <StatTile label="Win streak" value={s.winStreak} accent={colors.warning} />
        <StatTile label="Best streak" value={s.bestWinStreak} accent={colors.success} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 680 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  tile: {
    flexBasis: 140,
    flexGrow: 1,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  miniDot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, top: 10, right: 10 },
});
